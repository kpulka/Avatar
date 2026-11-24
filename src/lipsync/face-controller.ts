import {
  FaceDriver,
  CharAlignment,
  PoseFrame,
  FramesClip,
  AnimationMode,
  EyeLookWeights,
  GazeProvider,
  FaceTrackContext,
  FaceTrackSource,
} from '../types/avatar';
import { AudioEngine } from '../audio/audio-engine';
import { VisemeScheduler, isSpeechShape } from './viseme-scheduler';
import { mapCharToShapes, charTokenFor, charPathSpan, CharContext, POLISH_CHAR_CONTEXT } from './viseme-mappings';
import { LipSyncEngine, DEFAULT_LIP_SYNC_ENGINE } from './lipsync-engine';
import { charsLookPolish } from './g2p/language';
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
import { ANIM_DEFAULTS, clamp01 } from '../realism/anim-config';
import { allocProbe } from '../realism/alloc-probe';

export type FaceState = 'IDLE' | 'SPEAKING' | 'RELAXING';

const { relax, fallback, viseme, emotion, manual, common, gaze: gazeConfig } = ANIM_DEFAULTS;

/** The eyeLook* morphs owned by the gaze provider (fixed key order, no per-frame Object.entries). */
const EYE_LOOK_SHAPES: ReadonlyArray<keyof EyeLookWeights> = [
  'eyeLookInLeft',
  'eyeLookOutLeft',
  'eyeLookUpLeft',
  'eyeLookDownLeft',
  'eyeLookInRight',
  'eyeLookOutRight',
  'eyeLookUpRight',
  'eyeLookDownRight',
];

/** Anatomical guard on manual overrides: mouthClose may not exceed jawOpen + margin. */
const guardClose = (close: number, jaw: number): number => Math.min(close, jaw + manual.jawGuardMargin);

/** Meta of the active clip in frames mode (08-CONTEXT v2). */
interface FrameMeta {
  shapes: readonly string[];
  /** Same shapes as a Set — O(1) ownership lookups per frame (built once per clip). */
  shapeSet: ReadonlySet<string>;
  carriesEyes: boolean;
}

export interface FaceControllerOptions {
  /** Time (AudioContext seconds) currently audible; defaults to the latency-compensated audio clock. */
  audibleClock?: () => number;
  /** Wall clock in milliseconds for RELAXING / turn boundaries; defaults to performance.now. */
  nowMs?: () => number;
  /** Test/debug only: enables the allocation probe (see alloc-probe.ts). */
  debugAllocations?: boolean;
}

/**
 * FaceController — state machine (IDLE -> SPEAKING -> RELAXING -> IDLE).
 * The only module in the whole system allowed to write weights to FaceDriver (docs/4).
 *
 * TIMEBASE CONTRACT — one clock per concern, no arithmetic across clocks:
 *   - AUDIO clock (`audibleClock`, AudioContext seconds compensated for output latency) owns
 *     everything that must agree with what is heard: viseme scheduling, frames playback
 *     (baseSec + timeSec), the end-of-turn test (`hasPendingAudio`). Blink uses the raw
 *     `ctx.currentTime` on purpose (it is not lip-synced, only needs a monotonic time).
 *   - WALL clock (`nowMs`, default performance.now) owns RELAXING and the turn-boundary
 *     re-anchoring: the 150 ms ease-out is a UI-time ramp, not an audio event, so it must not
 *     stall when the audio context is suspended. Injectable so tests drive it by hand.
 *   - rAF timestamp / `dt` (seconds, capped at 0.1 s by the render loop) owns damping
 *     (`1 - exp(-lambda * dt)`, FPS independent), emotion cross-fade and gaze/saccade scheduling.
 *     The dt cap makes integrators run in deliberate slow motion under very long frames.
 */
export class FaceController {
  private readonly driver: FaceDriver;
  private readonly engine: AudioEngine;
  private readonly audibleClock: () => number;
  private readonly nowMs: () => number;
  private readonly scheduler: VisemeScheduler;
  private readonly blinker: ProceduralBlink;
  private readonly emotionLayer: EmotionLayer;

