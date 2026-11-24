/**
 * Lip-sync degradation signal for user mode (17-06, LIP-06).
 *
 * Pure state machine over the alignment source of consecutive audio chunks, kept out of the DOM so it is
 * unit-tested directly. The seam is the existing `audio:chunk` event (it already carries
 * `alignment.source`), so no new event and no new telemetry counter is needed.
 *
 *  - an `energy-fallback` chunk shows the chip immediately;
 *  - the chip hides again only after RECOVERY_CHUNKS consecutive chunks with real (ElevenLabs) alignment,
 *    so a single good chunk in a flaky stream does not make it flicker.
 */

import type { CharAlignment } from '../../types/avatar';

/** Consecutive chunks with real alignment required to clear the chip. */
export const RECOVERY_CHUNKS = 2;

export interface DegradationState {
  readonly visible: boolean;
  /** Consecutive non-fallback chunks seen while the chip is visible. */
  readonly cleanStreak: number;
}

export const INITIAL_DEGRADATION: DegradationState = { visible: false, cleanStreak: 0 };

export function nextDegradationState(prev: DegradationState, source: CharAlignment['source']): DegradationState {
  if (source === 'energy-fallback') return { visible: true, cleanStreak: 0 };
  if (!prev.visible) return prev;
  const cleanStreak = prev.cleanStreak + 1;
  return cleanStreak >= RECOVERY_CHUNKS ? INITIAL_DEGRADATION : { visible: true, cleanStreak };
}
