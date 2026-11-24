/**
 * Narrows `T | undefined` to `T` in tests. With `noUncheckedIndexedAccess` every `array[i]` /
 * `record[key]` is possibly undefined; in a test the honest reaction to a missing element is a
 * readable failure, not a silent `!` or a swallowed fallback.
 */
export function defined<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) throw new Error(`expected ${what} to be defined`);
  return value;
}
