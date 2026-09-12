import { FaceDriver, CharAlignment, PoseFrame, FramesClip, AnimationMode } from '../types/avatar';
import { AudioEngine } from '../audio/audio-engine';
import { VisemeScheduler } from './viseme-scheduler';
import { mapCharToShapes, charTokenFor } from './viseme-mappings';
import { ensureG2pLoaded, isG2pReady, g2pAvailable } from './g2p/g2p-en';
import { mergeCharAlignmentToPhonemes } from './g2p/phoneme-merge';
import { mapPhonemeToShapes } from './g2p/phoneme-visemes';
import {
  loadVisemeOverrides,
  defaultVisemeShapes,
  VisemeOverrideMap,
} from './viseme-overrides';
import { ProceduralBlink } from './procedural-blink';
import { EmotionLayer, EmotionType } from '../realism/emotion-layer';
import { CalibrationProfile } from './calibration';

export type FaceState = 'IDLE' | 'SPEAKING' | 'RELAXING';

/** Cap twardy mouthClose dla toru frames — lustro CLOSE_SAFETY_CAP z VisemeScheduler
 *  (ochrona MetaPerson przed "wargą na nos"). */
const FRAME_CLOSE_CAP = 0.85;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Meta aktywnego clipu w trybie frames (08-CONTEXT v2). */
interface FrameMeta {
  shapes: readonly string[];
  carriesEyes: boolean;
  carriesEmotion: boolean;
}

/**
 * FaceController — state machine (IDLE -> SPEAKING -> RELAXING -> IDLE).
 * Jedyny moduł w całym systemie posiadający uprawnienia do pisania wag do FaceDriver (docs/4).
 */
export class FaceController {
  private readonly driver: FaceDriver;
  private readonly engine: AudioEngine;
  private readonly scheduler: VisemeScheduler;
  private readonly blinker: ProceduralBlink;
  private readonly emotionLayer: EmotionLayer;

  private state: FaceState = 'IDLE';
  private epoch = 0;
  private relaxStartedAt = 0;
  private relaxDurationMs = 150; // 150 ms płynny powrót do neutralu (docs/4)

  // --- Tryb animacji (08-CONTEXT v2): 'viseme' (domyślny) | 'frames' (absolutne ramki A2F) ---
  private animationMode: AnimationMode = 'viseme';
  /** Zmiana trybu odroczona do granicy tury (router per-tura — bez cięcia twarzy mid-turn). */
  private pendingMode: AnimationMode | null = null;

  // Stan toru frames: bufor ramek + meta aktywnego clipu.
  private frameBuffer: PoseFrame[] = [];
  private frameBaseSec = 0;
  private framesMeta: FrameMeta | null = null;

  // Bieżące wygładzone wagi kluczy mowy dla fazy relaksu
  private readonly currentWeights: Map<string, number> = new Map();
  private readonly manualOverrides: Map<string, number> = new Map();

  // Funkcja mrugania powiekami
  private blinkProvider: (() => { left: number; right: number }) | null = null;

  // Funkcja mapowania znaków na kształty
  private charMapper: (chars: string[], index: number) => Map<string, number> = mapCharToShapes;

  // Silnik lip-syncu: 'phoneme' = warstwa G2P (EN), 'char' = stara tabela znaków (PL/fallback)
  private lipSyncEngine: 'phoneme' | 'char' = 'phoneme';

  // Nadpisania ułożenia blendshape'ów PER WIZEM (Edytor Wizemów, localStorage) —
  // mają pierwszeństwo przed domyślnymi tabelami mapowań.
  private readonly visemeOverrides: Map<string, Map<string, number>> = new Map();

