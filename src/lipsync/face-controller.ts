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
import { createAudibleClock } from '../audio/audible-clock';

export type FaceState = 'IDLE' | 'SPEAKING' | 'RELAXING';

/** Hard cap on mouthClose for the frames track — mirrors CLOSE_SAFETY_CAP from VisemeScheduler
  *  (protects MetaPerson from the "lip on the nose" artifact). */
const FRAME_CLOSE_CAP = 0.85;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Meta of the active clip in frames mode (08-CONTEXT v2). */
interface FrameMeta {
  shapes: readonly string[];
  carriesEyes: boolean;
  carriesEmotion: boolean;
}

export interface FaceControllerOptions {
  /** Time (AudioContext seconds) currently audible; defaults to the latency-compensated audio clock. */
  audibleClock?: () => number;
}

/**
  * FaceController — state machine (IDLE -> SPEAKING -> RELAXING -> IDLE).
  * The only module in the whole system allowed to write weights to FaceDriver (docs/4).
 */
export class FaceController {
  private readonly driver: FaceDriver;
  private readonly engine: AudioEngine;
  private readonly audibleClock: () => number;
  private readonly scheduler: VisemeScheduler;
  private readonly blinker: ProceduralBlink;
  private readonly emotionLayer: EmotionLayer;

  private state: FaceState = 'IDLE';
  private epoch = 0;
  private relaxStartedAt = 0;
  private relaxDurationMs = 150; // 150 ms smooth return to neutral (docs/4)

  // --- Animation mode (08-CONTEXT v2): 'viseme' (default) | 'frames' (absolute A2F frames) ---
  private animationMode: AnimationMode = 'viseme';
  /** Mode change deferred to the turn boundary (per-turn router — no mid-turn face cuts). */
  private pendingMode: AnimationMode | null = null;

  // Frames track state: frame buffer + meta of the active clip.
  private frameBuffer: PoseFrame[] = [];
  private frameBaseSec = 0;
  private framesMeta: FrameMeta | null = null;

  // Current smoothed speech-key weights for the relax phase
  private readonly currentWeights: Map<string, number> = new Map();
  private readonly manualOverrides: Map<string, number> = new Map();

  // Eyelid blinking function
  private blinkProvider: (() => { left: number; right: number }) | null = null;

  // Character-to-shape mapping function
  private charMapper: (chars: string[], index: number) => Map<string, number> = mapCharToShapes;

  // Lip-sync engine: 'phoneme' = G2P layer (EN), 'char' = legacy char table (PL/fallback)
  private lipSyncEngine: 'phoneme' | 'char' = 'phoneme';

  // Per-VISEME blendshape pose overrides (Viseme Editor, localStorage) —
  // they take precedence over the default mapping tables.
  private readonly visemeOverrides: Map<string, Map<string, number>> = new Map();

  constructor(driver: FaceDriver, engine: AudioEngine, options: FaceControllerOptions = {}) {
    this.driver = driver;
    this.engine = engine;
    // Mouth timing follows the time actually HEARD (output latency compensated), not the render position.
    this.audibleClock = options.audibleClock ?? createAudibleClock(engine.ctx);
    this.scheduler = new VisemeScheduler();
    this.blinker = new ProceduralBlink();
    this.emotionLayer = new EmotionLayer();
    this.blinkProvider = () => this.blinker.update(this.engine.ctx.currentTime);

    // EN phoneme layer (docs/3 v1.1): lazy, dynamic load of the CMUdict lexicon.
    // For the first ~1-2 s of a session FaceController runs on the char path; once loaded
    // it switches to phonemes on its own (isG2pReady).
    ensureG2pLoaded().catch((err) =>
      console.warn('[FaceController] G2P unavailable — staying on the char path:', err)
    );

    // Viseme overrides from the Editor (if saved in localStorage)
    this.applyVisemeOverridesRecord(loadVisemeOverrides());
  }

  /** Replaces the whole viseme override map (called when saving from the Editor). */
  public applyVisemeOverridesRecord(record: VisemeOverrideMap): void {
    this.visemeOverrides.clear();
    for (const [key, shapes] of Object.entries(record)) {
      this.visemeOverrides.set(key, new Map(Object.entries(shapes)));
    }
  }

  /** Current animation mode: 'viseme' (LIVE) | 'frames' (absolute A2F frames). */
  public getAnimationMode(): AnimationMode {
    return this.animationMode;
  }

