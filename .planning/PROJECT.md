# Avatar

## What This Is

Interaktywny, realistyczny awatar 3D działający w przeglądarce (WebGL/Three.js), który rozmawia z użytkownikiem głosem: słucha (STT), odpowiada (LLM + TTS ElevenLabs przez ElevenAgents), animuje usta w synchronizacji z mową (lip-sync z alignmentu znaków) i obsługuje naturalne przerywanie wypowiedzi (barge-in). Docelowo produkt demo/MVP do pokazania stakeholderom.

## Core Value

Płynna rozmowa głosowa z realistycznym awatarem, którego usta są idealnie zsynchronizowane z mową i można mu naturalnie przerwać w pół zdania — bez "zamrożonej miny" i bez dryfu usta-dźwięk.

## Business Context

- **Customer**: Wewnętrzny/stakeholderzy — demo produktu awatara konwersacyjnego
- **Revenue model**: Brak w v1 (PoC/MVP demonstracyjny); potencjalna licencja produktowa w Fazie 2
- **Success metric**: Spełnione kryteria akceptacji PoC/MVP z `docs/0-roadmap-poc-mvp.md`
- **Strategy notes**: Kanon techniczny projektu to `docs/1-6` — każda faza GSD nawiązuje do konkretnych sekcji tych plików

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Użytkownik rozmawia z awatarem głosem w czasie rzeczywistym (ElevenAgents: STT+LLM+TTS+turn-taking)
- [ ] Usta awatara są zsynchronizowane z mową EN (alignment znaków → ARKit blendshapes)
- [ ] Użytkownik może przerwać awatara w dowolnym momencie (barge-in) — audio stop < 50 ms, twarz neutral < 300 ms
- [ ] Awatar wygląda realistycznie (MetaPerson GLB, PBR+SSS, oświetlenie studiem, ACES) przy 60 FPS
- [ ] Lip-sync obsługuje język polski (dwuznaki sz/cz/rz/ch, nosówki ą/ę)
- [ ] Emocje sterowane agentem wpływają na mimikę bazową (client tools / metadata)
- [ ] Produkcyjny poziom twardości: reconnect, telemetria, klucz API poza przeglądarką (signed URL), agent as code

### Out of Scope

- Własny pipeline mózgu (Tryb B: własne STT/VAD/LLM) — Faza 2; ElevenAgents daje gotową pętlę konwersacji (patrz docs/2)
- Gestykulacja pełnym ciałem (Mixamo animacje) — Faza 2; MVP ogranicza się do idle sway + mikroruchów
- Alternatywne renderery (MetaHuman/Pixel Streaming, HeyGen LiveAvatar) — macierz decyzji docs/1; Three.js za adapterem `FaceDriver`
- Lip-sync akustyczny (Rhubarb/MFCC WASM) — fallback dla języków bez fonetycznego zapisu, Faza 2
- Języki poza EN/PL — Faza 2 (moduły słownikowe)
- Mobile (iOS Safari) — desktop-first; polityka autoplay/mikrofonu na mobile wymaga osobnych testów

## Context

- **Kanon techniczny**: `docs/0-roadmap-poc-mvp.md` (plan etapowy) + `docs/1-6` (architektura, integracja EL, lip-sync, audio/barge-in, shadery, ekosystem). Dokumentacja została zweryfikowana przeciw żywym docs ElevenLabs (wrzesień 2026).
- **Kluczowe odkrycia researchu** (uwierzytelnione w docs): ElevenAgents WSS zwraca alignment znaków wbudowany w eventy `audio`; barge-in wykrywany serwerowo (event `interruption`); domyślny format audio agenta to PCM 44.1 kHz (nie mp3); `@elevenlabs/client` gra audio sam (ryzyko dryfu) — dlatego PoC używa surowego WSS.
- **Elastyczność technologiczna**: rdzeń (lip-sync, przerwania) jest za interfejsami `SpeechBackend` / `FaceDriver` / `AvatarLoader` (docs/1) — renderer i backend mowy są wymienne bez przepisywania rdzenia.
- **Stan**: zero kodu, dokumentacja kompletna, repo git zainicjowane.

## Constraints

