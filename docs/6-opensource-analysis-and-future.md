# 6. Ekosystem Open-Source, Emocje, Wielojęzyczność, Rozwój

## 📌 Projekty open-source warte podglądu

Zanim napiszemy coś od zera, sprawdzamy, co rozwiązano już inni — **zawsze weryfikujemy licencję przed użyciem komercyjnym**:

| Projekt | Rola | Wartość dla nas | Uwaga licencyjna |
| :--- | :--- | :--- | :--- |
| **TalkingHead (met4citizen)** | Gotowa klasa JS: Three.js + GLB + ARKit/Oculus blendshapes | Referencja interpolacji i reguł językowych (EN/DE/FR...); punkt odniesienia dla naszego scheduler wizemów | sprawdź licencję repo przed wpięciem kodu |
| **Rhubarb Lip Sync** | Analiza audio → wizemy (WASM) | Fallback akustyczny dla języków, gdzie mapowanie znakowe nie wystarczy (Faza 2) | licencja ogranicza komercyjne użycie — zweryfikuj |
| **HeadAudio / MFCC worklets** | Fonemizacja audio w AudioWorklet | Alternatywa dla Rhubarb; < 10 ms latencji | badawczy, wymaga tuningu |
| **@elevenlabs/client + @elevenlabs/react** | Oficjalne SDK ElevenAgents | Szybkie testy agenta; `onAudioAlignment` | oficjalne, używamy w PoC do walidacji konfiguracji |
| **Pipecat / LiveKit Agents** | Frameworki pipeline'ów głosowych | Gotowy szkielet dla Trybu B (własny mózg, Faza 2) | permissive |
| **elevenlabs-avatar / szablony Threlte** | Szablony EL + WebGL | Referencje integracji i wygładzania warg | głównie inspiracja |

**Ready Player Me — zamknięte** (projekt wygaszony). Wszystkie referencje do RPM w starszych notatkach są nieaktualne; alternatywy realistyczne: MetaPerson (nasz wybór, [docs/1](1-architektura-i-modele-3d.md)), HeyGen LiveAvatar (oficjalny guide ElevenLabs — wideo-awatar bez silnika 3D), MetaHuman + Pixel Streaming (Faza 2).

---

## 🎭 Emocje sterowane agentem — mechanizmy ElevenAgents

Zamiast wymyślać własny kanał metadanych, używamy dwóch natywnych mechanizmów:

### Wariant 1: client tools (zalecany na MVP)

Agent wywołuje narzędzie po stronie klienta (`client_tool_call`), gdy "czuje" emocję. Rejestrujemy w konfiguracji agenta tool np. `set_emotion` z parametrami `emotion`, `intensity`; w prompcie instruujemy agenta, żeby wywoływał je przed wypowiedziami o wyraźnym ładunku:

```jsonc
// Klient odbiera:
{ "type": "client_tool_call",
  "client_tool_call": { "tool_name": "set_emotion",
    "tool_call_id": "call_123",
    "parameters": { "emotion": "thoughtful", "intensity": 0.7 } } }

// FaceController: baza emocjonalna blendshape'ów, na którą nakładają się wizemy mowy:
//   thoughtful → browInnerUp 0.5 · eyeSquint* 0.2
//   happy      → mouthSmile* 0.4 · cheekSquint* 0.3
//   surprised  → browOuterUp* 0.6 · eyeWide* 0.4 · jawOpen floor +0.15
// Odpowiadamy: { "type": "client_tool_result", "tool_call_id": "call_123", "result": "ok" }
```

### Wariant 2: `agent_response_metadata` (custom LLM)

Jeśli agent działa na własnym LLM (custom LLM endpoint), odpowiedź może nieść metadane (trzeba włączyć event w `client_events` agenta):

```jsonc
{ "type": "agent_response_metadata",
  "agent_response_metadata_event": {
    "metadata": { "emotion": "thoughtful", "intensity": 0.7, "gesture": "nod_affirmative" } } }
```

**Reguła mieszania z mową**: emocja to **baza** (offset), wizemy to **dodatek** (delta). `FinalWeight = clamp(emotionBase[key] + visemeWeight[key])`, z osobnym, wolniejszym dampinguem dla emocji (lambda ~3–6) — emocje nie mogą "przeskakiwać" między zdaniami.

---

## 🌍 Wielojęzyczność

Tabela mapowania z [docs/3](3-lip-sync-i-koartykulacja.md) jest **dedykowana EN+PL** (dwuznaki `sz/cz/rz/ch`, nosówki `ą/ę` zmapowane jak `a/e` + lekkie `mouthFunnel`). Strategia etapowa:

```
Faza 1 (MVP):  EN + PL — mapowanie znakowe (alignment), zero CPU
Faza 2 (opcja): inne języki fonetyczne — kolejne moduły słownikowe (tabela per język)
Faza 2 (opcja): języki "niefonetyczne" — fallback akustyczny (Rhubarb WASM / MFCC)
```

Agent ElevenAgents mówi w 70+ językach (głos wielojęzyczny); **lip-sync nie jest wąskim gardłem wielojęzyczności** — wąskim gardłem jest tabela znaków. Rozszerzenie o język = nowy moduł mapowań + testy wzrokowe.

---

## 🧠 Faza 2: pełne ożywienie (mowa ciała)

Elementy, które przenoszą awatar przez "dolinę niesamowitości" — w kolejności ROI:

1. **Mruganie** (już w PoC): `eyeBlink*` co 2,5–6 s, zamknięcie 80 ms, otwarcie 200 ms; podsypywanie podwójnych mrugnięć; świadome pomijanie blinków przy `eyeWide` (zaskoczenie).
2. **Mikroruchy głowy**: szum Perlina → kości `Neck/Head`, amplituda 1–2°, częstotliwość 0,2–0,5 Hz; redukcja amplitudy podczas mowy (unikaj "bobbingu").
3. **Sakkady wzroku**: celowanie `eyeLook*` na losowe punkty co 1–4 s + "shared attention" (spojrzenie na użytkownika, gdy mówi; lekko w bok, gdy agent "myśli").
4. **Idle ciała**: animacje Mixamo (oddech, sway) przez `AnimationMixer` z crossfade 0,3 s — rig już zgodny ([docs/1](1-architektura-i-modele-3d.md)).
5. **Gestyka akcentująca**: bazowe"beat gestures" zsynchronizowane z interpunkcją alignmentu (kropka = gest akcentujący).

---

## 🗺️ Ścieżki rozwoju architektury (podsumowanie)

| Kierunek | Co się zmienia | Koszt/ryzyko |
| :--- | :--- | :--- |
| Własny mózg (Tryb B, [docs/2](2-integracja-elevenlabs-wss.md)) | `SpeechBackend`: ElevenAgents → TTS WSS + własny LLM + VAD | wysoki (turn-taking!), zysk: pełna kontrola |
| Renderer premium (MetaHuman/Pixel Streaming) | `FaceDriver` → sterownik po stronie Unreal | wysoki (GPU per stream), zysk: fotorealizm |
| Wideo-awatar (HeyGen LiveAvatar) | `AvatarLoader` → stream wideo; lip-sync zbędny | średni (koszt/min), zysk: realizm bez silnika 3D |
| Lip-sync akustyczny | scheduler wizemów: źródło alignment → źródło wizemów | niski, zysk: dowolny język |

Dzięki interfejsom z [docs/1](1-architektura-i-modele-3d.md) żaden z tych kierunków nie wymusza przepisywania rdzenia.