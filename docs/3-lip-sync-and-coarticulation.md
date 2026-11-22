# 3. Lip-Sync and Coarticulation (character-alignment-based approach)

> Polish-specific letters are written as ASCII names so this document stays free of diacritics
> (for example `a-ogonek` and `e-ogonek` for the nasal vowels, `o-acute`, `s-acute`, `c-acute`,
> `z-acute`, `z-dot`, `l-stroke`, `n-acute`; `dz-acute` and `dz-dot` for the two digraphs; capitals
> follow the same pattern, e.g. `A-ogonek`).

## 📌 Assumptions

In the PoC/MVP we use the **character alignment** delivered by ElevenLabs (in Mode A: `audio_event.alignment`; in Mode B: `normalizedAlignment` — identical shape). Advantages: zero CPU overhead (no WASM/ML in the browser), and the markers arrive together with the audio.

Since v1.1 (Phase 7), English has a **G2P phoneme layer** (see below): letters → ARPAbet phonemes (CMUdict lexicon) → visemes. The character→viseme table remains for Polish and as a fallback (G2P missing or not ready, or the A/B switch).

Limitations we must keep in mind:
1. **The alignment applies to normalized text** — numbers/readings are expanded into words; we map only the characters from the alignment.
2. **The alignment gives letters, not phonemes** — in EN we reconstruct phonemes with the G2P layer; in PL (phonetic spelling) the character table with heuristics is sufficient.
3. **Languages without a phonetic script** (other than EN, handled by G2P/CMUdict, and other than PL) → acoustic fallback, jaw-only (no alignment), or in Phase 2 Rhubarb/MFCC ([docs/6](6-opensource-analysis-and-future.md)).

---

## 🧬 EN phoneme layer (v1.1, Phase 7) — G2P

English spelling is not phonetic: silent letters ("know", "though", "listen"), vowel digraphs ("ee", "ea", "oo", "ou") and silent endings ("-ed", "-tion") caused either phantom mouth movements without sound, or excessive articulation. ElevenLabs delivers timing only for **letters** — we reconstruct the phonemes on the client side.

### Pipeline

```
audio_event.alignment (letters + times)          src/audio/speech-backend.ts
        │  source: 'elevenlabs'
        ▼
mergeCharAlignmentToPhonemes()                  src/lipsync/g2p/phoneme-merge.ts
   • split into words by runs of letters
   • each word → ARPAbet phonemes (G2P)
   • word time distributed proportionally over the phonemes
     (vowels/diphthongs 1.2, consonants 0.8) — silent letters give their time to their neighbors
        ▼  PhonemeSpan[] { phoneme, startMs, durationMs }  (anchors from ElevenLabs!)
mapPhonemeToShapes()                            src/lipsync/g2p/phoneme-visemes.ts
   • ARPAbet → ARKit visemes (13 groups, full table in the module)
        ▼
VisemeScheduler.enqueue()  (no API change)
```

### Components

| Module | Role |
| :--- | :--- |
| `g2p-en.ts` | `ensureG2pLoaded()` (lazy dynamic import of `cmu-pronouncing-dictionary`, ~135k words, separate Vite chunk ~1 MB gz), `wordToPhonemesSync()` (lexicon + rule-based letter-to-sound for OOV words; strips stress digits 0/1/2) |
| `phoneme-merge.ts` | `mergeCharAlignmentToPhonemes(alignment)` — 1:1 word timing from the alignment; the result is phoneme spans |
| `phoneme-visemes.ts` | `mapPhonemeToShapes(phoneme)` — ARPAbet → ARKit combos (Left/Right symmetric) |

> 📄 **Work on per-phoneme mouth poses:** `docs/en-visemes.md` — working document (description of articulation → ARKit parameters, analysis of "twin" visemes and the nuances that tell them apart).

### Operating rules

1. G2P is loaded lazily (`FaceController` preloads it in the constructor). Until `isG2pReady() === true` (the first ~1–2 s) the character path runs — the avatar always speaks.
2. No lexicon entry → rule-based letter-to-sound fallback (never an empty list for a word that has letters).
3. `source === 'energy-fallback'` (no alignment from the server) takes priority — then only the jaw ∝ RMS energy (see below) is driven, without text conversion.
4. The HUD switch "EN phoneme engine (G2P)" (A/B, `localStorage.avatar_lipsync_engine`) forces the phoneme path or the character path in real time.