- **Tech stack**: Przeglądarka WebGL + Three.js + TypeScript/Vite — realizm bez wypiekania i pluginów natywnych (DLSS5 niemożliwe w sandboxie WebGL, patrz docs/5)
- **Zależność**: ElevenLabs + ElevenAgents (decyzja biznesowa) — głos, mózg i alignment pochodzą z tej platformy
- **Model 3D**: MetaPerson GLB ≤ 25 MB z 52 blendshape'ami ARKit + szkieletem Mixamo (docs/1)
- **Bezpieczeństwo**: `xi-api-key` nigdy w przeglądarce — PoC: agent publiczny (`agent_id`), MVP: signed URL z backendu (docs/2)
- **Wydajność**: 60 FPS @ 1080p na GPU klasy GTX 1060/M1; SSS jako opcjonalny preset (docs/5)
- **Języki**: PL + EN w MVP (tabela mapowań z dwuznakami, docs/3)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ElevenAgents (Tryb A) zamiast własnego pipeline | STT+LLM+TTS+turn-taking+barge-in gotowe serwerowo; PoC w dni, nie tygodnie | — Pending |
| Surowy WSS (`/v1/convai/conversation`) zamiast SDK do awatara | SDK gra audio sam → brak wspólnej osi czasu → dryf lip-syncu; surowy WSS daje audio+alignment z jednego eventu (docs/2) | — Pending |
| MetaPerson GLB zamiast MetaHuman/RPM/HeyGen | Realizm + gotowy rig ARKit w WebGL; RPM zamknięte, MetaHuman wymaga Unreal/Pixel Streaming (macierz docs/1) | — Pending |
| Three.js zamiast Babylon/Unity | Dojrzałość WebGL-first, ekosystem przykładów SSS/materiałów; za adapterem FaceDriver (docs/1) | — Pending |
| PCM 44.1 kHz zamiast mp3 w AudioEngine | `createBuffer`+`copyToChannel` gapless bez szczelin dekodera mp3 (docs/4) | — Pending |
| Epoch-based barge-in zamiast flagi+setTimeout | Eliminuje race conditions przerwań; unieważnia zaplanowane audio/wizemy atomowo (docs/4) | — Pending |
| `FaceController` jako jedyny właściciel morph targetów | Poprzedni projekt docs miał dwóch pisarzy → drgania miny; state machine IDLE→SPEAKING→RELAXING (docs/3,4) | — Pending |
| SSS pre-integrated przez `onBeforeCompile` (MVP), stock PBR dla PoC | `transmission:0` zabija parametry attenuation w Three.js — poprzedni przykład docs/5 nie działał; pre-integrated SSS to właściwa ścieżka skóry (docs/5) | — Pending |
| P8-10 review: A2F = Audio2Face-3D SDK (MIT) + wagi HF (NVIDIA Open Model License), NIM/NGC tylko porównawczo | Ścieżka darmowa/bez EULA NVAIE; SDK streaming-native i batch; VRAM 4 GB+; NIM = DeepStream + płatna licencja produkcji | — Pending |
| P8-10 review: kontrakt ramek v2 — PoseFrame RELATYWNY, baza (baseSec) dodana JEDNORAZOWO w feedFrames; FramesClip {shapes, carriesEyes, carriesEmotion} | v1 miał double-add audioStart i heurystykę ">10 kluczy"; PascalCase ARKit nie normalizuje się w normalizeShapeName (~30/52 nazw L/R przepada po cichu) → dekapitalizer w parserze | — Pending |
| P8-10 review: unifikacja = wspólny kontroler+epoga+safety, smoothing per-źródło | Scheduler (λ=18/s ≈ 250 ms stałej czasowej) skasowałby mikromimikę A2F; kalibracja gustowa i nadpisania Edytora zostają w torze wizemów (semantyka per-wizem ≠ per-klatka) | — Pending |
| P8-10 review: solver blendshape na rigu ARKit-52 z naszego avatar.glb (bez template'ów NVIDIA) | A2F produkuje geometrię — solver potrzebuje rigu; własny rig = wagi 1:1 z MetaPerson, zero remapów | — Pending |
| P8-10 review: model A2F-3D v3.0 (diffusion, 30 fps, realizm) primary; v2.3 (60 fps) porównawczo | Priorytet realizmu; kontrakt frame_time-per-ramka jest odporny na niestały krok | — Pending |
| P8-10 review: emocje działają w obu torach — A2E prowadzi mimikę w turach A2F (carriesEmotion → EmotionLayer addytywna OFF), EmotionLayer = baza IDLE/RELAXING + tor wizemów | Bez podwójnej emocji; po turze A2F baza emocjonalna spójna (emotions[] z wrappera zasila EmotionLayer) | — Pending |
| P8-10 review: chmura WYŁĄCZNIE scale-to-zero (płacimy tylko za przetworzenie; min-instances=0, no-gpu-zonal-redundancy, concurrency=1); cold start nieakceptowalny → NO-GO Fazy 10 | Realny koszt aktywna instancja ~$1,42/h → min-instances=1 ≈ $34/dzień = płacenie za stały serwer; request ze scale-to-zero ≈ $0,02–0,1 | — Pending |
| P8-10 review: A2F EN-only; PL wróci później równolegle w obu torach | A2F trenowany na audio EN; PL ma własny tor wizemowy (char) bez zmian | — Pending |
| P8-10 review: tor twarzy ma być regionem przyszłego AvatarDirector (ciało/gesty/głowa) | Zaplanowane warstwy sterowania postacią; interfejsy Fazy 8 nie mogą blokować dekompozycji | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions (wraz z outcome: ✓ Good / ⚠️ Revisit)
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-01 after initialization*