  constructor(driver: FaceDriver, engine: AudioEngine) {
    this.driver = driver;
    this.engine = engine;
    this.scheduler = new VisemeScheduler();
    this.blinker = new ProceduralBlink();
    this.emotionLayer = new EmotionLayer();
    this.blinkProvider = () => this.blinker.update(this.engine.ctx.currentTime);

    // Warstwa fonemowa EN (docs/3 v1.1): leniwy, dynamiczny ładunek leksykonu CMUdict.
    // Przez pierwsze ~1-2 s sesji FaceController działa na ścieżce char, po załadowaniu
    // przełącza się sam na fonemy (isG2pReady).
    ensureG2pLoaded().catch((err) =>
      console.warn('[FaceController] G2P niedostępny — pozostaję na ścieżce char:', err)
    );

    // Nadpisania wizemów z Edytora (jeśli zapisane w localStorage)
    this.applyVisemeOverridesRecord(loadVisemeOverrides());
  }

  /** Zastępuje całą mapę nadpisań wizemów (wywoływane przy zapisie z Edytora). */
  public applyVisemeOverridesRecord(record: VisemeOverrideMap): void {
    this.visemeOverrides.clear();
    for (const [key, shapes] of Object.entries(record)) {
      this.visemeOverrides.set(key, new Map(Object.entries(shapes)));
    }
  }

  /** Aktualny tryb animacji: 'viseme' (LIVE) | 'frames' (absolutne ramki A2F). */
  public getAnimationMode(): AnimationMode {
    return this.animationMode;
  }

  /**
   * Przełącza tryb animacji.
   * - Bez `deferToTurnEnd`: natychmiast (dev-switch) — czyści scheduler/bufor ramek,
   *   zeruje stan mowy i wraca do IDLE.
   * - Z `deferToTurnEnd: true`: jeśli trwa mowa (SPEAKING), zmiana zapisywana jest do
   *   `pendingMode` i aplikowana na granicy tury (koniec mowy lub przerwanie) — bez
   *   cięcia twarzy w pół zdania (router per-tura).
   */
  public setAnimationMode(mode: AnimationMode, opts?: { deferToTurnEnd?: boolean }): void {
    if (mode === this.animationMode) {
      this.pendingMode = null;
      return;
    }
    if (opts?.deferToTurnEnd && this.state === 'SPEAKING') {
      this.pendingMode = mode;
      return;
    }
    this.applyModeImmediate(mode);
  }

  /** Natychmiastowa zmiana trybu: czyści cały stan mowy i twarz wraca do neutralu. */
  private applyModeImmediate(mode: AnimationMode): void {
    this.animationMode = mode;
    this.pendingMode = null;
    this.scheduler.clear();
    this.frameBuffer = [];
    this.framesMeta = null;
    this.clearManualOverrides();
    this.state = 'IDLE';
    console.log(`[FaceController] Tryb animacji → ${mode} (natychmiast, IDLE)`);
  }

  /**
   * Aplikuje odroczoną zmianę trybu (pendingMode) na granicy tury: przełącza tryb
   * i wchodzi w RELAXING (płynny powrót z bieżącej pozy, bez zerwania).
   * Zwraca true, gdy tryb został faktycznie przełączony.
   */
  private commitPendingMode(): boolean {
    if (this.pendingMode === null || this.pendingMode === this.animationMode) {
      this.pendingMode = null;
      return false;
    }
    const target = this.pendingMode;
    this.pendingMode = null;
    this.animationMode = target;
    this.scheduler.clear();
    this.frameBuffer = [];
    this.framesMeta = null;
    this.manualOverrides.clear();
    this.state = 'RELAXING';
    this.relaxStartedAt = performance.now();
    console.log(`[FaceController] Tryb animacji → ${target} (granica tury, RELAXING)`);
    return true;
  }