## ✏️ Viseme Editor (v1.1) — manual per-phoneme posing

The default ARKit combos are reference values — on a specific rig (MetaPerson) they can deform (e.g., `mouthClose` pulls the lower lip onto the nose). The **"Visemes"** drawer (✏️) lets you override the blendshape pose for EVERY viseme key:

- a list of viseme keys in two groups: **EN engine (G2P phonemes)** and **Character path (PL / fallback)**,
- selecting a viseme key → sliders for ~15 vocal-tract shapes → **live pose preview on the model**,
- the override is saved automatically (localStorage, `avatar_viseme_overrides_v1`) and takes **precedence over the default tables** in live lip-sync (both the phoneme path and the character path),
- "↺ Reset this key" restores the default table; "✖ Reset ALL viseme keys" clears everything.

Data layer: `src/lipsync/viseme-overrides.ts` (list of viseme keys, storage, `defaultVisemeShapes`);
application: `FaceController.visemeOverrides` (`resolveVisemeShapes` / `setVisemeOverride` /
`previewViseme`); UI: `Hud.initVisemeEditor`.

### Acoustic fallback, jaw-only (no alignment)
When `audio_event` does not carry `alignment`, `src/audio/energy-fallback.ts` generates substitute markers from the RMS energy of the signal (70 ms windows, `source: 'energy-fallback'`). `FaceController` then queues **only `jawOpen`** ∝ energy (no false vowels — before v1.1 the fallback inserted A/O/E/I and caused a rhythmic flapping of the mouth). Telemetry and the HUD badge (`ALIGN: EL ✓` / `ALIGN: FALLBACK ⚠`) show which source actually drives the mouth.

---

## 👄 Mapping table: characters/digraphs → ARKit

### Step 1: Digraphs (lookahead — check BEFORE the single character)

| Digraph (EN/PL) | ARKit keys | Weights | Description |
| :--- | :--- | :--- | :--- |
| `SH`, `sz` | `jawOpen`, `mouthFunnel` | `0.20`, `0.50` | hissing, rounded vestibule |
| `CH`, `cz` | `jawOpen`, `mouthFunnel` | `0.25`, `0.45` | like SH + stop |
| `TH` | `jawOpen` (+`tongueOut` if present) | `0.20`, `0.30` | tongue between the teeth |
| `PH` | = `F` | see F | |
| `WH` | `mouthPucker` | `0.40` | rounding before a vowel |
| `QU` | `mouthPucker` + `K` | `0.50` + `jawOpen 0.35` | /kw/ |
| `NG` | `jawOpen` | `0.25` | velar, lips half-open |
| `rz`, `z-dot`, `dz-acute`, `dz-dot` | = `SH`-like | `0.20`, `0.40` | PL: the "z-dot"-type sounds |

### Step 2: Single characters

| Character(s) | ARKit keys | Weights | Description |
| :--- | :--- | :--- | :--- |
| `A`, `a-ogonek` | `jawOpen`, `mouthSmile*` | `0.55`, `0.10` | wide opening |
| `E`, `e-ogonek` | `jawOpen`, `mouthSmile*` | `0.35`, `0.30` | medium opening, widened mouth corners |
| `I`, `Y` (as a vowel) | `jawOpen`, `mouthSmile*` | `0.25`, `0.20` | narrow opening |
| `O`, `o-acute` | `jawOpen`, `mouthPucker`, `mouthFunnel` | `0.40`, `0.60`, `0.40` | rounded |
| `U` | `jawOpen`, `mouthPucker`, `mouthFunnel` | `0.25`, `0.75`, `0.50` | strong pucker |
| `W` (consonant) | `mouthPucker` | `0.40` | quick glide — coarticulation with the following vowel |
| `M`, `B`, `P` | `mouthClose`, `mouthPress*` | `1.00`, `0.30` | **full closure** — the most important lip-sync test |
| `F`, `V` | `jawOpen`, `mouthRollLower` | `0.15`, `0.55` | lower lip under the upper teeth |
| `L` | `jawOpen` (+`tongueOut`) | `0.30`, `0.30` | tongue up; without `tongueOut` in the model — opening only |
| `T`, `D`, `N` | `jawOpen` | `0.20` | teeth / close to the palate |
| `S`, `Z`, `s-acute`, `z-acute`, `c-acute` | `jawOpen`, `mouthSmile*` | `0.15`, `0.15` | narrow, teeth visible |
| `K`, `G` | `jawOpen` | `0.35` | velar |
| `C` | depends: before `E/I/Y` → like `S`; otherwise → like `K` | — | context heuristic (see below) |
| `X` | `K`+`S` sequence in one window | — | /ks/ |
| `H`, `ch` (PL) | `jawOpen` | `0.25` | neutral aperture, lips not involved |
| `R` | `jawOpen`, `mouthFunnel` | `0.30`, `0.20` | approximant (PL: slight rounding) |
| `J` (PL `j`) | like short `I` | `0.25` | palatal |
| Space, punctuation | *(fade out all speech keys)* | `0.0` | rest; comma/period = micro-pause with full closure |

