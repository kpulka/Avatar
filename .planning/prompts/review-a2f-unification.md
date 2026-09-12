# Prompt: Review + unifikacja planowania A2F ↔ podejście wizemowe

Jesteś architektem / seniorem-reviewerem projektu awatara 3D (Vite + TS + Three.js + ARKit blendshapes,
WebGL, konwersacyjny ElevenLabs). Twoje zadanie jest DWUCZĘŚCIOWE:

1) **Krytycznie zrewiduj istniejące plany GSD (Fazy 8–10)** pod kątem poprawności, kompletności i ryzyk.
2) **Zaprojektuj zunifikowane podejście** łączące neuronowy NVIDIA Audio2Face (A2F) z obecnym
   podejściem wizemowym (G2P + koartykulacja + Edytor Wizemów), tak by oba żyły pod JEDNYM
   interfejsem animacji/barge-in — i wskaż, co w planach 8–10 zmienić.

## Wejścia (przeczytaj zanim odpowiesz)

### Kod i kontekst projektu
- `src/lipsync/face-controller.ts` — state machine, epoka/barge-in, jedyny właściciel morphów;
  tryb `viseme` przez `VisemeScheduler` + `charMapper`, nadpisania `visemeOverrides`, `previewViseme`.
- `src/lipsync/viseme-scheduler.ts` — additive/koartykulacja/decay/lambda tiers.
- `src/lipsync/g2p/phoneme-merge.ts`, `phoneme-visemes.ts` (tabela ARPAbet→ARKit, `LipPose`),
  `g2p-en.ts` (CMUdict), `viseme-mappings.ts` (ścieżka znakowa/PL), `viseme-overrides.ts`
  (Edytor Wizemów, storage).
- `src/audio/speech-backend.ts` (ElevenAgents streaming; alignment→rescale→G2P), `audio-engine.ts`
  (gapless playback, epoch, hardStop), `energy-fallback.ts`, `alignment-rescale.ts`.
- `src/avatar/shape-normalizer.ts`, `face-driver.ts` (ArKitBlendshapeDriver), `main.ts` (wiring),
  `src/ui/hud.ts` + `index.html` (przełączniki, Edytor), `src/prod/telemetry.ts`.

### Dokumentacja / planowanie GSD (`.planning/`)
- `docs/7-audio2face-cloudrun.md` — architektura A2F na Cloud Run (L4, scale-to-zero) + kontrakt JSON.
- `docs/EN-visemes.md` — dokument roboczy wizemów EN (artykulacja→ARKit→niuanse).
- `.planning/phases/08-unified-animation-core/` (08-CONTEXT.md, 08-01..08-04)
- `.planning/phases/09-a2f-local-poc/` (09-CONTEXT.md, 09-01..09-05)
- `.planning/phases/10-a2f-cloud-mvp/` (10-CONTEXT.md, 10-01..10-04)
- `.planning/ROADMAP.md` (fazy 1–10), `.planning/REQUIREMENTS.md` (UNA-01, A2F-01..05), `.planning/STATE.md`.

## Tło / twarde fakty projektowe (nie negocjuj tych)
- **LIVE wizemy = domyślny, real-time tryb** (ElevenAgents streamuje chunki ~300 ms; TTFB <1,5 s;
  barge-in: stop <50 ms, neutral <300 ms). Kod fazy 7 już działa i zostaje.
- **A2F jest offline/batch** (cały `.wav` → JSON ramek). Ma dać mikromimikę i reakcję na głos/emocję.
- Sprzęt do lokalnego PoC: **RTX 3090 24 GB**; chmura (Cloud Run L4) tylko po go/no-go.
- Zasada: TYLKO `FaceController` pisze do morphów; oś czasu = `AudioContext.currentTime`; barge-in = epoka.
- Zespół ma Edytor Wizemów (ręczne pozy per głoska, persist) i dokument EN-visemes jako źródło prawdy dla wizemów.