  /**
   * Wstrzykuje absolutny strumień ramek (tryb frames, kontrakt v2).
   * `clip.frames[].timeSec` jest WZGLĘDNY — baza (baseSec, z AudioEngine.playChunk)
   * dodawana jest TU JEDNORAZOWO: czas ramki na osi audio = baseSec + timeSec.
   */
  public feedFrames(clip: FramesClip, baseSec: number, epoch: number): void {
    if (epoch !== this.engine.getEpoch()) {
      console.warn('[FaceController] feedFrames ze starej epoki — ignoruję');
      return;
    }
    this.epoch = epoch;

    // Jedno źródło w danym momencie: kasujemy ewentualne wizemy z poprzedniego toru.
    this.scheduler.clear();
    if (this.state === 'RELAXING' || this.state === 'IDLE') {
      this.state = 'SPEAKING';
      this.clearManualOverrides();
    }

    this.frameBaseSec = baseSec;
    this.frameBuffer = [...clip.frames].sort((a, b) => a.timeSec - b.timeSec);
    this.framesMeta = {
      shapes: clip.shapes ?? [],
      carriesEyes: clip.carriesEyes === true,
      carriesEmotion: clip.carriesEmotion === true,
    };
    console.log(
      `[FaceController] feedFrames: ${this.frameBuffer.length} ramek, base=${baseSec.toFixed(3)}s, ` +
        `shapes=${this.framesMeta.shapes.length}, eyes=${this.framesMeta.carriesEyes}`
    );
  }

  /** Liczba oczekujących ramek (tor frames) lub elementów kolejki (tor wizemowy). */
  public getFrameQueueLength(): number {
    return this.frameBuffer.length;
  }

  /**
   * Ustawia/nadpisuje ułożenie pojedynczego wizemu (mapa kształtów jest kopiowana). */
  public setVisemeOverride(key: string, shapes: Map<string, number>): void {
    const clean = new Map<string, number>();
    for (const [shape, value] of shapes.entries()) {
      if (value > 0.001) clean.set(shape, Math.max(0, Math.min(1, value)));
    }
    if (clean.size === 0) this.visemeOverrides.delete(key);
    else this.visemeOverrides.set(key, clean);
  }

  /** Usuwa nadpisanie wizemu (wraca domyślna tabela). */
  public clearVisemeOverride(key: string): void {
    this.visemeOverrides.delete(key);
  }

  /** Czyści wszystkie nadpisania wizemów. */
  public clearAllVisemeOverrides(): void {
    this.visemeOverrides.clear();
  }

  /**
   * Efektywne kształty dla wizemu: nadpisanie (jeśli jest) albo domyślna tabela.
   * Dla ścieżki znakowej 'C' bez kontekstu brany jest wariant twardy (podgląd).
   */
  public resolveVisemeShapes(key: string): Map<string, number> | null {
    const override = this.visemeOverrides.get(key);
    if (override) return new Map(override);
    return defaultVisemeShapes(key);
  }

  /**
   * Statyczny podgląd ułożenia ust dla dowolnego wizemu (Edytor Wizemów).
   * Aplikuje pozy na modelu gdy agent nie mówi; mowa (onAudioChunk) czyści podgląd.
   */
  public previewViseme(key: string | null): void {
    if (this.state === 'SPEAKING') return;
    this.clearManualOverrides();
    if (!key) return;
    const shapes = this.resolveVisemeShapes(key);
    if (!shapes) return;
    for (const [shape, value] of shapes.entries()) {
      this.setManualOverride(shape, value);
    }
  }

  public setCharMapper(mapper: (chars: string[], index: number) => Map<string, number>): void {
    this.charMapper = mapper;
  }

  /** Wybiera silnik lip-syncu: 'phoneme' (G2P, EN) lub 'char' (tabela znaków). */
  public setLipSyncEngine(engine: 'phoneme' | 'char'): void {
    this.lipSyncEngine = engine;
    this.scheduler.clear();
  }

  public setBlinkProvider(provider: () => { left: number; right: number }): void {
    this.blinkProvider = provider;
  }

  public setEmotion(type: EmotionType): void {
    this.emotionLayer.setEmotion(type);
  }

