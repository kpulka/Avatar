# TODO — człowiek w pętli (human-in-the-loop)

> Zadania, których **agent nie wykona za Ciebie** (instalacje systemowe, konta, ocena wzrokowa,
> decyzje GO/NO-GO). Rób po kolei; po każdym kroku jest „Jak sprawdzić".
> **Aktualizacja: 2026-09-10** (po wykonaniu Fazy 11 — nowe UI: warstwa user + Studio).

## Stan projektu (kontekst)

| Obszar | Status |
|---|---|
| Faza 7 — UAT 07-04 | ⏸ odroczony (resume po Fazie 10) |
| Faza 8 — kod 08-01..03 (tor frames + parser + router/demo) | ✅ zaimplementowane, `npm test` zielone |
| Faza 8 — 08-04 (UAT + 08-VERIFICATION.md) | ⏳ **czeka na Ciebie** (pkt 1, razem z UAT F11) |
| Faza 11 — kod 11-01..11-07 (store/panele/compare/user/scene presets) | ✅ `npm test` **41 plików / 202 testy** + build zielone |
| Faza 11 — UAT manualny | ⏳ **czeka na Ciebie** (pkt 1) |
| Faza 9 — klient (a2f-backend, panel A2F w Studio, rejestr źródeł, segment LIVE/A2F) | ✅ zaimplementowane |
| Faza 9 — środowisko (CUDA/TensorRT/Python) | ⏳ **czeka na Ciebie** (pkt 2) |
| Faza 9 — SDK A2F-3D + rig + wrapper | 🔒 po instalacjach (pkt 3–5) |
| Faza 10 — Cloud Run (scale-to-zero) | 🔒 tylko po GO z Fazy 9 |

> **GSD:** UAT z pkt 1 uruchamiamy jako `/gsd-verify-work 11` (konwersacyjnie, punkt po punkcie);
> instalacje (pkt 2) są niezależne i mogą iść równolegle. Zamknięcie F8/F11 robi agent wg STATE → Pending Todos (A3/A4).

---

## 1. UAT F11 + dokończenie UAT F8 (manualny, ~30–40 min) — zanim zamkniemy fazy

Uruchom: `npm run dev`. Poniżej jedno przejście pokrywa **UAT F11** (`11-VERIFICATION.md` §3) i **08-04** (przez nowe UI).