  private state: FaceState = 'IDLE';
  private relaxStartedAt = 0;

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
  // Procedural eye-look morph weights (data only — this class stays the single morph writer)
  private gazeProvider: GazeProvider | null = null;
  // Track source dispatch table (16-06): id -> adapter. Built-ins: 'viseme', 'frames'.
  private readonly trackSources: Map<string, FaceTrackSource> = new Map();
  private readonly trackContext: FaceTrackContext;
  // Speech-owned shapes (jaw/mouth/tongue/cheek/nose) — the only shapes the viseme scheduler may drive
  private readonly speechShapeList: string[];

  // Character-to-shape mapping function
  private charMapper: (chars: string[], index: number, context?: CharContext) => Map<string, number> = mapCharToShapes;

  // Lip-sync engine: 'phoneme-en' / 'phoneme-pl' = G2P layer per language, 'char' = character table (fallback)
  private lipSyncEngine: LipSyncEngine = DEFAULT_LIP_SYNC_ENGINE;

  // Per-VISEME blendshape pose overrides (Viseme Editor, localStorage) —
  // they take precedence over the default mapping tables.
  private readonly visemeOverrides: Map<string, Map<string, number>> = new Map();

  constructor(driver: FaceDriver, engine: AudioEngine, options: FaceControllerOptions = {}) {
    this.driver = driver;
    this.engine = engine;
    // Mouth timing follows the time actually HEARD (output latency compensated), not the render position.
    this.audibleClock = options.audibleClock ?? createAudibleClock(engine.ctx);
    this.nowMs = options.nowMs ?? (() => performance.now());
    if (options.debugAllocations) {
      allocProbe.enabled = true;
      allocProbe.reset();
    }
    this.scheduler = new VisemeScheduler();
    this.speechShapeList = driver.listAvailableShapes().filter(isSpeechShape);
    this.trackContext = {
      feedFrames: (clip, baseSec, epoch) => this.feedFrames(clip, baseSec, epoch),
      feedAlignment: (alignment, startTimeSec, epoch) => this.onAudioChunk(alignment, startTimeSec, epoch),
      interrupt: () => this.onInterruption(),
    };
    this.registerTrackSource('viseme', {
      kind: 'viseme',
      start: () => {},
      feed: (payload, epoch) => {
        const { alignment, startTimeSec } = payload as { alignment: CharAlignment; startTimeSec: number };
        this.trackContext.feedAlignment(alignment, startTimeSec, epoch);
      },
      stop: () => this.trackContext.interrupt(),
    });
    this.registerTrackSource('frames', {
      kind: 'frames',
      start: () => {},
      feed: (payload, epoch) => {
        const { clip, baseSec } = payload as { clip: FramesClip; baseSec: number };
        this.trackContext.feedFrames(clip, baseSec, epoch);
      },
      stop: () => this.trackContext.interrupt(),
    });
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

  /**
   * Registers a track source adapter under `id` (overwrites). The adapter only routes data into
   * the existing tracks — the state machine, epoch guard and safety clamps stay in FaceController.
   */
  public registerTrackSource(id: string, source: FaceTrackSource): void {
    this.trackSources.set(id, source);
  }

  /** Activates a registered source: switches to its track at a safe boundary, then calls start(). */
  public startTrack(id: string): boolean {
    const source = this.trackSources.get(id);
    if (!source) {
      console.warn(`[FaceController] Unknown track source '${id}'`);
      return false;
    }
    this.setAnimationMode(source.kind, { deferToTurnEnd: this.state === 'SPEAKING' });
    source.start(this.trackContext);
    return true;
  }

  /** Dispatches a payload to a registered source (table lookup — no per-source branching here). */
  public feedTrack(id: string, payload: unknown, epoch: number): boolean {
    const source = this.trackSources.get(id);
    if (!source) {
      console.warn(`[FaceController] Unknown track source '${id}'`);
      return false;
    }
    source.feed(payload, epoch);
    return true;
  }

  /** Ends a source's turn (adapter decides; built-ins interrupt the face). */
  public stopTrack(id: string): boolean {
    const source = this.trackSources.get(id);
    if (!source) return false;
    source.stop(this.engine.getEpoch());
    return true;
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
      // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
      console.log(`[FaceController] Animation mode → ${mode} (IDLE)`);
      return;
    }
    this.clearManualOverrideMap();
    this.state = 'RELAXING';
    this.relaxStartedAt = this.nowMs();
    // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
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

    // One source at a time: drop any visemes left over from the previous track.
    this.scheduler.clear();
    if (this.state === 'RELAXING' || this.state === 'IDLE') {
      this.state = 'SPEAKING';
      this.clearManualOverrideMap();
    }

    this.frameBaseSec = baseSec;
    this.frameBuffer = [...clip.frames].sort((a, b) => a.timeSec - b.timeSec);
    const ownedShapes = clip.shapes ?? [];
    this.framesMeta = {
      shapes: ownedShapes,
      shapeSet: new Set(ownedShapes),
      carriesEyes: clip.carriesEyes === true,
    };
    // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
    console.log(
      `[FaceController] feedFrames: ${this.frameBuffer.length} frames, base=${baseSec.toFixed(3)}s, ` +
        `shapes=${this.framesMeta.shapes.length}, eyes=${this.framesMeta.carriesEyes}`
    );
  }

