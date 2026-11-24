/**
 * Opt-in allocation probe (16-05). Disabled by default: instrumented sites guard with
 * `if (allocProbe.enabled)`, so the cost when off is one predictable branch.
 *
 * Sites that record are the ones where the pre-refactor code allocated per frame and the
 * current code must not: any hit during a rendered SPEAKING frame means the hot path regressed
 * (e.g. someone called EmotionLayer.takeWeights() — an owned copy — from render()).
 * tests/hot-path-allocations.test.ts additionally counts real Map/Set/array constructions
 * independently of this probe.
 */
export const allocProbe = {
  enabled: false,
  count: 0,
  record(): void {
    this.count++;
  },
  reset(): void {
    this.count = 0;
  },
};
