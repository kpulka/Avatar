# 3. Lip-Sync i Koartykulacja (podejście oparte na alignmentie znaków)

## 📌 Założenia

W PoC/MVP wykorzystujemy **alignment znaków** dostarczany przez ElevenLabs (w Trybie A: `audio_event.alignment`; w Trybie B: `normalizedAlignment` — identyczny kształt). Zalety: zero narzutu CPU (bez WASM/ML w przeglądarce), znaczniki przychodzą razem z audio.

Od v1.1 (Faza 7) angielski ma **warstwę fonemową G2P** (patrz niżej): litery → fonemy ARPAbet (leksykon CMUdict) → wizemy. Tabela znak→wizem pozostaje dla polskiego oraz jako fallback (brak/niegotowy G2P lub przełącznik A/B).

Ograniczenia, o których musimy pamiętać:
1. **Alignment dotyczy tekstu znormalizowanego** — liczby/odczyty są rozwinięte do słów; mapujemy wyłącznie znaki z alignmentu.
2. **Alignment podaje litery, nie fonemy** — w EN fonemy odtwarzamy warstwą G2P; w PL (ortografia fonetyczna) wystarcza tabela znaków z heurystykami.
3. **Języki bez fonetycznego zapisu** (poza EN obsługiwanym przez G2P/CMUdict, poza PL) → fallback akustyczny jaw-only (brak alignmentu) lub w Faza 2 Rhubarb/MFCC ([docs/6](6-analiza-opensource-i-rozwoj.md)).

---

## 🧬 Warstwa fonemowa EN (v1.1, Faza 7) — G2P

Angielska ortografia nie jest fonetyczna: litery nieme ("know", "though", "listen"), dwuznaki
samogłoskowe ("ee", "ea", "oo", "ou") i nieme końcówki ("-ed", "-tion") powodowały albo
fantomowe ruchy ust bez dźwięku, albo nadmierną artykulację. ElevenLabs dostarcza tylko timing
**liter** — fonemy odtwarzamy po stronie klienta.

### Potok

```
audio_event.alignment (litery + czasy)          src/audio/speech-backend.ts
        │  source: 'elevenlabs'
        ▼
mergeCharAlignmentToPhonemes()                  src/lipsync/g2p/phoneme-merge.ts
   • podział na słowa wg runów liter
   • każde słowo → fonemy ARPAbet (G2P)
   • czas słowa rozkładany proporcjonalnie na fonemy
     (samogłoski/dyftongi 1.2, spółgłoski 0.8) — litery nieme oddają czas sąsiadom
        ▼  PhonemeSpan[] { phoneme, startMs, durationMs }  (kotwice z ElevenLabs!)
mapPhonemeToShapes()                            src/lipsync/g2p/phoneme-visemes.ts
   • ARPAbet → wizemy ARKit (13 grup, pełna tabela w module)
        ▼
VisemeScheduler.enqueue()  (bez zmian API)
```

### Komponenty

| Moduł | Rola |
| :--- | :--- |
| `g2p-en.ts` | `ensureG2pLoaded()` (leniwy dynamiczny import `cmu-pronouncing-dictionary`, ~135 tys. słów, osobny chunk Vite ~1 MB gz), `wordToPhonemesSync()` (leksykon + reguły letter-to-sound dla OOV; usuwa cyfry stresu 0/1/2) |
| `phoneme-merge.ts` | `mergeCharAlignmentToPhonemes(alignment)` — timing słów 1:1 z alignmentu; wynik to rozpiętości fonemów |
| `phoneme-visemes.ts` | `mapPhonemeToShapes(phoneme)` — ARPAbet → combosy ARKit (Left/Right symetrycznie) |

