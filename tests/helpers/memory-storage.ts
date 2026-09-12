/**
 * Wspólny fake localStorage dla testów (wzorowany na tests/calibration.test.ts).
 */

export interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  dump(): Record<string, string>;
}

export function createMemoryStorage(seed: Record<string, string> = {}): MemoryStorage {
  const map: Record<string, string> = { ...seed };
  return {
    getItem: (key: string) => (key in map ? map[key] : null),
    setItem: (key: string, value: string) => {
      map[key] = value;
    },
    removeItem: (key: string) => {
      delete map[key];
    },
    dump: () => ({ ...map }),
  };
}