  public analyzeAndApplyEmotion(text: string): void {
    const emotion = this.emotionLayer.analyzeText(text);
    this.emotionLayer.setEmotion(emotion);
  }

  /**
   * Wywoływane przy odebraniu chunka audio z alignmentem (docs/2, docs/4)
   */
  public onAudioChunk(alignment: CharAlignment, chunkStartTimeSec: number, epoch: number): void {
    // Jeśli chunk pochodzi ze starej epoki (przed przerwaniem), ignoruj
    if (epoch !== this.engine.getEpoch()) {
      return;
    }

    this.epoch = epoch;

    if (this.state === 'RELAXING' || this.state === 'IDLE') {
      this.state = 'SPEAKING';
      this.clearManualOverrides();
    }

    // Fallback akustyczny (LIPS-07): alignment z energii RMS porusza WYŁĄCZNIE żuchwą
    // (jawOpen ∝ energia, bez fałszywych samogłosek). Pętla per znak pominięta.
    if (alignment.source === 'energy-fallback' && alignment.energies) {
      const profile = this.scheduler.getCalibrationProfile();
      const syncOffsetSec = profile.syncOffsetMs / 1000;
      for (let i = 0; i < alignment.chars.length; i++) {
        const energy = alignment.energies[i] ?? 0;
        if (energy <= 0.02) continue; // cisza → brak wizemy (naturalny zanik)
        const startMs = alignment.char_start_times_ms[i] ?? 0;
        const durationMs = alignment.char_durations_ms[i] ?? 70;
        this.scheduler.enqueue({
          epoch,
          char: '#energy',
          shapes: new Map([['jawOpen', Math.min(0.5, energy * 2.0)]]),
          startTimeSec: chunkStartTimeSec + startMs / 1000 + syncOffsetSec,
          durationSec: Math.max(0.035, durationMs / 1000),
        });
      }
      this.state = 'SPEAKING';
      this.clearManualOverrides();
      return; // NIE wykonuj pętli per znak dla fallbacku
    }

    // Warstwa fonemowa EN (LIPS-05): alignment znaków -> fonemy ARPAbet (G2P) -> wizemy.
    // Litery nieme nie generują ruchów; timing słów pochodzi z alignmentu ElevenLabs.
    if (
      this.lipSyncEngine === 'phoneme' &&
      g2pAvailable() &&
      isG2pReady() &&
      (alignment.source === undefined || alignment.source === 'elevenlabs')
    ) {
      const spans = mergeCharAlignmentToPhonemes(alignment);
      if (spans.length > 0) {
        const profile = this.scheduler.getCalibrationProfile();
        const syncOffsetSec = profile.syncOffsetMs / 1000;
        for (const span of spans) {
          // Nadpisanie z Edytora Wizemów ma pierwszeństwo przed domyślną tabelą fonemów.
          const override = this.visemeOverrides.get(span.phoneme);
          const shapes = override ? new Map(override) : mapPhonemeToShapes(span.phoneme);
          if (!shapes || shapes.size === 0) continue; // brak ułożenia -> bez wizemy
          this.scheduler.enqueue({
            epoch,
            char: span.phoneme,
            shapes,
            startTimeSec: chunkStartTimeSec + span.startMs / 1000 + syncOffsetSec,
            durationSec: Math.max(0.035, span.durationMs / 1000),
          });
        }
        return; // kolejka fonemowa zastępuje pętlę per znak
      }
      // Brak spanów (np. sam tekst nieliterowy) -> przejście do pętli per znak
    }

    // Planowanie wizemów na osi czasu audio
    for (let i = 0; i < alignment.chars.length; i++) {
      const char = alignment.chars[i];
      const startMs = alignment.char_start_times_ms[i] ?? 0;
      const durationMs = alignment.char_durations_ms[i] ?? 50;

      // Nadpisanie z Edytora Wizemów (ścieżka znakowa) ma pierwszeństwo przed tabelą znaków.
      let shapes: Map<string, number>;
      const token = charTokenFor(alignment.chars, i);
      const tokenOverride = token ? this.visemeOverrides.get(token) : undefined;
      if (tokenOverride) {
        shapes = new Map(tokenOverride);
      } else {
        shapes = this.charMapper(alignment.chars, i);
      }

      const profile = this.scheduler.getCalibrationProfile();
      const syncOffsetSec = profile.syncOffsetMs / 1000;

      this.scheduler.enqueue({
        epoch,
        char,
        shapes,
        startTimeSec: chunkStartTimeSec + startMs / 1000 + syncOffsetSec,
        durationSec: Math.max(0.035, durationMs / 1000),
      });
    }
  }

