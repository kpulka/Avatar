import { describe, expect, it, vi } from 'vitest';
import { TypedEventBus, disposables } from '../src/app/events';

interface TestEvents extends Record<string, unknown> {
  ping: { n: number };
  pong: string;
}

describe('TypedEventBus', () => {
  it('dostarcza payload do subskrybentów', () => {
    const bus = new TypedEventBus<TestEvents>();
    const seen: number[] = [];
    bus.on('ping', (payload) => seen.push(payload.n));
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(seen).toEqual([1, 2]);
  });

  it('off usuwa handler', () => {
    const bus = new TypedEventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('pong', handler);
    bus.off('pong', handler);
    bus.emit('pong', 'x');
    expect(handler).not.toHaveBeenCalled();
  });

  it('odpięcie handlera w trakcie emisji nie gubi pozostałych', () => {
    const bus = new TypedEventBus<TestEvents>();
    const calls: string[] = [];
    const offA = bus.on('ping', () => {
      calls.push('a');
      offA();
    });
    bus.on('ping', () => calls.push('b'));
    bus.emit('ping', { n: 1 });
    expect(calls).toEqual(['a', 'b']);
    bus.emit('ping', { n: 2 });
    expect(calls).toEqual(['a', 'b', 'b']);
  });

  it('podwójny unsub jest bezpieczny', () => {
    const bus = new TypedEventBus<TestEvents>();
    const unsub = bus.on('ping', () => undefined);
    unsub();
    expect(() => unsub()).not.toThrow();
  });

  it('błąd jednego handlera nie przerywa emisji', () => {
    const bus = new TypedEventBus<TestEvents>();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const second = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', second);
    bus.emit('ping', { n: 1 });
    expect(second).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('disposables', () => {
  it('dispose woła wszystkie zebrane Unsub raz', () => {
    const a = vi.fn();
    const b = vi.fn();
    const bag = disposables();
    bag.add(a);
    bag.add(b);
    expect(bag.size()).toBe(2);
    bag.dispose();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    bag.dispose();
    expect(a).toHaveBeenCalledTimes(1);
    expect(bag.size()).toBe(0);
  });
});
