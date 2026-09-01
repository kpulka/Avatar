# 3. Lip-Sync i Koartykulacja (podejście oparte na alignmentie znaków)

## 📌 Założenia

W PoC/MVP wykorzystujemy **alignment znaków** dostarczany przez ElevenLabs (w Trybie A: `audio_event.alignment`; w Trybie B: `normalizedAlignment` — identyczny kształt). Zalety: zero narzutu CPU (bez WASM/ML w przeglądarce), znaczniki przychodzą razem z audio, a tabela mapowania pokrywa EN i PL (polska ortografia jest na tyle fonetyczna, że mapowanie znakowe działa — wraz z dwuznakami).

Ograniczenia, o których musimy pamiętać:
1. **Alignment dotyczy tekstu znormalizowanego** — liczby/odczyty są rozwinięte do słów; mapujemy wyłącznie znaki z alignmentu.
2. **Widzimy litery, nie fonemy** — dlatego potrzebujemy heurystyk kontekstowych (miękka/twarda litera C, dwuznaki) opisanych niżej.
3. **Języki bez fonetycznego zapisu** (np. angielskie nieregularności, języki spoza EN/PL) → fallback akustyczny w Fazie 2 ([docs/6](6-analiza-opensource-i-rozwoj.md)).

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
* **Hold**: czas trwania fonemu (z `char_durations_ms`).
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
      targets.set(shape, Math.min(1.0, (targets.get(shape) ?? 0) + maxVal * w));
    }
  }

  // 3. Wygładzanie niezależne od FPS (exponential damping) — nie sztywny lerp!
  const lambda = 18;                                      // ~szybkość reakcji [1/s]
  const alpha = 1 - Math.exp(-lambda * dt);
  for (const shape of SPEECH_KEYS) {
    const target = targets.get(shape) ?? 0;              // brak wkładu → 0 (relaks)
    const current = this.currentWeights.get(shape) ?? 0;
    const next = current + (target - current) * alpha;
    this.currentWeights.set(shape, next);
    this.faceDriver.applyWeight(shape, next);            // synchronizacja wszystkich sub-meshy
  }
}
```

Własności tej pętli:
* **Jeden właściciel** `morphTargetInfluences` — `FaceController` (patrz architektura w [docs/4](4-audio-i-obsluga-przerwan.md)).
* `lambda` steruje "gabarytem" ust: za małe = ocięta mowa, za duże = maszyna do żucia. Punkt startowy: 18–24.
* **Wymuszone domknięcie**: przy `M/B/P` celuj w `mouthClose: 1.0` z priorytetem — jeśli additive sum przekroczy, to `mouthClose` ma pierwszeństwo przed `jawOpen` (domknięcie jest dominujące wizualnie).

---

## 🧪 Anty-robotyczność (checklist wyższej jakości)

* Interpunkycja (`.` `,` `?` `!`) = mikropauza 60–120 ms z pełnym domknięciem — naturalne "oddychanie" między zdaniami.
* Nigdy nie wracaj z pauzy pełnym uśmiechem — po pauzie `mouthSmile*` rośnie wolniej (lambda osobna: ~6).
* Mikro-jitter na `jawOpen` (szum ±1% o częstotliwości ~4 Hz) — eliminuje "perfekcyjną", nienaturalną płaskość ruchu.
* Mruganie podczas mowy pozostaje włączone (nie wyłączaj blinków, gdy awatar mówi — to najsilniejszy sygnał "żywości").