  /** Number of pending frames (frames track). */
  public getFrameQueueLength(): number {
    return this.frameBuffer.length;
  }

  /**
   * Sets/overrides the pose of a single viseme (the shape map is copied). */
  public setVisemeOverride(key: string, shapes: Map<string, number>): void {
    const clean = new Map<string, number>();
    for (const [shape, value] of shapes.entries()) {
      if (value > common.snapEpsilon) clean.set(shape, clamp01(value));
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

  public setCharMapper(mapper: (chars: string[], index: number, context?: CharContext) => Map<string, number>): void {
    this.charMapper = mapper;
  }

  /** Selects the lip-sync engine: 'phoneme-en' / 'phoneme-pl' (G2P per language) or 'char' (character table). */
  public setLipSyncEngine(engine: LipSyncEngine): void {
    this.lipSyncEngine = engine;
    this.scheduler.clear();
  }

  public setBlinkProvider(provider: () => { left: number; right: number }): void {
    this.blinkProvider = provider;
  }

  /**
   * Registers the procedural gaze source (eyeLook* weights, data only — mirrors the blink
   * provider). FaceController applies them itself, so it stays the only morph writer.
   */
  public setGazeProvider(provider: GazeProvider | null): void {
    this.gazeProvider = provider;
  }

  /**
   * True while procedural eye writers (blink, gaze morphs AND the eyeball bones driven by the
   * scene) may act — false when the active frames clip carries its own eyes (A2F).
   */
  public areProceduralEyesActive(): boolean {
    return this.eyeWritersAllowed();
  }

  private eyeWritersAllowed(): boolean {
    return !(this.animationMode === 'frames' && this.framesMeta?.carriesEyes === true);
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
        if (energy <= fallback.skipEnergyBelow) continue; // silence → no viseme (natural decay)
        const startMs = alignment.char_start_times_ms[i] ?? 0;
        const durationMs = alignment.char_durations_ms[i] ?? 70;
        this.scheduler.enqueue({
          epoch,
          char: '#energy',
          shapes: new Map([['jawOpen', Math.min(fallback.jawCap, energy * fallback.jawScale)]]),
          startTimeSec: chunkStartTimeSec + startMs / 1000 + syncOffsetSec,
          durationSec: Math.max(fallback.minDurationSec, durationMs / 1000),
        });
      }
      this.state = 'SPEAKING';
      this.clearManualOverrideMap();
      return; // do NOT run the per-character loop for the fallback
    }

    // Phoneme layer (LIPS-05, 17-04): character alignment -> phonemes (EN: CMUdict G2P, PL: rules) -> visemes.
    // Silent letters produce no movement; word timings come from the ElevenLabs alignment. The Polish engine
    // needs no lexicon, so it does not wait for the English dictionary.
    const polishEngine = this.lipSyncEngine === 'phoneme-pl';
    if (
      (this.lipSyncEngine === 'phoneme-en' || polishEngine) &&
      (polishEngine || (g2pAvailable() && isG2pReady())) &&
      (alignment.source === undefined || alignment.source === 'elevenlabs')
    ) {
      const spans = mergeCharAlignmentToPhonemes(alignment, { defaultLanguage: polishEngine ? 'pl' : 'en' });
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
            durationSec: Math.max(viseme.minDurationSec, span.durationMs / 1000),
          });
        }
        return; // the phoneme queue replaces the per-character loop
      }
      // No spans (e.g. non-letter text only) -> fall through to the per-character loop
    }

    // Character path language context (17-04): the Polish engine, or a chunk with Polish evidence,
    // switches the "ch" digraph to the Polish velar fricative. One scan per chunk, no allocation.
    const charContext = this.lipSyncEngine === 'phoneme-pl' || charsLookPolish(alignment.chars) ? POLISH_CHAR_CONTEXT : undefined;

    // Schedule visemes on the audio timeline
    for (let i = 0; i < alignment.chars.length; i++) {
      const char = alignment.chars[i] ?? ''; // i < alignment.chars.length
      const startMs = alignment.char_start_times_ms[i] ?? 0;
      // A consonant digraph (th, sh, ch ...) is ONE viseme: it spans both letters and the second
      // letter is skipped, so it never fires a phantom pulse of its own.
      const span = charPathSpan(alignment.chars, i);
      const durationMs =
        (alignment.char_durations_ms[i] ?? 50) + (span === 2 ? (alignment.char_durations_ms[i + 1] ?? 0) : 0);

      // An override from the Viseme Editor (character path) takes precedence over the character table.
      let shapes: Map<string, number>;
      const token = charTokenFor(alignment.chars, i);
      const tokenOverride = token ? this.visemeOverrides.get(token) : undefined;
      if (tokenOverride) {
        shapes = new Map(tokenOverride);
      } else {
        shapes = this.charMapper(alignment.chars, i, charContext);
      }

      const profile = this.scheduler.getCalibrationProfile();
      const syncOffsetSec = profile.syncOffsetMs / 1000;

      this.scheduler.enqueue({
        epoch,
        char,
        shapes,
        startTimeSec: chunkStartTimeSec + startMs / 1000 + syncOffsetSec,
        durationSec: Math.max(viseme.minDurationSec, durationMs / 1000),
      });
      i += span - 1; // skip the second letter of a digraph
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
      this.relaxStartedAt = this.nowMs();
      return;
    }

    // The calibrator vocabulary (A/E/O/U/M/SZ/F) reads the SAME tables as live speech (single source
    // of truth, 17-02): M and F come from the phoneme table, A/E/O/U/SZ from the character table.
    // Table values are effective targets; the profile scale is applied exactly as the scheduler does it.
    const shapes = defaultVisemeShapes(phonemeKey);
    if (!shapes) return;
    for (const [shape, value] of shapes.entries()) {
      this.setManualOverride(shape, value * this.scheduler.scaleForShape(shape));
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
      // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
      console.log('[FaceController] Facial interruption -> mode switched');
      return;
    }
    // IDLE stays IDLE (nothing to relax from); RELAXING re-anchors its timer; SPEAKING relaxes.
    if (this.state === 'IDLE') return;
    this.state = 'RELAXING';
    this.relaxStartedAt = this.nowMs();
    // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
    console.log('[FaceController] Facial interruption -> RELAXING state');
  }

  /**
   * Frames track — applies absolute frames (contract v2) on the audible audio-clock axis.
   * Zero-order hold: keep the last frame with baseSec+timeSec <= now; no smoothing,
   * no addition. Safety: clamp 0..1 + mouthClose cap (common.mouthCloseCap). Stores
   * currentWeights so RELAXING starts from the last pose. Emotions: only the shapes NOT
   * owned by the clip (e.g. brows) receive the base emotion, at emotion.mixFactorSpeaking —
   * the same policy as the viseme track.
   */
  private updateFrames(nowSec: number, emotionWeights: ReadonlyMap<string, number>): void {
    const meta = this.framesMeta;
    const base = this.frameBaseSec;

    if (!meta || this.frameBuffer.length === 0) {
      this.endTurnIfDrained();
      return;
    }

    const buf = this.frameBuffer;
    // Last frame whose time has come (binary search).
    let lo = 0;
    let hi = buf.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (base + (buf[mid]?.timeSec ?? Infinity) <= nowSec) { // mid in [lo, hi] within buf
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
    // In place (copyWithin + length): no slice() copy per consumed frame.
    if (idx > 0) {
      buf.copyWithin(0, idx);
      buf.length -= idx;
    }
    const frame = buf[0];
    if (!frame) return; // idx >= 0 means at least one frame survives the drop above

    // Apply the shapes owned by the clip (owned = absolute, zero is meaningful).
    for (const shape of meta.shapes) {
      const raw = frame.weights[shape] ?? 0;
      let w = clamp01(raw);
      if (shape === 'mouthClose') w = Math.min(w, common.mouthCloseCap);
      if (w < common.snapEpsilon) w = 0;
      this.currentWeights.set(shape, w);
      this.driver.applyWeight(shape, w);
    }

    // Emotions outside the clip: same mix as the viseme track (one policy for both).
    for (const [shape, emWeight] of emotionWeights.entries()) {
      if (shape.startsWith('eyeBlink')) continue;
      if (meta.shapeSet.has(shape)) continue; // absolute shape — no blending
      const w = clamp01(emWeight * emotion.mixFactorSpeaking);
      this.currentWeights.set(shape, w);
      this.driver.applyWeight(shape, w);
    }

    // End of turn: audio has finished -> frames consumed -> RELAXING from the last pose.
    this.endTurnIfDrained();
  }

  /** Frames track end-of-turn: once the audio has drained, commit a pending mode or relax. */
  private endTurnIfDrained(): void {
    if (this.engine.hasPendingAudio()) return;
    if (this.commitPendingMode()) return;
    this.state = 'RELAXING';
    this.relaxStartedAt = this.nowMs();
  }

  /**
   * Main facial update loop, called from the Three.js renderer animation loop (dt in seconds).
   *
   * Write order per frame (the layer-composition contract, later writers win):
   *   1. blink            eyeBlink*      (skipped when the frames clip carries its own eyes)
   *   2. gaze morphs      eyeLook*       (via the gaze provider; same carriesEyes gate as blink)
   *   3. scheduler        jaw/mouth/tongue/cheek/nose ONLY (speech subset — never eye/brow regions)
   *   4. emotion mix      emotion.mixFactorSpeaking on speech shapes + the non-speech emotion shapes
   *      (or, in frames mode: clip-absolute shapes first, then the same emotion mix on the rest)
   *   5. manual overrides HUD sliders / previews, only while not SPEAKING
   * Clocks: speech/frames use the audible audio clock, RELAXING the wall clock (see 16-03).
   */
  public render(dt: number): void {
    const nowSec = this.audibleClock();

    // 1. Procedural eyelid blinking — skipped when the active clip carries its own eyes
    //    (frames mode + carriesEyes, contract v2). In all other states blinking runs.
    const eyesAllowed = this.eyeWritersAllowed();
    if (this.blinkProvider && eyesAllowed) {
      const blink = this.blinkProvider();
      this.driver.applyWeight('eyeBlinkLeft', blink.left);
      this.driver.applyWeight('eyeBlinkRight', blink.right);
    }

    // 2. Procedural gaze morphs (single-writer seam): applied here, never by the scene directly.
    const gazeActive = this.gazeProvider !== null && eyesAllowed;
    if (gazeActive) {
      const gaze = this.gazeProvider!();
      if (gaze) {
        for (let i = 0; i < EYE_LOOK_SHAPES.length; i++) {
          const shape = EYE_LOOK_SHAPES[i];
          if (!shape) continue; // i < EYE_LOOK_SHAPES.length
          this.driver.applyWeight(shape, gaze[shape] * gazeConfig.morphWeight);
        }
      }
    }

    // Update the emotion-layer weights (REAL-03)
    const emotionWeights = this.emotionLayer.update(dt);

    // 3. Speech apparatus state machine
    switch (this.state) {
      case 'SPEAKING': {
        // Frames track (08-CONTEXT v2): absolute frames applied directly, without the scheduler.
        if (this.animationMode === 'frames') {
          this.updateFrames(nowSec, emotionWeights);
          break;
        }

        // The scheduler only sees the speech subset, so its foundation rule (no contribution ->
        // decay to 0) can never zero eye/brow regions owned by gaze or emotion.
        const updatedWeights = this.scheduler.update(nowSec, dt, this.engine.getEpoch(), this.speechShapeList);

        const activeMouthClose = updatedWeights.get('mouthClose') ?? 0;

        for (const [shape, weight] of updatedWeights.entries()) {
          // Overlay the emotion (e.g. a smile) unless the lips must seal tightly (mouthClose)
          let finalWeight: number;
          const emWeight = emotionWeights.get(shape) ?? 0;

          if (shape.startsWith('mouthSmile') && activeMouthClose > emotion.smileSuppressClose) {
            // Suppress the smile on bilabial consonants M/B/P
            finalWeight = weight;
          } else {
            // Subtle emotion influence during speech to keep the expression balanced
            finalWeight = Math.min(1.0, weight + emWeight * emotion.mixFactorSpeaking);
          }

          this.currentWeights.set(shape, finalWeight);
          this.driver.applyWeight(shape, finalWeight);
        }

        // Emotion shapes outside the speech subset (brows, eyeWide, ...): the scheduler does not
        // own them, so they get the same emotion mix as speech shapes. eyeLook* belongs to gaze.
        for (const [shape, emWeight] of emotionWeights.entries()) {
          if (isSpeechShape(shape) || shape.startsWith('eyeBlink')) continue;
          if (gazeActive && shape.startsWith('eyeLook')) continue;
          const w = clamp01(emWeight * emotion.mixFactorSpeaking);
          this.currentWeights.set(shape, w);
          this.driver.applyWeight(shape, w);
        }

        // If the viseme queue has run out and the audio stopped playing -> transition to relaxation
        if (this.scheduler.getQueueLength() === 0 && !this.engine.hasPendingAudio()) {
          if (this.commitPendingMode()) break;
          this.state = 'RELAXING';
          this.relaxStartedAt = this.nowMs();
        }
        break;
      }

      case 'RELAXING': {
        const elapsedMs = this.nowMs() - this.relaxStartedAt;
        const progress = Math.min(1, elapsedMs / relax.durationMs);
        // Cosine ease of the return to neutral
        const relaxFactor = 1 - Math.sin((progress * Math.PI) / 2);

        let maxWeight = 0;
        const availableShapes = this.driver.listAvailableShapes();

        for (const shape of availableShapes) {
          if (shape.startsWith('eyeBlink')) continue;
          if (gazeActive && shape.startsWith('eyeLook')) continue; // gaze owns these this frame

          const current = this.currentWeights.get(shape) ?? 0;
          const emTarget = emotionWeights.get(shape) ?? 0;
          // Smooth return from the speech pose towards the base emotion
          const next = emTarget + (current - emTarget) * relaxFactor;

          // Zero-to-zero: nothing visible to write (saves driver writes x sub-meshes per frame).
          if (current < common.snapEpsilon && Math.abs(current - next) < common.snapEpsilon) continue;

          this.currentWeights.set(shape, next);
          this.driver.applyWeight(shape, next);

          if (next > maxWeight) maxWeight = next;
        }

        if (progress >= 1 || maxWeight < relax.finishEpsilon) {
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
        // Anatomical safeguard against the lower lip riding up onto the nose:
        this.driver.applyWeight(shape, shape === 'mouthClose' ? guardClose(val, currentJaw) : val);
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
        safeVal = guardClose(value, currentJaw);
      }
      this.driver.applyWeight(shape, safeVal);

      // When the user moves the jawOpen slider, immediately adapt the limit for the active mouthClose
      if (shape === 'jawOpen') {
        const existingClose = this.manualOverrides.get('mouthClose');
        if (existingClose !== undefined) {
          this.driver.applyWeight('mouthClose', guardClose(existingClose, value));
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

  /** Pending visemes in the scheduler (viseme track). */
  public getVisemeQueueLength(): number {
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