`mouthSmile*`/`mouthPress*` = applied symmetrically to the `Left`/`Right` variants.

### Context heuristic for `C` (and soft/hard pronunciation)

```
if C before {E, I, Y, e-ogonek, i}  →  map like S ("cell")
otherwise                           →  map like K ("cat")
```

This is a simplification — the agent's pronunciation errors occur less often than it looks, because the alignment describes the characters that were actually spoken. False hits are visually softened by coarticulation (below).

---

## 📈 Coarticulation and smoothing curves

Human speech does not jump between mouth positions — the muscles move smoothly, and neighboring sounds blend into each other.

### 1. Life cycle of a viseme (for a character with duration `D`)

```
Weight
 1.0 ┼          ╭────────────╮
     │         ╱              ╲
     │        ╱                ╲
 0.0 ┼───────╯                  ╰───────────► Time
     ├───────┼────────────────┼─────────────┤
     │BlendIn│      Hold      │  BlendOut   │
```

* **Blend-In** ~30–50 ms: rise 0 → target value (cosine ease).
* **Hold**: the duration of the phoneme/character (EN: the phoneme span from `phoneme-merge`; PL/fallback: `char_durations_ms`).
* **Blend-Out** ~40–60 ms: fade out, unless the same key is taken over by the next phoneme.

### 2. Additive blending with a limit

When neighboring characters activate the same key (e.g., `O` → `U`):

```
FinalWeight(key) = min(1.0, Σ active contributions(key))
```

### 3. Decay to zero — **the foundation rule**

Every speech key tends toward 0 in every window without an active contribution. Thanks to this:
* the end of a sentence = rest (mouth closed, jaw lowered),
* no "frozen" pose,
* an interruption = natural relaxation (supported by `FaceController` from [docs/4](4-audio-and-barge-in.md)).

### 4. Scale semantics (v1.1 — ONE multiplication)

The values in the mapping tables (character→viseme and phoneme→viseme) are **EFFECTIVE values** — the scheduler multiplies them **exactly once**, by the scale from the calibration profile:

```ts
contribution = maxVal × scaleForShape(shape) × easingWeight
scaleForShape(shape):           // default 1.0 (balanced preset)
  mouthClose / mouthPress*  → closeScale
  jawOpen                    → jawScale
  mouthPucker                → puckerScale
  mouthFunnel                → funnelScale
  mouthRollLower, mouthShrug*→ rollScale
  mouthUpperUp*, mouthLowerDown* → teethExposureScale
  mouthSmile*                → smileScale
  (tongueOut and the rest)   → 1.0
```

Presets are **tasteful** multipliers around 1.0 (subtle 0.85 / balanced 1.00 / expressive 1.15), not dampers — this way M/B/P reaches a real closure (~1.0), and 'A' jawOpen reaches ~0.55 instead of the squashed ~0.30 (the cause of the visual "flatness" before v1.1).

**The closure-priority rule** still applies: when `mouthClose` > 0.15, `jawOpen` is suppressed (`jaw × max(0, 1 − 0.95 × mouthClose/closeScale)`) — this protects against the MetaPerson artifact where the "lower lip rides up under the nose". The old cap `min(closeScale, 0.28 + 0.5×jaw)`, which prevented full closure, was removed.

