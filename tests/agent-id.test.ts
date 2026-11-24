import { describe, it, expect } from 'vitest';
import { resolveAgentId, DEFAULT_AGENT_CONFIG } from '../src/audio/agent-config';
import { SettingsStore } from '../src/app/store/settings-store';
import { attachLegacyBridge } from '../src/app/store/legacy-bridge';
import { createMemoryStorage } from './helpers/memory-storage';

describe('resolveAgentId', () => {
  it('prefers a non-empty URL parameter', () => {
    expect(resolveAgentId('agent_store', '?agent_id=agent_url')).toEqual({ id: 'agent_url', source: 'url' });
  });
  it('falls back to the store value', () => {
    expect(resolveAgentId('agent_store', '')).toEqual({ id: 'agent_store', source: 'settings' });
  });
  it('ignores blank values and falls back to the default', () => {
    expect(resolveAgentId('   ', '?agent_id=%20')).toEqual({ id: DEFAULT_AGENT_CONFIG.agentId, source: 'default' });
  });
});

describe('agent id persistence', () => {
  it('a saved agent survives an unrelated settings write and a reload', () => {
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    const unsub = attachLegacyBridge(store, storage);
    store.setStudio('agentId', 'agent_byo123');
    store.setUser('volume', 0.5);
    expect(store.getEffective<string>('agentId')).toBe('agent_byo123');
    unsub();
    const reloaded = new SettingsStore(storage);
    expect(reloaded.getEffective<string>('agentId')).toBe('agent_byo123');
  });
  it('the legacy bridge no longer writes elevenlabs_agent_id', () => {
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    attachLegacyBridge(store, storage);
    store.setStudio('agentId', 'agent_byo123');
    expect(storage.getItem('elevenlabs_agent_id')).toBeNull();
  });
});
