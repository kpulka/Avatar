import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { predictFrames, fetchA2fStatus } from '../src/audio/a2f-backend';
import { defined } from './helpers/defined';

function okResponse(body: string | object, status = 200): Response {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- test double / mock typing: the value comes from an untyped mock or JSON fixture
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

  it('predictFrames: valid response → FramesClip (parser) + predictMs', async () => {
    fetchMock.mockResolvedValue(okResponse(samples.ok));
    const wav = new Blob(['fake-wav'], { type: 'audio/wav' });
    const res = await predictFrames('http://127.0.0.1:8000', wav);

    expect(res.parsed.clip.frames).toHaveLength(2);
    expect(res.parsed.clip.fps).toBe(60);
    expect(res.parsed.clip.carriesEyes).toBe(true);
    expect(defined(res.parsed.clip.frames[0]).weights['jawOpen']).toBe(0.1);
    expect(typeof res.predictMs).toBe('number');

    // Sent FormData to /predict.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    const [url, init] = defined(fetchMock.mock.calls[0]);
    expect(url).toBe('http://127.0.0.1:8000/predict');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    expect(init.method).toBe('POST');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    expect(init.body instanceof FormData).toBe(true);
  });

  it('strips the trailing slash from baseUrl', async () => {
    fetchMock.mockResolvedValue(okResponse(samples.ok));
    await predictFrames('http://127.0.0.1:8000/', new Blob(['x']));
    expect(defined(fetchMock.mock.calls[0])[0]).toBe('http://127.0.0.1:8000/predict');
  });

  it('HTTP 500 → readable error', async () => {
    fetchMock.mockResolvedValue(okResponse({ error: 'boom' }, 500));
    await expect(predictFrames('http://x', new Blob(['x']))).rejects.toThrowError('A2F: HTTP 500');
  });

  it('invalid JSON → parser error', async () => {
    fetchMock.mockResolvedValue(okResponse('{not json'));
    await expect(predictFrames('http://x', new Blob(['x']))).rejects.toThrowError('A2F: invalid JSON');
  });

  it('external abort cancels predict (barge-in)', async () => {
    const ac = new AbortController();
    // The server does not respond, but fetch reacts to abort.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- test double / mock typing: the value comes from an untyped mock or JSON fixture
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
        })
    );
    const p = predictFrames('http://x', new Blob(['x']), { signal: ac.signal });
    ac.abort(new Error('A2F: cancelled'));
    await expect(p).rejects.toThrowError('A2F: cancelled');
  });

  it('timeout throws the A2F: timeout error', async () => {
    // The server never responds — the combineTimeout timeout aborts the request.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- test double / mock typing: the value comes from an untyped mock or JSON fixture
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
        })
    );
    await expect(predictFrames('http://x', new Blob(['x']), { timeoutMs: 5 })).rejects.toThrow();
  });

  it('fetchA2fStatus: GET /status → JSON', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'ready', gpu: 'RTX 3090' }));
    const st = await fetchA2fStatus('http://127.0.0.1:8000');
    expect(defined(fetchMock.mock.calls[0])[0]).toBe('http://127.0.0.1:8000/status');
    expect(st.status).toBe('ready');
    expect(st.gpu).toBe('RTX 3090');
  });

  it('fetchA2fStatus: HTTP error → readable error', async () => {
    fetchMock.mockResolvedValue(okResponse({}, 503));
    await expect(fetchA2fStatus('http://x')).rejects.toThrowError('A2F: HTTP 503');
  });
});
