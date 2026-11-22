/**
 * PoseRouter — animation source selection policy per TURN (08-03, contract v2).
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