## Część 1 — Krytyczna rewizja Faz 8–10
Oceń każdą fazę/plan pod kątem: (a) czy cel jest osiągalny w podanej kolejności i bez brakujących
zależności; (b) czy zakres jest właściwy (za duży/za mały), (c) czy „testowalność bez GPU" w F8
jest realna i czy kontrakt ramek (`PoseFrame`/JSON) jest spójny end-to-end (wrapper→parser→frames→FaceController),
(d) **merytoryczna poprawność założeń o A2F i Cloud Run**: czy Audio2Face headless (NGC/NIM) nadaje się
do wdrożenia w chmurze (licencja, VRAM, model na L4?), czy Cloud Run GPU wspiera scale-to-zero i jak
długi może być request (limit), jak realistyczny jest cold start i czy `/predict`(cały wav) + osobny
silenik A2F zmieści się w limicie pamięci/timeout; (e) ryzyka (np. potrzebna osobna usługa silnika vs
jeden kontener, streaming vs batch, interop z ARKit 52 i nazewnictwem MetaPerson).
Zweryfikuj fakty tam, gdzie to możliwe (dokumentacja NVIDIA/Google), a gdzie nie — oznacz jako
„do potwierdzenia" z konkretnym pytaniem. Wskaż konkretne luki/błędy w plikach planów (cytuj ścieżki).

## Część 2 — Projekt unifikacji A2F ↔ wizemy
Zaprojektuj docelową architekturę, w której OBA podejścia są źródłami tej samej abstrakcji animacji.
Uwzględnij co najmniej:
1. **Wspólna abstrakcja źródła animacji** (np. `PoseSource`/`MorphStream`): jak wizemy (dyskretne
   itemy + koartykulacja) i ramki A2F (gęste wartości bezwzględne) sprowadzić do jednego modelu —
   rozstrzygnij, czy koartykulacja/wygładzanie ma być per-źródło, czy wspólne i dlaczego (kontra:
   scheduler psuje wartości bezwzględne A2F — jak to pogodzić czysto).
2. **Timeline + barge-in**: jak wizemy i A2F współdzielą oś, epokę, `hasPendingAudio`, RELAXING;
   co z mruganiem proceduralnym (A2F niesie oczy? potwierdź co realnie daje A2F: 52 ARKit w tym oczy?).
3. **Gdzie żyje „mózg wyboru"**: kiedy używać wizemów (LIVE streaming, PL, fallback, brak GPU,
   przerwania mid-turn), kiedy A2F (offline/demo/emocja); czy potrzebny router/fallback, jak wygląda
   degradacja (A2F→wizemy w locie) bez „dziury" w animacji.
4. **Wspólny kontrakt danych i mapowanie ARKit** (nazwy, clamp, L/R, brakujące shape'y) — jak uniknąć
   duplikacji z `viseme-overrides`/Edytorem (czy nadpisania użytkownika mają się stosować też do A2F?).
5. **Gdzie A2F się wpina w potok mowy** (przed/po TTS, streaming-całość) i co to robi z TTFB/barge-in.
6. **Zmiany w plikach planów 08–10** wynikające z Twojego projektu: co dodać/usunąć/przebudować
   (w tym nowe moduły/interfejsy, testy, etapy), żeby wdrożenie było wykonalne na RTX 3090 lokalnie
   i dopiero potem w chmurze. Jeśli sensowne — zaproponuj konkretny układ modułów (ścieżki plików).

## Deliverables
Zwróć (w jednym, dobrze ustrukturyzowanym raporcie):
A. **Verdict per fazę/plan** (OK / popraw / przebuduj) z konkretnymi uwagami i cytatami.
B. **Fakty A2F/Cloud Run** — potwierdzone vs „do potwierdzenia" (lista pytań).
C. **Projekt unifikacji** — diagram tekstowy + lista modułów/interfejsów + reguły wyboru/degradacji.
D. **Rekomendowane zmiany w plikach planów** (08–10) oraz (opcjonalnie) proponowana treść sekcji do
   dodania — gotowa do wklejenia do plików `.md`.
E. **Lista pytań do zespołu/użytkownika**, na które potrzebujesz odpowiedzi zanim zaimplementujemy.

Ton: rzeczowy, konkretny, bez marketingowej otoczki. Jeśli jakieś założenie w planach jest błędne —
powiedz wprost, co i dlaczego.