> 📄 **Praca nad pozycjami ust per głoska:** `docs/EN-visemes.md` — dokument roboczy (opis artykulacji → parametry ARKit → analiza „bliźniaczych" wizemów i niuanse różnicujące).

### Reguły działania

1. G2P ładowane jest leniwie (`FaceController` preloaduje w konstruktorze). Do czasu
   `isG2pReady() === true` (pierwsze ~1-2 s) działa ścieżka znakowa — awatar zawsze mówi.
2. Brak wpisu w leksykonie → regułowy fallback letter-to-sound (nigdy pusta lista dla słowa
   z literami).
3. `source === 'energy-fallback'` (brak alignmentu z serwera) ma pierwszeństwo — wtedy tylko
   żuchwa ∝ energia RMS (patrz niżej), bez konwersji tekstowej.
4. Przełącznik HUD "Fonemowy silnik EN (G2P)" (A/B, `localStorage.avatar_lipsync_engine`)
   wymusza ścieżkę fonemową albo znakową w czasie rzeczywistym.

## ✏️ Edytor Wizemów (v1.1) — ręczne ułożenie per głoska

Domyślne combosy ARKit to wartości referencyjne — na konkretnym riggu (MetaPerson) potrafią
deformować (np. `mouthClose` ciągnie dolną wargę na nos). Drawer **„Wizemy"** (✏️) pozwala
nadpisać ułożenie blendshape'ów dla KAŻDEJ głoski:

- lista głosek w dwóch grupach: **Silnik EN (fonemy G2P)** oraz **Ścieżka znaków (PL / fallback)**,
- wybór głoski → suwaki ~15 kształtów aparatu mowy → **podgląd pozy na żywo na modelu**,
- nadpisanie zapisuje się automatycznie (localStorage, `avatar_viseme_overrides_v1`) i ma
  **pierwszeństwo przed domyślnymi tabelami** w live lip-syncu (ścieżka fonemowa i znakowa),
- „Reset tej głoski" przywraca domyślną tabelę; „Reset wszystkich" czyści całość.

Warstwa danych: `src/lipsync/viseme-overrides.ts` (lista głosek, storage, `defaultVisemeShapes`);
aplikacja: `FaceController.visemeOverrides` (`resolveVisemeShapes` / `setVisemeOverride` /
`previewViseme`); UI: `Hud.initVisemeEditor`.

### Fallback akustyczny jaw-only (brak alignmentu)
Gdy `audio_event` nie niesie `alignment`, `src/audio/energy-fallback.ts` generuje zastępcze
znaczniki z energii RMS sygnału (okna 70 ms, `source: 'energy-fallback'`). `FaceController`
kolejkuje wtedy **wyłącznie `jawOpen`** ∝ energia (bez fałszywych samogłosek — przed v1.1 fallback
wstawiał A/O/E/I i powodował rytmiczne machanie ustami). Telemetria + badge HUD
(`ALIGN: EL ✓` / `ALIGN: FALLBACK ⚠`) pokazują, które źródło faktycznie napędza usta.

---

## 👄 Tabela mapowania: znaki/dwuznaki → ARKit

### Krok 1: Dwuznaki (lookahead — sprawdź PRZED pojedynczym znakiem)

| Dwuznak (EN/PL) | Klucze ARKit | Wagi | Opis |
| :--- | :--- | :--- | :--- |
| `SH`, `sz` | `jawOpen`, `mouthFunnel` | `0.20`, `0.50` | syczące, zaokrąglony przedsionek |
| `CH`, `cz` | `jawOpen`, `mouthFunnel` | `0.25`, `0.45` | jak SH + zwarcie |
| `TH` | `jawOpen` (+`tongueOut` jeśli jest) | `0.20`, `0.30` | język między zębami |
| `PH` | = `F` | patrz F | |
| `WH` | `mouthPucker` | `0.40` | zaokrąglenie przed samogłoską |
| `QU` | `mouthPucker` + `K` | `0.50` + `jawOpen 0.35` | /kw/ |
| `NG` | `jawOpen` | `0.25` | tylnojęzykowe, usta półotwarte |
| `rz`, `ż`, `dź`, `dż` | = `SH`-like | `0.20`, `0.40` | pl: dźwięki "ż" |

### Krok 2: Pojedyncze znaki

| Znak(i) | Klucze ARKit | Wagi | Opis |
| :--- | :--- | :--- | :--- |
| `A`, `ą` | `jawOpen`, `mouthSmile*` | `0.55`, `0.10` | szerokie otwarcie |
| `E`, `ę` | `jawOpen`, `mouthSmile*` | `0.35`, `0.30` | średnio otwarte, rozszerzone kąciki |
| `I`, `Y` (jako samogłoska) | `jawOpen`, `mouthSmile*` | `0.25`, `0.20` | wąskie otwarcie |
| `O`, `ó` | `jawOpen`, `mouthPucker`, `mouthFunnel` | `0.40`, `0.60`, `0.40` | zaokrąglone |
| `U` | `jawOpen`, `mouthPucker`, `mouthFunnel` | `0.25`, `0.75`, `0.50` | mocny dzióbek |
| `W` (spółgłoska) | `mouthPucker` | `0.40` | szybki glide — koartykulacja z następną samogłoską |
| `M`, `B`, `P` | `mouthClose`, `mouthPress*` | `1.00`, `0.30` | **pełne domknięcie** — najważniejszy test lip-syncu |
| `F`, `V` | `jawOpen`, `mouthRollLower` | `0.15`, `0.55` | dolna warga pod górne zęby |
| `L` | `jawOpen` (+`tongueOut`) | `0.30`, `0.30` | język w górze; bez `tongueOut` w modelu — tylko otwarcie |
| `T`, `D`, `N` | `jawOpen` | `0.20` | zęby/blisko podniebienia |
| `S`, `Z`, `ś`, `ź`, `ć` | `jawOpen`, `mouthSmile*` | `0.15`, `0.15` | wąsko, zęby widoczne |
| `K`, `G` | `jawOpen` | `0.35` | tylnojęzykowe |
| `C` | zależne: przed `E/I/Y` → jak `S`; inaczej → jak `K` | — | heurystyka kontekstowa (patrz niżej) |
| `X` | sekwencja `K`+`S` w jednym oknie | — | /ks/ |
| `H`, `ch` (PL) | `jawOpen` | `0.25` | neutralna apertura, wargi bez udziału |
| `R` | `jawOpen`, `mouthFunnel` | `0.30`, `0.20` | aproksymacja (pl: lekkie zaokrąglenie) |
| `J` (PL `j`) | jak `I` krótkie | `0.25` | palatalne |
| Spacja, interpunkcja | *(wygaszenie wszystkich kluczy mowy)* | `0.0` | spoczynek; przecinek/kropka = mikropauza z pełnym domknięciem |

`mouthSmile*`/`mouthPress*` = aplikacja symetrycznie do wariantów `Left`/`Right`.

### Heurystyka kontekstowa dla `C` (i miękka/twarda wymowa)

```
jeśli C przed {E, I, Y, ę, i}  →  mapuj jak S ("cell")
w przeciwnym razie             →  mapuj jak K ("cat")
```

To uproszczenie — błędy wymowy agenta zdarzają się rzadziej niż wygląda, bo alignment opisuje faktycznie wypowiedziane znaki. Fałszywe trafienia są wizualnie łagodzone koartykulacją (niżej).

---

## 📈 Koartykulacja i krzywe wygładzania

Mowa ludzka nie skacze między pozycjami ust — mięśnie przechodzą płynnie, a sąsiednie dźwięki się mieszają.

### 1. Cykl życia wizemu (dla znaku o czasie trwania `D`)

```
Waga
 1.0 ┼          ╭────────────╮
     │         ╱              ╲
     │        ╱                ╲
 0.0 ┼───────╯                  ╰───────────► Czas
     ├───────┼────────────────┼─────────────┤
     │BlendIn│      Hold      │  BlendOut   │
```

* **Blend-In** ~30–50 ms: narastanie 0 → wartość docelowa (cosine ease).
* **Hold**: czas trwania fonemu/znaku (EN: rozpiętość fonemu z `phoneme-merge`; PL/fallback: `char_durations_ms`).
* **Blend-Out** ~40–60 ms: wygaszanie, chyba że ten sam klucz przejmuje następny fonem.

### 2. Additive blending z limitem

Kiedy sąsiednie znaki aktywują ten sam klucz (np. `O` → `U`):

```
FinalWeight(key) = min(1.0, Σ aktywnych wkładów(key))
```

### 3. Wygaszanie do zera — **reguła fundamentu**

Każdy klucz mowy dąży do 0 w każdym oknie bez aktywnego wkładu. Dzięki temu:
* koniec zdania = spoczynek (usta przymknięte, żuchwa opuszczona),
* brak "zamrożonej" pozy,
* przerwanie = naturalny relaks (wsparty przez `FaceController` z [docs/4](4-audio-i-obsluga-przerwan.md)).

### 4. Semantyka skal (v1.1 — JEDNO mnożenie)

Wartości w tabelach mapowań (znak→wizem i fonem→wizem) są **wartościami EFEKTYWNYMI** — scheduler
mnoży je **dokładnie raz**, przez scale z profilu kalibracji:

```ts
contribution = maxVal × scaleForShape(shape) × easingWeight
scaleForShape(shape):           // domyślnie 1.0 (preset balanced)
  mouthClose / mouthPress*  → closeScale
  jawOpen                    → jawScale
  mouthPucker                → puckerScale
  mouthFunnel                → funnelScale
  mouthRollLower, mouthShrug*→ rollScale
  mouthUpperUp*, mouthLowerDown* → teethExposureScale
  mouthSmile*                → smileScale
  (tongueOut i pozostałe)    → 1.0
```

Presety to mnożniki **gustowe** wokół 1.0 (subtle 0.85 / balanced 1.00 / expressive 1.15),
a nie tłumiki — dzięki temu M/B/P osiąga realne domknięcie (~1.0), a 'A' jawOpen ~0.55 zamiast
zgniecionych ~0.30 (przyczyna wizualnej "płaskości" przed v1.1).

**Reguła priorytetu domknięcia** pozostaje: gdy `mouthClose` > 0.15, `jawOpen` jest tłumione
(`jaw × max(0, 1 − 0.95 × mouthClose/closeScale)`) — chroni przed artefaktem MetaPerson
"dolna warga podjeżdża pod nos". Usunięto natomiast stary cap `min(closeScale, 0.28 + 0.5×jaw)`,
który uniemożliwiał pełne domknięcie.

### 5. Lambda per grupa mięśni (v1.1)

Pojedyncza lambda = 18 była za wolna dla krótkich spółgłosek EN (40–80 ms) — kształt nie osiągał
celu przed końcem fonemu (kolejna przyczyna "płaskości"). Lambda jest teraz zależna od grupy
mięśni (baza: `coarticulationSpeed` z profilu, default 18):

| Grupa | Klucze | Lambda |
| :--- | :--- | :--- |
| Domknięcie | `mouthClose`, `mouthPress*` | ~1.7 × cs (≈31) — szybki, ostry kontakt |
| Żuchwa | `jawOpen`, `tongueOut` | ~1.55 × cs (≈28) |
| Okrągłe wargi | `pucker`, `funnel`, `roll`, `shrug`, `upperUp`, `lowerDown` | ~1.0 × cs (≈18) |
| Uśmiech | `mouthSmile*` | ~0.45 × cs (≈8) — wolny powrót po pauzie |

```ts
alpha(shape) = 1 − exp(−lambdaForShape(shape) × dt)   // niezależne od FPS
```

---

## 💻 Pętla aktualizacji (poprawiony algorytm)

Poprzednia wersja tego dokumentu miała dwa błędy: (a) klucze nieobecne w słowniku aktywnych wizemów **nigdy nie wracały do 0** (usta zostawały otwarte), (b) sztywny `lerp(…, 0.35)` zależał od FPS. Poniższa wersja naprawia oba:

```javascript
// FaceController.render(dt) — wywoływane z pętli renderującej Three.js.
// Jedyny moduł, który pisze do morphTargetInfluences (docs/4).
render(dt) {
  const now = this.audioCtx.currentTime;
  const targets = new Map(); // (shape → weight)

  // 1. Wygaszanie do zera (reguła fundamentu): startujemy od zera,
  //    wkłady dodają się addytywnie — klucze bez wkładu naturalnie dążą do 0.
  const SPEECH_KEYS = this.speechShapeNames; // lista kluczy mowy z FaceDriver

  // 2. Suma aktywnych wizemów (z eposem — patrz docs/4)
  for (const item of this.queue) {
    if (item.epoch !== this.epoch) continue;            // świeżość po przerwaniu
    const elapsed = now - item.startTimeSec;
    if (elapsed < -0.05 || elapsed > item.totalDurationSec) continue;

    const w = this.easing(elapsed, item);               // blend-in/hold/blend-out
    for (const [shape, maxVal] of item.shapes) {         // Map z tabeli powyżej
      const scaled = maxVal * this.scaleForShape(shape); // JEDNO mnożenie (v1.1)
      targets.set(shape, Math.min(1.0, (targets.get(shape) ?? 0) + scaled * w));
    }
  }

  // 3. Wygładzanie niezależne od FPS — alpha PER KSZTAŁT (v1.1)
  for (const shape of SPEECH_KEYS) {
    const target = targets.get(shape) ?? 0;              // brak wkładu → 0 (relaks)
    const alpha = 1 - Math.exp(-this.lambdaForShape(shape) * dt);
    const current = this.currentWeights.get(shape) ?? 0;
    const next = current + (target - current) * alpha;
    this.currentWeights.set(shape, next);
    this.faceDriver.applyWeight(shape, next);            // synchronizacja wszystkich sub-meshy
  }
}
```

Własności tej pętli:
* **Jeden właściciel** `morphTargetInfluences` — `FaceController` (patrz architektura w [docs/4](4-audio-i-obsluga-przerwan.md)).
* `lambdaForShape` steruje "gabarytem" ust per grupa mięśni (tabela wyżej): za małe = ocięta mowa, za duże = maszyna do żucia.
* **Wymuszone domknięcie**: przy `M/B/P` celuj w `mouthClose: 1.0` z priorytetem — jeśli additive sum przekroczy, to `mouthClose` ma pierwszeństwo przed `jawOpen` (domknięcie jest dominujące wizualnie).
* Realizacja w kodzie: `src/lipsync/viseme-scheduler.ts` — `scaleForShape()`, `lambdaForShape()`, `update()`.


---

## 🧪 Anty-robotyczność (checklist wyższej jakości)

* Interpunkycja (`.` `,` `?` `!`) = mikropauza 60–120 ms z pełnym domknięciem — naturalne "oddychanie" między zdaniami.
* Nigdy nie wracaj z pauzy pełnym uśmiechem — po pauzie `mouthSmile*` rośnie wolniej (lambda osobna: ~6).
* Mikro-jitter na `jawOpen` (szum ±1% o częstotliwości ~4 Hz) — eliminuje "perfekcyjną", nienaturalną płaskość ruchu.
* Mruganie podczas mowy pozostaje włączone (nie wyłączaj blinków, gdy awatar mówi — to najsilniejszy sygnał "żywości").