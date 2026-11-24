/**
 * PoseRouter — animation source selection policy per TURN (08-03, contract v2).
 *
 * THE per-turn policy point: every "which source drives this turn" decision belongs here, never
 * inside FaceController. Production passes `liveTurn: true` unconditionally (AnimationController.
 * handleAudioChunk) because LIVE turns are always viseme-driven; the compare and demo paths bypass
 * the router on purpose (they manage their own epochs and explicit modes). When streaming A2F
 * (F9/F10) arrives, this function gains per-turn source resolution (streaming health, latency
 * budget) and FaceController does not change.
 *
 * A thin, pure module (no DOM/GPU) — testable. Rules (08-CONTEXT):
 * - LIVE turn (WSS, chunks) → ALWAYS visemes (A2F batch breaks TTFB <1.5 s).
 * - Language ≠ EN → visemes (A2F is trained on EN audio; PL will return later in parallel).
 * - Frames mode requires a healthy source (a2fHealthy); with an unknown server (Phase 8,
 *   synthetic demo) — frames are allowed.
 * Phase 9 adds the /status health check and "no-gap" degradation here (09-04).
 */

import { AnimationMode } from '../types/avatar';

export type AnimationSource = 'viseme' | 'frames';

export interface RouterContext {
  /** Mode selected by the user (HUD switch). */
  mode: AnimationMode;
  /** true = LIVE turn (the agent's WSS stream). */
  liveTurn: boolean;
  /** Utterance language; default 'en'. */
  language?: 'en' | 'pl' | 'other';
  /** false = A2F source unhealthy (status); undefined = unknown/unused (Phase 8). */
  a2fHealthy?: boolean;
}

export function resolveAnimationSource(ctx: RouterContext): AnimationSource {
  if (ctx.liveTurn) return 'viseme';
  const language = ctx.language ?? 'en';
  if (language !== 'en') return 'viseme';
  if (ctx.mode === 'viseme') return 'viseme';
  if (ctx.a2fHealthy === false) return 'viseme';
  return 'frames';
}
