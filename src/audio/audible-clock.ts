/**
 * Time (AudioContext seconds) of the sample currently reaching the listener's ears.
 * ctx.currentTime is the RENDER position, ahead of the speakers by output + base latency.
 */
export function getAudibleTime(ctx: AudioContext, nowMs: number = performance.now()): number {
  const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : undefined;
  if (ts && typeof ts.contextTime === 'number' && typeof ts.performanceTime === 'number' && ts.performanceTime > 0) {
    // contextTime was audible at performanceTime -> extrapolate to now; never beyond the render position.
    return Math.min(ctx.currentTime, ts.contextTime + Math.max(0, nowMs - ts.performanceTime) / 1000);
  }
  const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  return Math.max(0, ctx.currentTime - latency);
}

/** Wraps getAudibleTime with a monotonic guard (timestamps can jitter backwards by a few ms). */
export function createAudibleClock(ctx: AudioContext): () => number {
  let last = 0;
  return () => (last = Math.max(last, getAudibleTime(ctx)));
}