### 5. Lambda per muscle group (v1.1)

A single lambda = 18 was too slow for short EN consonants (40–80 ms) — the shape did not reach its target before the end of the phoneme (another cause of the "flatness"). Lambda now depends on the muscle group (base: `coarticulationSpeed` from the profile, default 18):

| Group | Keys | Lambda |
| :--- | :--- | :--- |
| Closure | `mouthClose`, `mouthPress*` | ~1.7 × cs (≈31) — fast, sharp contact |
| Jaw | `jawOpen`, `tongueOut` | ~1.55 × cs (≈28) |
| Rounded lips | `pucker`, `funnel`, `roll`, `shrug`, `upperUp`, `lowerDown` | ~1.0 × cs (≈18) |
| Smile | `mouthSmile*` | ~0.45 × cs (≈8) — slow return after a pause |

```ts
alpha(shape) = 1 − exp(−lambdaForShape(shape) × dt)   // independent of FPS
```

---

## 💻 Update loop (improved algorithm)

The previous version of this document had two bugs: (a) keys absent from the dictionary of active visemes **never returned to 0** (the mouth stayed open), (b) the fixed `lerp(…, 0.35)` depended on the FPS. The version below fixes both:

```javascript
// FaceController.render(dt) — called from the Three.js render loop.
// The only module that writes to morphTargetInfluences (docs/4).
render(dt) {
  const now = this.audioCtx.currentTime;
  const targets = new Map(); // (shape → weight)

  // 1. Decay to zero (foundation rule): start from zero,
  //    contributions add up — keys without a contribution naturally tend to 0.
  const SPEECH_KEYS = this.speechShapeNames; // list of speech keys from FaceDriver

  // 2. Sum of active visemes (with the epoch — see docs/4)
  for (const item of this.queue) {
    if (item.epoch !== this.epoch) continue;            // freshness after an interruption
    const elapsed = now - item.startTimeSec;
    if (elapsed < -0.05 || elapsed > item.totalDurationSec) continue;

    const w = this.easing(elapsed, item);               // blend-in/hold/blend-out
    for (const [shape, maxVal] of item.shapes) {         // Map from the table above
      const scaled = maxVal * this.scaleForShape(shape); // ONE multiplication (v1.1)
      targets.set(shape, Math.min(1.0, (targets.get(shape) ?? 0) + scaled * w));
    }
  }

  // 3. FPS-independent smoothing — alpha PER SHAPE (v1.1)
  for (const shape of SPEECH_KEYS) {
    const target = targets.get(shape) ?? 0;              // no contribution → 0 (relaxation)
    const alpha = 1 - Math.exp(-this.lambdaForShape(shape) * dt);
    const current = this.currentWeights.get(shape) ?? 0;
    const next = current + (target - current) * alpha;
    this.currentWeights.set(shape, next);
    this.faceDriver.applyWeight(shape, next);            // synchronize all sub-meshes
  }
}
```

Properties of this loop:
* **Single owner** of `morphTargetInfluences` — `FaceController` (see the architecture in [docs/4](4-audio-and-barge-in.md)).
* `lambdaForShape` controls the "size" of the mouth per muscle group (table above): too small = clipped speech, too large = a chewing machine.
* **Forced closure**: for `M/B/P` aim at `mouthClose: 1.0` with priority — if the additive sum exceeds it, `mouthClose` takes precedence over `jawOpen` (closure is visually dominant).
* Implementation in code: `src/lipsync/viseme-scheduler.ts` — `scaleForShape()`, `lambdaForShape()`, `update()`.


---

## 🧪 Anti-robotic checklist (higher-quality speech)

* Punctuation (`.` `,` `?` `!`) = a 60–120 ms micro-pause with full closure — natural "breathing" between sentences.
* Never come back from a pause with a full smile — after a pause `mouthSmile*` rises more slowly (separate lambda: ~6).
* Micro-jitter on `jawOpen` (±1% noise at ~4 Hz) — removes the "perfect", unnatural flatness of the motion.
* Blinking during speech stays enabled (do not turn blinks off while the avatar speaks — it is the strongest signal of "aliveness").
