import { describe, it, expect, beforeEach } from 'vitest';
import { ModelCache } from '../src/avatar/model-cache';

describe('ModelCache (PROD-01)', () => {
  let cache: ModelCache;

  beforeEach(() => {
    cache = new ModelCache();
  });

  it('stores and retrieves model ArrayBuffer from cache', async () => {
    const fakeModelData = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00]).buffer;

    await cache.putModel('test-avatar-v1', fakeModelData);

    const exists = await cache.hasModel('test-avatar-v1');
    expect(exists).toBe(true);

    const retrieved = await cache.getModel('test-avatar-v1');
    expect(retrieved).not.toBeNull();
    expect(new Uint8Array(retrieved!)[0]).toBe(0x67);
  });

  it('returns null for non-existent model', async () => {
    const nonExistent = await cache.getModel('unknown-model');
    expect(nonExistent).toBeNull();
  });

  it('clears all cached models on clearCache()', async () => {
    const dummy = new Uint8Array([1, 2, 3]).buffer;
    await cache.putModel('model-1', dummy);
    await cache.putModel('model-2', dummy);

    expect(await cache.hasModel('model-1')).toBe(true);

    await cache.clearCache();

    expect(await cache.hasModel('model-1')).toBe(false);
    expect(await cache.hasModel('model-2')).toBe(false);
  });
});