  /**
   * Switches the animation mode.
   * - Without `deferToTurnEnd`: immediately (dev-switch) — clears the scheduler/frame buffer and
   *   eases out through RELAXING from the current pose (never a hard snap to neutral).
   * - With `deferToTurnEnd: true`: if speech is in progress (SPEAKING), the change is stored in
   *   `pendingMode` and applied at the turn boundary (end of speech or interruption) — without
   *   cutting the face mid-sentence (per-turn router).
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
    this.switchModeAtBoundary(mode);
  }

  /**
   * The single mode-switch semantics (immediate and deferred requests both land here):
   * both tracks are dropped, and unless the face is already IDLE it eases out through RELAXING
   * from `currentWeights` — a switch can therefore never pop the face to neutral.
   */
  private switchModeAtBoundary(mode: AnimationMode): void {
    this.animationMode = mode;
    this.pendingMode = null;
    this.scheduler.clear();
    this.frameBuffer = [];
    this.framesMeta = null;
    if (this.state === 'IDLE') {
      // Nothing to preserve; only a leftover dev pose (previewViseme / sliders) needs wiping.
      if (this.manualOverrides.size > 0) this.resetFaceToNeutral();
      console.log(`[FaceController] Animation mode → ${mode} (IDLE)`);
      return;
    }
    this.clearManualOverrideMap();
    this.state = 'RELAXING';
    this.relaxStartedAt = performance.now();
    console.log(`[FaceController] Animation mode → ${mode} (turn boundary, RELAXING)`);
  }

  /**
   * Applies the deferred mode change (pendingMode) at the turn boundary.
   * Returns true if the mode was actually switched.
   */
  private commitPendingMode(): boolean {
    if (this.pendingMode === null || this.pendingMode === this.animationMode) {
      this.pendingMode = null;
      return false;
    }
    this.switchModeAtBoundary(this.pendingMode);
    return true;
  }

  /**
   * Injects an absolute frame stream (frames mode, contract v2).
   * `clip.frames[].timeSec` is RELATIVE — the base (baseSec, from AudioEngine.playChunk)
   * is added HERE exactly once: frame time on the audio axis = baseSec + timeSec.
   */
  public feedFrames(clip: FramesClip, baseSec: number, epoch: number): void {
    if (epoch !== this.engine.getEpoch()) {
      console.warn('[FaceController] feedFrames from a stale epoch — ignoring');
      return;
    }
    this.epoch = epoch;

    // One source at a time: drop any visemes left over from the previous track.
    this.scheduler.clear();
    if (this.state === 'RELAXING' || this.state === 'IDLE') {
      this.state = 'SPEAKING';
      this.clearManualOverrideMap();
    }

    this.frameBaseSec = baseSec;
    this.frameBuffer = [...clip.frames].sort((a, b) => a.timeSec - b.timeSec);
    this.framesMeta = {
      shapes: clip.shapes ?? [],
      carriesEyes: clip.carriesEyes === true,
      carriesEmotion: clip.carriesEmotion === true,
    };
    console.log(
      `[FaceController] feedFrames: ${this.frameBuffer.length} frames, base=${baseSec.toFixed(3)}s, ` +
        `shapes=${this.framesMeta.shapes.length}, eyes=${this.framesMeta.carriesEyes}`
    );
  }

  /** Number of pending frames (frames track) or queue items (viseme track). */
  public getFrameQueueLength(): number {
    return this.frameBuffer.length;
  }

  /**
   * Sets/overrides the pose of a single viseme (the shape map is copied). */
  public setVisemeOverride(key: string, shapes: Map<string, number>): void {
    const clean = new Map<string, number>();
    for (const [shape, value] of shapes.entries()) {
      if (value > 0.001) clean.set(shape, Math.max(0, Math.min(1, value)));
    }
    if (clean.size === 0) this.visemeOverrides.delete(key);
    else this.visemeOverrides.set(key, clean);
  }

  /** Removes a viseme override (the default table applies again). */
  public clearVisemeOverride(key: string): void {
    this.visemeOverrides.delete(key);
  }

  /** Clears all viseme overrides. */
  public clearAllVisemeOverrides(): void {
    this.visemeOverrides.clear();
  }