**A. Studio → Animacja (dawniej „Kalibrator"):**
- [ ] Wgraj model (`avatar.glb` ładuje się automatycznie; fallback: Studio → Scena → „Wczytaj demo").
- [ ] Źródło animacji: „A2F (frames)" → „▶ Demo A2F (frames)" → usta animują się płynnie, słychać głos z `public/demo/demo-speech.wav`.
- [ ] „Przerwij" (🛑 w docku usera) w trakcie demo → usta wracają do neutralu < 300 ms, brak zamrożenia. *(08-04)*
- [ ] Powrót na LIVE wizemy (segment LIVE/A2F) → „Demo" (dock) → normalny lip-sync wizemowy (regresja). *(08-04)*
- [ ] Zmiana źródła **w trakcie** mówienia → nie tnie twarzy w pół słowa (przełączenie na granicy tury). *(08-04)*

**B. Warstwa user (nowa):**
- [ ] „Rozpocznij rozmowę" → rozmowa działa; przycisk zmienia się na „Zakończ rozmowę".
- [ ] „Porównaj A/B" po jednej turze → ta sama wypowiedź w obu torach (chipsy/wynik); przerwanie nową turą przerywa replay.
- [ ] „Tryb blind" → etykiety ukryte do momentu wyniku.
- [ ] ⚙ (prawy górny róg) → głośność, wybór mikrofonu (jeśli widzisz listę urządzeń), motyw, preset sceny.
- [ ] Uczciwość audio A/B: nagraj oba tory (słuchowo identyczne nagranie; RMS diff < 1% — held-out).

**C. Scena / wydajność:**
- [ ] 4 presety sceny (Studio → Scena oraz ⚙ → Preset sceny): tło/światło/kadr zmieniają się z crossfade 280 ms; `cinema` z winietą; `light` w jasnym motywie. Zrób zrzuty każdego.
- [ ] **~60 FPS** w obu trybach i na każdym presecie (meter FPS w Studio → Sesja). *(08-04 + F11 backstop)*
- [ ] Tab po UI: focus-visible widoczny; aria-label na ⚙ i zamknięciach; `prefers-reduced-motion` (w OS) wyłącza animacje.

**D. Blokady/tweaker:**
- [ ] Studio → Sesja → ustaw lock np. `volume`, sprawdź w ⚙ usera, że kontrolka jest disabled z tooltipem; odblokuj.
- [ ] Export profilu (JSON) → Import na świeżym profilu → wartości wracają; zły JSON → czytelny błąd bez zmiany stanu.

Po PASS napisz „**UAT OK**" (+ ewentualne FAIL-e) — agent: `/gsd-verify-work 11` dokończy zapis,
utworzy `08-VERIFICATION.md` i `11-VERIFICATION.md` → `manual_uat: pass`, domknie A3/A4.

## 2. Środowisko Fazy 9 — instalacje systemowe (najpierw to)

> Sprawdź stan: `powershell -ExecutionPolicy Bypass -File a2f/scripts/preflight.ps1`
> (obecnie: CUDA 13.2 ⚠, brak TensorRT ⚠, brak Pythona 3.10 ⚠, reszta ✅).

| # | Zadanie | Jak wykonać (Windows) | Jak sprawdzić |
|---|---|---|---|
| 2.1 | ~~**CUDA Toolkit 12.9**~~ | ✅ **zrobione 2026-09-11** (12.9.1, toolkit-only, obok 13.2; CUDA_PATH user = v12.9) | nvcc 12.9: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9\bin\nvcc.exe --version` |
| 2.2 | ~~**TensorRT 10.13+**~~ | ✅ **zrobione 2026-09-11 bez logowania** — wheels z `pypi.nvidia.com` + nagłówki OSS + wygenerowane import-libs → `D:\TensorRT-10.13` (`a2f/scripts/setup-tensorrt-from-pip.ps1`) | preflight po ustawieniu `TENSORRT_ROOT_DIR`; build SDK ✅ (`a2f/scripts/build-sdk.ps1`) |
| 2.3 | ~~**Python 3.10**~~ | ✅ **zrobione 2026-09-11**: `uv python install 3.10` + `a2f/.venv` (3.10.20) | `a2f\.venv\Scripts\python.exe --version` → 3.10.20 |
| 2.4 | (opcjonalnie) dłuższe demo-wav | `speed 0.9` do `public/demo/demo-speech.wav` | plik istnieje |

## 3. Konto Hugging Face + zgoda na licencję A2E

- [ ] Konto `https://huggingface.co` + akceptacja licencji `nvidia/Audio2Emotion-v2.2` oraz modeli A2F-3D (v3.0/v2.3).
- [ ] Token (Read, gated): `https://huggingface.co/settings/tokens` → 🔒 tylko `hf auth login`, nigdy w czacie/repo.

## 4. SDK A2F-3D — klon, modele, TRT engines (po pkt 2)

> **Status 2026-09-11:** ✅ sklonowany (`a2f/sdk`), ✅ `git lfs pull`, ✅ zależności Pythona w `a2f/.venv`, ✅ `fetch_deps.bat`, ✅ **TensorRT 10.13 bez logowania** (pip wheels + wygenerowane libs; `D:\TensorRT-10.13`), ✅ **SDK zbudowany** (`sample-a2f-executor.exe`), ✅ modele A2F (v3.0 + 4×v2.3). ⏳ Blokada: **OOM pamięci hosta** przy `gen_sample_data` (zamknij ciężkie aplikacje/restart → komenda w `docs/A2F-LOCAL.md` §4). ⏳ `hf auth login` potrzebny tylko dla A2E (emocje).
> ⚠️ `extract_rig.py` z `avatar.glb` **odłożony** — solver wymaga topologii wyjścia A2F (NPZ szablonu); szczegóły: `docs/A2F-LOCAL.md` §5.

```powershell
cd D:\Projects\Avatar\a2f\sdk
# (klon już wykonany)
git lfs pull
# venv 3.10: D:\Projects\Avatar\a2f\.venv
$env:CUDA_PATH = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9"
$env:TENSORRT_ROOT_DIR = "C:\TensorRT-10.13"
.\build.bat all release
# w venv:
.\download_models.bat
.\gen_testdata.bat
```
**Sprawdzenie:** `.\run_sample.bat .\_build\release\audio2face-sdk\bin\audio2face-unit-tests.exe` przechodzi.

## 5. Wrapper REST + E2E offline (09-02/09-03 — agent + Ty)

- [ ] Po `sample-a2f-executor`: dump realnego wyjścia → `a2f/fixtures/predict.sample.json` (kontrakt testów).
- [ ] Agent: `tools/extract_rig.py` (rig ARKit-52 z `avatar.glb`) + wrapper FastAPI `/predict` + `/status`.
- [ ] Ty: `a2f/scripts/start.ps1`; weryfikacja: `http://127.0.0.1:8000/status` → `ready`; w aplikacji Studio → A2F → „▶ Demo A2F" pokazuje realne ramki neuronowe (toast „predict … ms (RTF …)").

## 6. Ocena jakości i GO/NO-GO do chmury (09-05) — Twoja decyzja

- [ ] Porównaj LIVE vs A2F na zdaniach kontrolnych (`docs/EN-visemes.md` §6) — albo przez „Porównaj A/B" w UI; wypełnij tabelę 1–5 w `09-VERIFICATION.md`.
- [ ] Decyzja **GO/NO-GO**: chmura wyłącznie scale-to-zero (~$0,02–0,1/request); jeśli cold start wymagałby warm instancji → NO-GO.

## 7. (Dopiero po GO) Faza 10 — GCP

- [ ] Konto GCP + projekt + billing; Cloud Run GPU L4 (`europe-west1`/`europe-west4`/`us-central1`/`us-east4`).
- [ ] Deploy przez agenta z `gcloud` (plany 10-01..); `/gsd-execute-phase 10`.
- [ ] Alarm budżetowy ($20/mies) + `min-instances=0` bez wyjątków.

---

## Zasady współpracy

- Agent **nie commituje** bez Twojej zgody — commity robisz sam (albo zatwierdzasz A5 w STATE).
- Klucze/tokeny: **tylko** env/`.env`-ignorowane; nigdy w czacie/repo.
- Po skończonym bloku napisz krótko co zrobiłeś + wynik polecenia sprawdzającego — agent rusza dalej (kolejka GSD: `.planning/STATE.md` → Pending Todos).