  public setCalibrationProfile(profile: Partial<CalibrationProfile>): void {
    this.scheduler.setCalibrationProfile(profile);
  }

  public getCalibrationProfile(): CalibrationProfile {
    return this.scheduler.getCalibrationProfile();
  }

  /**
   * Statyczny podgląd ułożenia ust dla wybranej głoski (do testów w kalibratorze)
   */
  public testPhoneme(phonemeKey: 'A' | 'E' | 'O' | 'U' | 'M' | 'SZ' | 'F' | 'neutral'): void {
    this.clearManualOverrides();

    if (phonemeKey === 'neutral') {
      this.state = 'RELAXING';
      this.relaxStartedAt = performance.now();
      return;
    }

    const profile = this.scheduler.getCalibrationProfile();

    switch (phonemeKey) {
      case 'A':
        this.setManualOverride('jawOpen', 0.55 * profile.jawScale);
        this.setManualOverride('mouthLowerDownLeft', 0.15);
        this.setManualOverride('mouthLowerDownRight', 0.15);
        break;

      case 'E':
        this.setManualOverride('jawOpen', 0.16 * profile.jawScale);
        this.setManualOverride('mouthSmileLeft', 0.35 * profile.smileScale);
        this.setManualOverride('mouthSmileRight', 0.35 * profile.smileScale);
        this.setManualOverride('mouthUpperUpLeft', 0.15);
        this.setManualOverride('mouthUpperUpRight', 0.15);
        this.setManualOverride('mouthLowerDownLeft', 0.15);
        this.setManualOverride('mouthLowerDownRight', 0.15);
        break;

      case 'O':
        this.setManualOverride('jawOpen', 0.28 * profile.jawScale);
        this.setManualOverride('mouthFunnel', 0.45 * profile.funnelScale);
        this.setManualOverride('mouthPucker', 0.40 * profile.puckerScale);
        break;

      case 'U':
        this.setManualOverride('jawOpen', 0.16 * profile.jawScale);
        this.setManualOverride('mouthPucker', 0.65 * profile.puckerScale);
        this.setManualOverride('mouthFunnel', 0.20 * profile.funnelScale);
        break;

      case 'M':
        // Domykanie warg (M / B / P): wargi stykają się w naturalnej linii, bez podciągania brody pod nos
        this.setManualOverride('mouthClose', profile.closeScale);
        this.setManualOverride('jawOpen', 0.04);
        this.setManualOverride('mouthPressLeft', 0.12);
        this.setManualOverride('mouthPressRight', 0.12);
        break;

      case 'SZ':
        // Szumiące (SZ / CZ): wargi wysunięte do przodu w zaokrąglony tunel, zęby zbliżone i widoczne
        this.setManualOverride('jawOpen', 0.12 * profile.jawScale);
        this.setManualOverride('mouthFunnel', 0.65 * profile.funnelScale);
        this.setManualOverride('mouthPucker', 0.25 * profile.puckerScale);
        this.setManualOverride('mouthUpperUpLeft', 0.25 * profile.teethExposureScale);
        this.setManualOverride('mouthUpperUpRight', 0.25 * profile.teethExposureScale);
        this.setManualOverride('mouthLowerDownLeft', 0.22 * profile.teethExposureScale);
        this.setManualOverride('mouthLowerDownRight', 0.22 * profile.teethExposureScale);
        break;

      case 'F':
        // Wargowo-zębowa (F / V): górne siekacze oparte na podwiniętej dolnej wardze!
        this.setManualOverride('jawOpen', 0.10 * profile.jawScale);
        this.setManualOverride('mouthRollLower', 0.70 * profile.rollScale);
        this.setManualOverride('mouthUpperUpLeft', 0.55 * profile.teethExposureScale);
        this.setManualOverride('mouthUpperUpRight', 0.55 * profile.teethExposureScale);
        this.setManualOverride('mouthShrugLower', 0.20);
        break;
    }
  }

