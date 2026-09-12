/**
 * PoseRouter — polityka wyboru źródła animacji per TURA (08-03, kontrakt v2).
 *
 * Cienki, czysty moduł (bez DOM/GPU) — testowalny. Zasady (08-CONTEXT):
 * - LIVE tura (WSS, chunki) → ZAWSZE wizemy (A2F-batch łamie TTFB <1,5 s).
 * - Język ≠ EN → wizemy (A2F trenowany na audio EN; PL wróci później równolegle).
 * - Tryb frames wymaga zdrowego źródła (a2fHealthy); gdy nieznany serwer (Faza 8,
 *   demo syntetyczne) — frames dozwolone.
 * W Fazie 9 dochodzi tu health-check /status i degradacja "bez dziury" (09-04).
 */

import { AnimationMode } from '../types/avatar';

export type AnimationSource = 'viseme' | 'frames';

export interface RouterContext {
  /** Tryb wybrany przez użytkownika (przełącznik HUD). */
  mode: AnimationMode;
  /** true = tura LIVE (strumień WSS agenta). */
  liveTurn: boolean;
  /** Język wypowiedzi; domyślnie 'en'. */
  language?: 'en' | 'pl' | 'other';
  /** false = źródło A2F niezdrowe (status); undefined = nieznane/nieużywane (Faza 8). */
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