  /**
   * Effective shapes for a viseme: the override (if any) or the default table.
   * For the character-path 'C' with no context the hard variant is used (preview).
   */
  public resolveVisemeShapes(key: string): Map<string, number> | null {
    const override = this.visemeOverrides.get(key);
    if (override) return new Map(override);
    return defaultVisemeShapes(key);
  }

  /**
   * Static mouth-pose preview for any viseme (Viseme Editor).
   * Applies poses on the model while the agent is not speaking; speech (onAudioChunk) clears the preview.
   */
  public previewViseme(key: string | null): void {
    if (this.state === 'SPEAKING') return;
    this.resetFaceToNeutral();
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

  /** Selects the lip-sync engine: 'phoneme' (G2P, EN) or 'char' (character table). */
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
   * Called when an audio chunk with alignment is received (docs/2, docs/4)
   */
  public onAudioChunk(alignment: CharAlignment, chunkStartTimeSec: number, epoch: number): void {
    // If the chunk comes from a stale epoch (before the interruption), ignore it
    if (epoch !== this.engine.getEpoch()) {
      return;
    }

    this.epoch = epoch;

    if (this.state === 'RELAXING' || this.state === 'IDLE') {
      this.state = 'SPEAKING';
      this.clearManualOverrideMap();
    }

    // Acoustic fallback (LIPS-07): the RMS-energy alignment drives ONLY the jaw
    // (jawOpen ∝ energy, no false vowels). The per-character loop is skipped.
    if (alignment.source === 'energy-fallback' && alignment.energies) {
      const profile = this.scheduler.getCalibrationProfile();
      const syncOffsetSec = profile.syncOffsetMs / 1000;
      for (let i = 0; i < alignment.chars.length; i++) {
        const energy = alignment.energies[i] ?? 0;
        if (energy <= 0.02) continue; // silence → no viseme (natural decay)
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
      this.clearManualOverrideMap();
      return; // do NOT run the per-character loop for the fallback
    }

    // EN phoneme layer (LIPS-05): character alignment -> ARPAbet phonemes (G2P) -> visemes.
    // Silent letters produce no movement; word timings come from the ElevenLabs alignment.
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
          // An override from the Viseme Editor takes precedence over the default phoneme table.
          const override = this.visemeOverrides.get(span.phoneme);
          const shapes = override ? new Map(override) : mapPhonemeToShapes(span.phoneme);
          if (!shapes || shapes.size === 0) continue; // no pose -> no viseme
          this.scheduler.enqueue({
            epoch,
            char: span.phoneme,
            shapes,
            startTimeSec: chunkStartTimeSec + span.startMs / 1000 + syncOffsetSec,
            durationSec: Math.max(0.035, span.durationMs / 1000),
          });
        }
        return; // the phoneme queue replaces the per-character loop
      }
      // No spans (e.g. non-letter text only) -> fall through to the per-character loop
    }

    // Schedule visemes on the audio timeline
    for (let i = 0; i < alignment.chars.length; i++) {
      const char = alignment.chars[i];
      const startMs = alignment.char_start_times_ms[i] ?? 0;
      const durationMs = alignment.char_durations_ms[i] ?? 50;

      // An override from the Viseme Editor (character path) takes precedence over the character table.
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
   * Static mouth-pose preview for the chosen phoneme (for tests in the calibrator)
   */
  public testPhoneme(phonemeKey: 'A' | 'E' | 'O' | 'U' | 'M' | 'SZ' | 'F' | 'neutral'): void {
    // A calibrator button must never cut a live turn (same guard as previewViseme).
    if (this.state === 'SPEAKING') return;
    this.resetFaceToNeutral();

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
        // Lip closure (M / B / P): lips meet along their natural line, no chin pulled up under the nose
        this.setManualOverride('mouthClose', profile.closeScale);
        this.setManualOverride('jawOpen', 0.04);
        this.setManualOverride('mouthPressLeft', 0.12);
        this.setManualOverride('mouthPressRight', 0.12);
        break;

      case 'SZ':
        // Hushing (SZ / CZ): lips pushed forward into a rounded tunnel, teeth close together and visible
        this.setManualOverride('jawOpen', 0.12 * profile.jawScale);
        this.setManualOverride('mouthFunnel', 0.65 * profile.funnelScale);
        this.setManualOverride('mouthPucker', 0.25 * profile.puckerScale);
        this.setManualOverride('mouthUpperUpLeft', 0.25 * profile.teethExposureScale);
        this.setManualOverride('mouthUpperUpRight', 0.25 * profile.teethExposureScale);
        this.setManualOverride('mouthLowerDownLeft', 0.22 * profile.teethExposureScale);
        this.setManualOverride('mouthLowerDownRight', 0.22 * profile.teethExposureScale);
        break;

      case 'F':
        // Labiodental (F / V): upper incisors rest on the rolled-in lower lip!
        this.setManualOverride('jawOpen', 0.10 * profile.jawScale);
        this.setManualOverride('mouthRollLower', 0.70 * profile.rollScale);
        this.setManualOverride('mouthUpperUpLeft', 0.55 * profile.teethExposureScale);
        this.setManualOverride('mouthUpperUpRight', 0.55 * profile.teethExposureScale);
        this.setManualOverride('mouthShrugLower', 0.20);
        break;
    }
  }

