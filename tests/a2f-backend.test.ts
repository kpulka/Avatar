import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { predictFrames, fetchA2fStatus } from '../src/audio/a2f-backend';

function okResponse(body: string | object, status = 200): Response {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    json: async () => JSON.parse(json),
    text: async () => json,
  } as unknown as Response;
}

describe('a2f-backend (09-03, klient wrappera /predict)', () => {
  const fetchMock = vi.fn();
  const samples = {
    ok: JSON.stringify({
      fps: 60,
      frames: [
        { frame_time: 0.0, blendshapes: { JawOpen: 0.1, EyeBlinkLeft: 0.0 } },
        { frame_time: 0.5, blendshapes: { JawOpen: 0.4 } },
      ],
      carriesEyes: true,
    }),
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('predictFrames: poprawna odpowiedź → FramesClip (parser) + predictMs', async () => {
    fetchMock.mockResolvedValue(okResponse(samples.ok));
    const wav = new Blob(['fake-wav'], { type: 'audio/wav' });
    const res = await predictFrames('http://127.0.0.1:8000', wav);

    expect(res.parsed.clip.frames).toHaveLength(2);
    expect(res.parsed.clip.fps).toBe(60);
    expect(res.parsed.clip.carriesEyes).toBe(true);
    expect(res.parsed.clip.frames[0].weights['jawOpen']).toBe(0.1);
    expect(typeof res.predictMs).toBe('number');

    // Wysłano FormData na /predict.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8000/predict');
    expect(init.method).toBe('POST');
    expect(init.body instanceof FormData).toBe(true);
  });

  it('usuwa końcowy slash z baseUrl', async () => {
    fetchMock.mockResolvedValue(okResponse(samples.ok));
    await predictFrames('http://127.0.0.1:8000/', new Blob(['x']));
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8000/predict');
  });

  it('HTTP 500 → czytelny błąd', async () => {
    fetchMock.mockResolvedValue(okResponse({ error: 'boom' }, 500));
    await expect(predictFrames('http://x', new Blob(['x']))).rejects.toThrowError('A2F: HTTP 500');
  });

  it('niepoprawny JSON → błąd parsera', async () => {
    fetchMock.mockResolvedValue(okResponse('{nie json'));
    await expect(predictFrames('http://x', new Blob(['x']))).rejects.toThrowError('A2F: niepoprawny JSON');
  });

  it('abort zewnętrzny przerywa predict (barge-in)', async () => {
    const ac = new AbortController();
    // Serwer nie odpowiada, ale fetch reaguje na abort.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
        })
    );
    const p = predictFrames('http://x', new Blob(['x']), { signal: ac.signal });
    ac.abort(new Error('A2F: anulowano'));
    await expect(p).rejects.toThrowError('A2F: anulowano');
  });

  it('timeout rzuca błąd A2F: timeout', async () => {
    // Serwer nigdy nie odpowiada — timeout w combineTimeout przerywa przez abort.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
        })
    );
    await expect(predictFrames('http://x', new Blob(['x']), { timeoutMs: 5 })).rejects.toThrow();
  });

  it('fetchA2fStatus: GET /status → JSON', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'ready', gpu: 'RTX 3090' }));
    const st = await fetchA2fStatus('http://127.0.0.1:8000');
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8000/status');
    expect(st.status).toBe('ready');
    expect(st.gpu).toBe('RTX 3090');
  });

  it('fetchA2fStatus: błąd HTTP → czytelny błąd', async () => {
    fetchMock.mockResolvedValue(okResponse({}, 503));
    await expect(fetchA2fStatus('http://x')).rejects.toThrowError('A2F: HTTP 503');
  });
});