  /**
   * Wywoływane natychmiast przy przerwaniu (barge-in z serwera lub UI)
   */
  public onInterruption(): void {
    this.scheduler.clear();
    this.frameBuffer = [];
    // Odroczona zmiana trybu aplikuje się właśnie przy przerwaniu (granica tury).
    if (this.commitPendingMode()) {
      console.log('[FaceController] Przerwanie mimiki -> RELAXING (przełączono tryb)');
      return;
    }
    this.state = 'RELAXING';
    this.relaxStartedAt = performance.now();
    console.log('[FaceController] Przerwanie mimiki -> stan RELAXING');
  }

  /**
   * Tor frames — aplikacja absolutnych ramek (kontrakt v2) na osi ctx.currentTime.
   * Zero-order hold: trzymamy ostatnią ramkę o baseSec+timeSec <= now; bez wygładzania,
   * bez addycji. Safety: clamp 0..1 + cap mouthClose (FRAME_CLOSE_CAP). Zapisuje
   * currentWeights, by RELAXING startował z ostatniej pozy. Emocje: gdy carriesEmotion —
   * ramki niosą ekspresję (A2E), więc NIE domieszkujemy; w przeciwnym razie dokładamy
   * tylko kształty NIENALEŻĄCE do clipu (np. brwi).
   */
  private updateFrames(nowSec: number, emotionWeights: Map<string, number>): void {
    const meta = this.framesMeta;
    const base = this.frameBaseSec;

    const endTurn = () => {
      if (!this.engine.hasPendingAudio()) {
        if (this.commitPendingMode()) return;
        this.state = 'RELAXING';
        this.relaxStartedAt = performance.now();
      }
    };

    if (!meta || this.frameBuffer.length === 0) {
      endTurn();
      return;
    }

    const buf = this.frameBuffer;
    // Ostatnia ramka, której czas już nadszedł (binarnie).
    let lo = 0;
    let hi = buf.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (base + buf[mid].timeSec <= nowSec) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (idx < 0) {
      // Przed pierwszą ramką (start tury) — czekamy.
      return;
    }

    // Zużyte ramki (starsze od bieżącej) wyrzucamy, bieżącą trzymamy do następnej.
    if (idx > 0) this.frameBuffer = buf.slice(idx);
    const frame = this.frameBuffer[0];

    // Aplikacja kształtów należących do clipu (owned = absolute, zero-bez-bezwzględne).
    for (const shape of meta.shapes) {
      const raw = frame.weights[shape] ?? 0;
      let w = clamp01(raw);
      if (shape === 'mouthClose') w = Math.min(w, FRAME_CLOSE_CAP);
      if (w < 0.001) w = 0;
      this.currentWeights.set(shape, w);
      this.driver.applyWeight(shape, w);
    }

    // Emocje spoza clipu — tylko gdy ramki NIE niosą własnej ekspresji.
    if (!meta.carriesEmotion) {
      for (const [shape, emWeight] of emotionWeights.entries()) {
        if (shape.startsWith('eyeBlink')) continue;
        if (meta.shapes.indexOf(shape) !== -1) continue; // kształt absolutny — bez domieszki
        const w = clamp01(emWeight);
        this.currentWeights.set(shape, w);
        this.driver.applyWeight(shape, w);
      }
    }

    // Koniec tury: audio dobiegło końca -> ramki zużyte -> RELAXING z ostatniej pozy.
    endTurn();
  }