  /**
   * Called immediately on interruption (barge-in from the server or the UI)
   */
  public onInterruption(): void {
    this.scheduler.clear();
    this.frameBuffer = [];
    // A deferred mode change is applied right at the interruption (turn boundary).
    if (this.commitPendingMode()) {
      console.log('[FaceController] Facial interruption -> mode switched');
      return;
    }
    // IDLE stays IDLE (nothing to relax from); RELAXING re-anchors its timer; SPEAKING relaxes.
    if (this.state === 'IDLE') return;
    this.state = 'RELAXING';
    this.relaxStartedAt = performance.now();
    console.log('[FaceController] Facial interruption -> RELAXING state');
  }

  /**
   * Frames track — applies absolute frames (contract v2) on the ctx.currentTime axis.
   * Zero-order hold: keep the last frame with baseSec+timeSec <= now; no smoothing,
   * no addition. Safety: clamp 0..1 + mouthClose cap (FRAME_CLOSE_CAP). Stores
   * currentWeights so RELAXING starts from the last pose. Emotions: when carriesEmotion,
   * the frames carry the expression (A2E), so we do NOT mix; otherwise we add only
   * the shapes NOT owned by the clip (e.g. brows).
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
    // Last frame whose time has come (binary search).
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
      // Before the first frame (turn start) — wait.
      return;
    }

    // Drop consumed frames (older than the current one), keep the current one for the next tick.
    if (idx > 0) this.frameBuffer = buf.slice(idx);
    const frame = this.frameBuffer[0];

    // Apply the shapes owned by the clip (owned = absolute, zero is meaningful).
    for (const shape of meta.shapes) {
      const raw = frame.weights[shape] ?? 0;
      let w = clamp01(raw);
      if (shape === 'mouthClose') w = Math.min(w, FRAME_CLOSE_CAP);
      if (w < 0.001) w = 0;
      this.currentWeights.set(shape, w);
      this.driver.applyWeight(shape, w);
    }

    // Emotions outside the clip — only when the frames do NOT carry their own expression.
    if (!meta.carriesEmotion) {
      for (const [shape, emWeight] of emotionWeights.entries()) {
        if (shape.startsWith('eyeBlink')) continue;
        if (meta.shapes.indexOf(shape) !== -1) continue; // absolute shape — no blending
        const w = clamp01(emWeight);
        this.currentWeights.set(shape, w);
        this.driver.applyWeight(shape, w);
      }
    }

    // End of turn: audio has finished -> frames consumed -> RELAXING from the last pose.
    endTurn();
  }

  /**
   * Main facial update loop, called from the Three.js renderer animation loop (dt in seconds)
   */
  public render(dt: number): void {
    const nowSec = this.audibleClock();

    // 1. Procedural eyelid blinking — skipped when the active clip carries its own eyes
    //    (frames mode + carriesEyes, contract v2). In all other states blinking runs.
    const framesCarryEyes = this.animationMode === 'frames' && this.framesMeta?.carriesEyes === true;
    if (this.blinkProvider && !framesCarryEyes) {
      const blink = this.blinkProvider();
      this.driver.applyWeight('eyeBlinkLeft', blink.left);
      this.driver.applyWeight('eyeBlinkRight', blink.right);
    }

    // 2. Update the emotion-layer weights (REAL-03)
    const emotionWeights = this.emotionLayer.update(dt);

    // 3. Speech apparatus state machine
    switch (this.state) {
      case 'SPEAKING': {
        // Frames track (08-CONTEXT v2): absolute frames applied directly, without the scheduler.
        if (this.animationMode === 'frames') {
          this.updateFrames(nowSec, emotionWeights);
          break;
        }

        const speechShapes = this.driver.listAvailableShapes();
        const updatedWeights = this.scheduler.update(nowSec, dt, this.engine.getEpoch(), speechShapes);

        const activeMouthClose = updatedWeights.get('mouthClose') ?? 0;

        for (const [shape, weight] of updatedWeights.entries()) {
          // Overlay the emotion (e.g. a smile) unless the lips must seal tightly (mouthClose)
          let finalWeight = weight;
          const emWeight = emotionWeights.get(shape) ?? 0;

          if (shape.startsWith('mouthSmile') && activeMouthClose > 0.25) {
            // Suppress the smile on bilabial consonants M/B/P
            finalWeight = weight;
          } else {
            // Subtle emotion influence during speech (30% of the emotion weight) to keep the expression balanced
            finalWeight = Math.min(1.0, weight + emWeight * 0.3);
          }

          this.currentWeights.set(shape, finalWeight);
          this.driver.applyWeight(shape, finalWeight);
        }

        // Overlay emotions not part of the speech visemes (e.g. brows)
        for (const [shape, emWeight] of emotionWeights.entries()) {
          if (!updatedWeights.has(shape) && !shape.startsWith('eyeBlink')) {
            this.driver.applyWeight(shape, emWeight);
          }
        }

        // If the viseme queue has run out and the audio stopped playing -> transition to relaxation
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
        // Cosine ease of the return to neutral
        const relaxFactor = 1 - Math.sin((progress * Math.PI) / 2);

        let maxWeight = 0;
        const availableShapes = this.driver.listAvailableShapes();

        for (const shape of availableShapes) {
          if (shape.startsWith('eyeBlink')) continue;

          const current = this.currentWeights.get(shape) ?? 0;
          const emTarget = emotionWeights.get(shape) ?? 0;
          // Smooth return from the speech pose towards the base emotion
          const next = emTarget + (current - emTarget) * relaxFactor;

          this.currentWeights.set(shape, next);
          this.driver.applyWeight(shape, next);

          if (next > maxWeight) maxWeight = next;
        }

        if (progress >= 1 || maxWeight < 0.005) {
          this.state = 'IDLE';
          this.scheduler.resetAll();
          // Clean up the frames track after relaxation finishes — meta/eyes must not
          // disable blinking in IDLE or hold on to a consumed buffer.
          this.frameBuffer = [];
          this.framesMeta = null;
        }
        break;
      }

      case 'IDLE':
      default:
        // In IDLE we apply a subtle base emotional expression (brows, a gentle smile)
        for (const [shape, emWeight] of emotionWeights.entries()) {
          if (!shape.startsWith('eyeBlink')) {
            this.driver.applyWeight(shape, emWeight);
          }
        }
        break;
    }

    // 4. Apply manual overrides from the HUD test sliders (active only while the agent is not speaking)
    if (this.state !== 'SPEAKING') {
      const currentJaw = this.manualOverrides.get('jawOpen') ?? this.currentWeights.get('jawOpen') ?? 0;
      for (const [shape, val] of this.manualOverrides.entries()) {
        let safeVal = val;
        // Anatomical safeguard against the lower lip riding up onto the nose:
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

      // When the user moves the jawOpen slider, immediately adapt the limit for the active mouthClose
      if (shape === 'jawOpen') {
        const existingClose = this.manualOverrides.get('mouthClose');
        if (existingClose !== undefined) {
          const closeLimit = value + 0.20;
          this.driver.applyWeight('mouthClose', Math.min(existingClose, closeLimit));
        }
      }
    }
  }

  /** Forgets the manual (HUD/preview) overrides without touching the driver. */
  public clearManualOverrideMap(): void {
    this.manualOverrides.clear();
  }

  /**
   * Dev reset: forgets manual overrides AND zero-writes every non-blink shape.
   * Never call this from a speech path — it pops the face for a frame; use clearManualOverrideMap().
   */
  public resetFaceToNeutral(): void {
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

  /** Exports the current viseme overrides (for the Editor / saving). */
  public getVisemeOverridesRecord(): VisemeOverrideMap {
    const record: VisemeOverrideMap = {};
    for (const [key, shapes] of this.visemeOverrides.entries()) {
      record[key] = Object.fromEntries(shapes.entries());
    }
    return record;
  }
}
