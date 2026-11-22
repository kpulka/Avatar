# 4. Audio i Obsługa Przerwań ("Barge-in")

## 📌 Dwa obszary odpowiedzialności

W Trybie A ([docs/2](2-integracja-elevenlabs-wss.md)) **serwer wykrywa przerwanie** (agent słucha cały czas; gdy użytkownik zaczyna mówić w trakcie wypowiedzi agenta, ElevenLabs przerywa generację i wysyła event `interruption` + `agent_response_correction`). Klient odpowiada tylko za:

1. **Natychmiastowy stop odtwarzania** zaplanowanego audio.
2. **Anulowanie kolejki wizemów** i płynny relaks twarzy.
3. Sprzątnięcie zaplanowanych, ale nieodtworzonych chunków.

W Trybie B (własny pipeline) dochodzi dodatkowo własny VAD i zamknięcie strumienia TTS — patrz sekcja na końcu.

---

## 🎵 AudioEngine — Web Audio API

### Dlaczego Web Audio, nie `<audio>`?

* **Gapless**: chunki dokładamy na precyzyjną oś `ctx.currentTime` — zero szwów między paczkami.
* **Natychmiastowy stop**: `node.stop()` bez pop/kliku + czyszczenie zaplanowanych węzłów.
* **Wspólna oś czasu dla lip-syncu**: wizemy i dźwięk planujemy na tym samym zegarze — to warunek synchronizacji ([docs/3](3-lip-sync-i-koartykulacja.md)).

### PCM, nie mp3 — ważne

Agent ElevenAgents streamuje domyślnie **surowy PCM 44.1 kHz** (`agent_output_audio_format` z `conversation_initiation_metadata` — czytamy to przy starcie, nie hardkodujemy). Unikamy `decodeAudioData` (stworzone dla plików; dekodowanie mp3 na chunkach potrafi dodawać szczeliny/przerwy kodera):

```javascript
class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.activeNodes = [];
    this.tailTime = 0;     // koniec ostatnio zaplanowanego audio
    this.epoch = 0;        // numer "pokolenia" — patrz niżej
  }

  // Po geście użytkownika (klik "Talk") — polityka autoplay przeglądarek!
  async unlock() { if (this.ctx.state === 'suspended') await this.ctx.resume(); }

  playChunk(pcmBytes, sampleRate = 44100) {
    const buffer = this.ctx.createBuffer(1, pcmBytes.length / 2, sampleRate); // mono, 16-bit
    buffer.copyToChannel(this.toFloat32(pcmBytes), 0);

    // Gapless: start = max(teraz, koniec poprzedniego) — z małym prebufferem
    const start = Math.max(this.ctx.currentTime + 0.06, this.tailTime);
    this.tailTime = start + buffer.duration;

    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(this.master);
    node.start(start);                     // może być "w przyszłości" — to OK
    this.activeNodes.push(node);
    node.onended = () => {
      const i = this.activeNodes.indexOf(node);
      if (i !== -1) this.activeNodes.splice(i, 1);   // brak wycieków węzłów
    };
    return start;                          // !! FaceController planuje wizemy względem TEGO czasu
  }

  toFloat32(bytes) {
    const out = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    for (let i = 0; i < out.length; i++)
      out[i] = view.getInt16(i * 2, true) / 32768;
    return out;
  }
}
```

**Prebuffering**: nie startuj pierwszego chunka natychmiast — odczekaj 2–3 chunki (~100–200 ms) od pierwszego `audio`, potem odtwarzaj gapless. To pochłania jitter sieci i zapobiega "rwanym" startom (rekomendacja z dokumentacji ElevenLabs: adaptive buffering).

---

## 🛑 Barge-in — architektura poprawiona

### Błędy, które naprawiamy (były w poprzedniej wersji tego dokumentu)

1. **Flaga `isInterrupted` + `setTimeout(200 ms)` resetu** — race condition: nowa wypowiedź rozpoczęta w oknie 200 ms byłaby **cicho odrzucona**. Poprawka: **epoch** — każdy start wypowiedzi podnosi licznik; wszystkie zaplanowane audio/wizemy przechowują epoch, w którym zostały utworzone; po przerwaniu wszystko ze starym epochem jest ignorowane i sprzątane. Zero timerów, zero okien czasowych.
2. **Dwa moduły piszą do `morphTargetInfluences`** (`updateMorphTargets` i osobny `smoothResetFace`) — konflikt pisarzy dawał drgania miny. Poprawka: **jedyny właściciel — `FaceController`** (state machine).
3. **AudioEngine oddzielnie zarządza kolejką wizemów** — wizemy były poza kontrolą przerwań. Poprawka: scheduler wizemów żyje w `FaceController`, który słucha przerwań przez wspólny epoch.

### FaceController — state machine (jeden właściciel twarzy)

```
IDLE ──(pierwszy audio chunk, epoch++)──► SPEAKING
SPEAKING ──(interruption / koniec kolejki)──► RELAXING
RELAXING ──(wszystkie wagi ≈ 0)──► IDLE
```

