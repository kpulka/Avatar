/**
 * A2F wrapper client (09-03, contract v2 — docs/7 §5).
 *
 * The wrapper owns the JSON format; this module does fetch /predict and /status
 * and returns the result via parseA2fJson (a2f-parser). Testable without a server (mock fetch).
 * AbortController + timeout: barge-in / cancellation aborts predict without a dangling fetch.
 */

import { parseA2fJson, A2fParseResult } from '../lipsync/a2f-parser';

export interface A2fStatus {
  status: string;
  gpu?: string;
  uptime_s?: number;
  model?: string;
}

export interface PredictFramesResult {
  parsed: A2fParseResult;
  predictMs: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_PREDICT_TIMEOUT_MS = 60_000;
const STATUS_TIMEOUT_MS = 2_000;

function combineTimeout(
  timeoutMs: number,
  external?: AbortSignal
): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('A2F: timeout')), timeoutMs);
  const onExternalAbort = () => controller.abort(external?.reason ?? new Error('A2F: cancelled'));
  if (external) {
    if (external.aborted) onExternalAbort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    controller,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const { controller, cleanup } = combineTimeout(timeoutMs, init.signal ?? undefined);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`A2F: HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    cleanup();
  }
}

/** GET /status — quick health check (client-side cache 60 s, see main). */
export async function fetchA2fStatus(baseUrl: string, opts?: RequestOptions): Promise<A2fStatus> {
  const clean = (baseUrl || '').replace(/\/+$/, '');
  return fetchJson<A2fStatus>(`${clean}/status`, {}, opts?.timeoutMs ?? STATUS_TIMEOUT_MS);
}

/**
 * POST /predict — wav → FramesClip (via the parser). Measures predictMs.
 * Abort (barge-in/interruption) and timeout throw a readable error.
 */
export async function predictFrames(
  baseUrl: string,
  wavBlob: Blob,
  opts?: RequestOptions
): Promise<PredictFramesResult> {
  const clean = (baseUrl || '').replace(/\/+$/, '');
  const started = performance.now();

  const form = new FormData();
  form.append('file', wavBlob, 'speech.wav');

  const { controller, cleanup } = combineTimeout(
    opts?.timeoutMs ?? DEFAULT_PREDICT_TIMEOUT_MS,
    opts?.signal
  );
  try {
    const res = await fetch(`${clean}/predict`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`A2F: HTTP ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const parsed = parseA2fJson(text);
    return { parsed, predictMs: Math.round(performance.now() - started) };
  } finally {
    cleanup();
  }
}