  /**
   * Główna pętla aktualizacji mimiki wywoływana z pętli animacji renderera Three.js (dt w sekundach)
   */
  public render(dt: number): void {
    const nowSec = this.engine.ctx.currentTime;

    // 1. Proceduralne mruganie powiekami — pomijane, gdy aktywny clip niesie własne oczy
    //    (tryb frames + carriesEyes, kontrakt v2). W pozostałych stanach mruganie działa.
    const framesCarryEyes = this.animationMode === 'frames' && this.framesMeta?.carriesEyes === true;
    if (this.blinkProvider && !framesCarryEyes) {
      const blink = this.blinkProvider();
      this.driver.applyWeight('eyeBlinkLeft', blink.left);
      this.driver.applyWeight('eyeBlinkRight', blink.right);
    }

    // 2. Aktualizacja wag warstwy emocjonalnej (REAL-03)
    const emotionWeights = this.emotionLayer.update(dt);

    // 3. Maszyna stanów aparatu mowy
    switch (this.state) {
      case 'SPEAKING': {
        // Tor frames (08-CONTEXT v2): absolutne ramki aplikowane wprost, bez schedulera.
        if (this.animationMode === 'frames') {
          this.updateFrames(nowSec, emotionWeights);
          break;
        }

        const speechShapes = this.driver.listAvailableShapes();
        const updatedWeights = this.scheduler.update(nowSec, dt, this.engine.getEpoch(), speechShapes);

        const activeMouthClose = updatedWeights.get('mouthClose') ?? 0;

        for (const [shape, weight] of updatedWeights.entries()) {
          // Nakładamy emocję (np. uśmiech), chyba że wargi muszą się szczelnie zamknąć (mouthClose)
          let finalWeight = weight;
          const emWeight = emotionWeights.get(shape) ?? 0;

          if (shape.startsWith('mouthSmile') && activeMouthClose > 0.25) {
            // Tłumimy uśmiech przy spółgłoskach wargowych M/B/P
            finalWeight = weight;
          } else {
            // Subtelny wpływ emocji podczas mowy (30% wagi emocji), by mimika była zbalansowana
            finalWeight = Math.min(1.0, weight + emWeight * 0.3);
          }

          this.currentWeights.set(shape, finalWeight);
          this.driver.applyWeight(shape, finalWeight);
        }

        // Nakładamy emocje niebędące w wizemach mowy (np. brwi)
        for (const [shape, emWeight] of emotionWeights.entries()) {
          if (!updatedWeights.has(shape) && !shape.startsWith('eyeBlink')) {
            this.driver.applyWeight(shape, emWeight);
          }
        }

        // Jeśli kolejka wizemów się skończyła i audio przestało grać -> przejście do relaksacji
        if (this.scheduler.getQueueLength() === 0 && !this.engine.hasPendingAudio()) {
          if (this.commitPendingMode()) break;
          this.state = 'RELAXING';
          this.relaxStartedAt = performance.now();
        }
        break;
      }

      case 'RELAXING': {
        const elapsedMs = performance.now() - this.relaxStartedAt;
        const progress = Math.min(1, elapsedMs / this.relaxDurationMs);
        // Cosine ease powrotu do neutralu
        const relaxFactor = 1 - Math.sin((progress * Math.PI) / 2);

        let maxWeight = 0;
        const availableShapes = this.driver.listAvailableShapes();

        for (const shape of availableShapes) {
          if (shape.startsWith('eyeBlink')) continue;

          const current = this.currentWeights.get(shape) ?? 0;
          const emTarget = emotionWeights.get(shape) ?? 0;
          // Płynny powrót z pozycji mowy w kierunku emocji bazowej
          const next = emTarget + (current - emTarget) * relaxFactor;

          this.currentWeights.set(shape, next);
          this.driver.applyWeight(shape, next);

          if (next > maxWeight) maxWeight = next;
        }

        if (progress >= 1 || maxWeight < 0.005) {
          this.state = 'IDLE';
          this.scheduler.resetAll();
          // Sprzątanie toru frames po zakończonej relaksacji — meta/oczy nie mogą
          // wyłączać mrugania w IDLE ani trzymać zużytego bufora.
          this.frameBuffer = [];
          this.framesMeta = null;
        }
        break;
      }

      case 'IDLE':
      default:
        // W stanie IDLE aplikujemy subtelną bazową ekspresję emocjonalną (brwi, delikatny uśmiech)
        for (const [shape, emWeight] of emotionWeights.entries()) {
          if (!shape.startsWith('eyeBlink')) {
            this.driver.applyWeight(shape, emWeight);
          }
        }
        break;
    }

    // 4. Aplikacja manualnych nadpisań z suwaków testowych w HUD (aktywna tylko gdy agent nie mówi)
    if (this.state !== 'SPEAKING') {
      const currentJaw = this.manualOverrides.get('jawOpen') ?? this.currentWeights.get('jawOpen') ?? 0;
      for (const [shape, val] of this.manualOverrides.entries()) {
        let safeVal = val;
        // Anatomiczne zabezpieczenie przed wjechaniem dolnej wargi na nos:
        if (shape === 'mouthClose') {
          const maxLimit = currentJaw + 0.20;
          safeVal = Math.min(val, maxLimit);
        }
        this.driver.applyWeight(shape, safeVal);
      }
    }
  }

