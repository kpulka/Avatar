// @vitest-environment jsdom
/**
 * User-mode degradation chip (17-06, LIP-06): the pure state machine and its status-pill wiring.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_DEGRADATION, RECOVERY_CHUNKS, nextDegradationState, DegradationState } from '../src/ui/user/lipsync-degradation';
import { createStatusPill } from '../src/ui/user/status-pill';
import { createUiFixture } from './helpers/ui-fixtures';
import { t } from '../src/app/copy';
import type { CharAlignment } from '../src/types/avatar';

function run(sources: Array<CharAlignment['source']>): DegradationState {
  return sources.reduce(nextDegradationState, INITIAL_DEGRADATION);
}

describe('nextDegradationState', () => {
  it('starts hidden and stays hidden on real alignment', () => {
    expect(INITIAL_DEGRADATION.visible).toBe(false);
    expect(run(['elevenlabs', 'elevenlabs', undefined]).visible).toBe(false);
  });

  it('an energy-fallback chunk shows the chip immediately', () => {
    expect(run(['elevenlabs', 'energy-fallback']).visible).toBe(true);
  });

  it('clears only after RECOVERY_CHUNKS (2) consecutive real chunks', () => {
    expect(RECOVERY_CHUNKS).toBe(2);
    expect(run(['energy-fallback', 'elevenlabs']).visible).toBe(true);
    expect(run(['energy-fallback', 'elevenlabs', 'elevenlabs']).visible).toBe(false);
  });

  it('a fallback chunk in the middle resets the recovery streak (no flicker)', () => {
    expect(run(['energy-fallback', 'elevenlabs', 'energy-fallback', 'elevenlabs']).visible).toBe(true);
    expect(run(['energy-fallback', 'elevenlabs', 'energy-fallback', 'elevenlabs', 'elevenlabs']).visible).toBe(false);
  });

  it('a chunk without a source tag counts as real alignment', () => {
    expect(run(['energy-fallback', undefined, undefined]).visible).toBe(false);
  });
});

describe('status pill degradation chip', () => {
  function mountPill() {
    const fixture = createUiFixture();
    createStatusPill().mount(fixture.ctx);
    const chip = fixture.host.querySelector('.lipsync-chip') as HTMLElement;
    const chunk = (source: CharAlignment['source']) =>
      fixture.events.emit('audio:chunk', {
        bytes: new Uint8Array(0),
        alignment: { chars: ['a'], char_start_times_ms: [0], char_durations_ms: [50], source },
        epoch: 0,
        startTime: 0,
        sampleRate: 16000,
      });
    return { fixture, chip, chunk };
  }

  it('exists, hidden by default, labelled through the copy registry', () => {
    const { chip } = mountPill();
    expect(chip).not.toBeNull();
    expect(chip.hasAttribute('hidden')).toBe(true);
    expect(chip.textContent).toBe(t('chip.simplifiedLipsync'));
    expect(chip.textContent).toBe('Simplified lip-sync');
  });

  it('appears on a forced fallback chunk and clears on recovery', () => {
    const { chip, chunk } = mountPill();
    chunk('energy-fallback');
    expect(chip.hasAttribute('hidden')).toBe(false);
    chunk('elevenlabs');
    expect(chip.hasAttribute('hidden')).toBe(false);
    chunk('elevenlabs');
    expect(chip.hasAttribute('hidden')).toBe(true);
  });

  it('a finished session (voice idle) clears a stale chip', () => {
    const { fixture, chip, chunk } = mountPill();
    chunk('energy-fallback');
    expect(chip.hasAttribute('hidden')).toBe(false);
    fixture.events.emit('voice:state', 'idle');
    expect(chip.hasAttribute('hidden')).toBe(true);
  });

  it('is announced politely as a status and removed with the panel', () => {
    const fixture = createUiFixture();
    const handle = createStatusPill().mount(fixture.ctx);
    const chip = fixture.host.querySelector('.lipsync-chip') as HTMLElement;
    expect(chip.getAttribute('role')).toBe('status');
    handle.destroy();
    expect(fixture.host.querySelector('.lipsync-chip')).toBeNull();
  });
});
