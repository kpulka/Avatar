import { describe, it, expect } from 'vitest';
import { rescaleAlignmentToAudio } from '../src/audio/alignment-rescale';

describe('rescaleAlignmentToAudio (dryf chunk-local alignmentu)', () => {
  const base = {
    chars: [' ', 'm', 'o', 'r', 'n', 'i', 'n', 'g'],
    char_start_times_ms: [0, 60, 120, 180, 240, 300, 360, 420],
    char_durations_ms: [60, 60, 60, 60, 60, 60, 60, 60],
    source: 'elevenlabs' as const,
  };

  it('skaluje tekst (480ms) do pełnej długości audio chunka (569ms) — usunięcie dryfu', () => {
    const out = rescaleAlignmentToAudio(base, 569);
    const factor = 569 / 480;
    expect(out.char_start_times_ms[1]).toBeCloseTo(60 * factor, 3);
    const lastEnd = out.char_start_times_ms[7] + out.char_durations_ms[7];
    expect(lastEnd).toBeCloseTo(569, 3);
    // proporcje wewnątrz zachowane
    expect(out.char_durations_ms[0]).toBeCloseTo(60 * factor, 3);
  });

  it('skala == 1.0 gdy tekst idealnie pokrywa audio', () => {
    const out = rescaleAlignmentToAudio(base, 480);
    expect(out.char_start_times_ms).toEqual(base.char_start_times_ms);
    expect(out.char_durations_ms).toEqual(base.char_durations_ms);
  });

  it('clampuje patologiczny wspolczynnik do zakresu [0.5, 2.0]', () => {
    // 240ms tekstu w 95ms audio → raw 0.40 → clamp 0.50
    const short = {
      chars: ['[', 'n'],
      char_start_times_ms: [0, 120],
      char_durations_ms: [120, 120],
      source: 'elevenlabs' as const,
    };
    const out = rescaleAlignmentToAudio(short, 95);
    const lastEnd = out.char_start_times_ms[1] + out.char_durations_ms[1];
    expect(lastEnd).toBeCloseTo(240 * 0.5, 3);
  });

  it('zwraca bez zmian pusty/nieprawidłowy alignment', () => {
    const empty = { chars: [], char_start_times_ms: [], char_durations_ms: [], source: 'elevenlabs' as const };
    expect(rescaleAlignmentToAudio(empty, 500)).toBe(empty);
    expect(rescaleAlignmentToAudio(base, 0)).toBe(base);
  });

  it('zachowuje source', () => {
    expect(rescaleAlignmentToAudio(base, 569).source).toBe('elevenlabs');
  });
});