  public setManualOverride(shape: string, value: number | null): void {
    if (value === null || value === undefined) {
      this.manualOverrides.delete(shape);
      this.driver.applyWeight(shape, 0);
    } else {
      this.manualOverrides.set(shape, value);
      let safeVal = value;
      if (shape === 'mouthClose') {
        const currentJaw = this.manualOverrides.get('jawOpen') ?? this.currentWeights.get('jawOpen') ?? 0;
        const maxLimit = currentJaw + 0.20;
        safeVal = Math.min(value, maxLimit);
      }
      this.driver.applyWeight(shape, safeVal);

      // Gdy użytkownik rusza suwakiem jawOpen, natychmiast adaptuj limit dla aktywnego mouthClose
      if (shape === 'jawOpen') {
        const existingClose = this.manualOverrides.get('mouthClose');
        if (existingClose !== undefined) {
          const closeLimit = value + 0.20;
          this.driver.applyWeight('mouthClose', Math.min(existingClose, closeLimit));
        }
      }
    }
  }

  public clearManualOverrides(): void {
    for (const shape of this.driver.listAvailableShapes()) {
      if (!shape.startsWith('eyeBlink')) {
        this.driver.applyWeight(shape, 0);
      }
    }
    this.manualOverrides.clear();
  }

  public getState(): FaceState {
    return this.state;
  }

  public getEpoch(): number {
    return this.epoch;
  }

  public getQueueLength(): number {
    return this.scheduler.getQueueLength();
  }

  public getCurrentWeight(shape: string): number {
    return this.currentWeights.get(shape) ?? 0;
  }

  public getEmotionLayer(): EmotionLayer {
    return this.emotionLayer;
  }

  /** Eksport bieżących nadpisań wizemów (dla Edytora / zapisu). */
  public getVisemeOverridesRecord(): VisemeOverrideMap {
    const record: VisemeOverrideMap = {};
    for (const [key, shapes] of this.visemeOverrides.entries()) {
      record[key] = Object.fromEntries(shapes.entries());
    }
    return record;
  }
}