```javascript
class FaceController {
  constructor(faceDriver, audioEngine) {
    this.driver = faceDriver;
    this.engine = audioEngine;
    this.state = 'IDLE';
    this.epoch = 0;
    this.queue = [];                 // zaplanowane wizemy (docs/3)
    this.relaxStartedAt = 0;
  }

  // Wywoływane przy każdym evencie audio (docs/2)
  onAudioChunk(alignment, chunkStartTimeSec, epoch) {
    if (epoch !== this.epoch) return;               // waryjny check
    if (this.state === 'RELAXING' || this.state === 'IDLE') {
      this.state = 'SPEAKING';                       // nowa wypowiedź
      this.epoch = epoch;                            // = engine.epoch
    }
    for (let i = 0; i < alignment.chars.length; i++) {
      this.queue.push({
        epoch,
        shapes: mapCharToShapes(alignment.chars, i),  // tabela z docs/3 (z lookaheadiem)
        startTimeSec: chunkStartTimeSec + alignment.char_start_times_ms[i] / 1000,
        durationSec:  alignment.char_durations_ms[i] / 1000,
      });
    }
  }

  // Wywoływane przy evencie interruption (docs/2)
  onInterruption() {
    this.queue = this.queue.filter(() => false);     // wyczyść wszystko
    this.state = 'RELAXING';
    this.relaxStartedAt = performance.now();
  }

  // Jedna pętla — z pętli renderującej Three.js, dt w sekundach
  render(dt) {
    if (this.state === 'SPEAKING') {
      // algorytm z docs/3: suma aktywnych wizemów + damping
      this.renderSpeaking(this.engine.ctx.currentTime, dt);
      if (this.queue.length === 0 && !this.engine.hasPendingAudio()) {
        this.state = 'RELAXING';                     // naturalne wygaszenie końca zdania
        this.relaxStartedAt = performance.now();
      }
    } else if (this.state === 'RELAXING') {
      // Płynny powrót do neutralu: ~150 ms cosine ease (wygaszanie reguły fundamentu z docs/3)
      const t = (performance.now() - this.relaxStartedAt) / 150;
      if (this.renderRelax(Math.min(1, t)) === 0) this.state = 'IDLE';
    }
    // IDLE: same proceduralne blinki/mikroruchy (docs/6)
  }
}
```

### Sekwencja przerwania (end-to-end)

```
Użytkownik zaczyna mówić w trakcie wypowiedzi agenta
        │ (detekcja po stronie ElevenAgents — VAD/turn-taking serwera)
        ▼
Klient: { "type": "interruption" }
        │
   ┌────┴──────────────────────────┐
   ▼                               ▼
AudioEngine.hardStop()        FaceController.onInterruption()
   • epoch++                     • epoch ignorowany w sprawdzaniu
   • stop() wszystkich węzłów    • czyszczenie kolejki wizemów
   • tailTime = 0                 • stan → RELAXING (150–300 ms ease)
   • (serwer sam przerywa          • usta wracają do neutralu
     generację TTS)                  — nigdy "zamrożona" mina
```

```javascript
hardStop() {
  this.epoch++;                       // unieważnia wszystko zaplanowane (audio i wizemy)
  for (const node of this.activeNodes) {
    try { node.onended = null; node.stop(); node.disconnect(); } catch (e) {}
  }
  this.activeNodes = [];
  this.tailTime = 0;
}
```

**Dlaczego to jest wrażliwe na race'y i dlaczego epoch to rozwiązuje:** event `audio` może być już "w locie" gdy przychodzi `interruption` (kolejność WS nie gwarantuje, że przeglądarka przetworzyła je w tej samej kolejności mikro-zadań). Z epoch: chunk opóźniony po przerwaniu trafia do `onAudioChunk` ze starym epochem → ignorowany. Nowa wypowiedź agenta → nowy epoch → wszystko czyste. Bez timerów.

---

## 🎤 Tryb B: własny pipeline przerwań (Faza 2, tylko zarys)

Bez ElevenAgents musimy sami:
1. **VAD**: Silero VAD (WASM) lub WebRTC VAD na strumieniu mikrofonu; próg + histereza (300 ms hangover) żeby nie odpalać na oddech.
2. **Przerwanie generacji**: zamknąć WS TTS (lub `flush` + zignorować pozostałe chunki przez epoch).
3. **Turn-taking**: decyzja "user skończył vs oddech" — to najtrudniejszy element; frameworki: Pipecat / LiveKit Agents / Speech Engine ([docs/6](6-analiza-opensource-i-rozwoj.md)).

---

## ✅ Checklist jakości audio (PoC)

- [ ] `AudioContext` odblokowany gestem użytkownika (autoplay policy).
- [ ] Chunki PCM 44.1 kHz mono 16-bit (`agent_output_audio_format` czytane z metadanych).
- [ ] Prebuffer 2–3 chunki przed pierwszym dźwiękiem.
- [ ] Wszystkie `AudioBufferSourceNode` sprzątane w `onended` (brak wycieków w rozmowie 10 min).
- [ ] Przerwanie: audio stop < 50 ms, twarz neutral < 300 ms, zero "uwięzionych" chunków (test: przerwij 10× w losowych momentach).