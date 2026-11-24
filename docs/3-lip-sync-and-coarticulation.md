# 3. Lip-Sync and Coarticulation (character-alignment-based approach)

> Polish-specific letters are written as ASCII names so this document stays free of diacritics
> (for example `a-ogonek` and `e-ogonek` for the nasal vowels, `o-acute`, `s-acute`, `c-acute`,
> `z-acute`, `z-dot`, `l-stroke`, `n-acute`; `dz-acute` and `dz-dot` for the two digraphs; capitals
> follow the same pattern, e.g. `A-ogonek`).

## 📌 Assumptions

In the PoC/MVP we use the **character alignment** delivered by ElevenLabs (in Mode A: `audio_event.alignment`; in Mode B: `normalizedAlignment` — identical shape). Advantages: zero CPU overhead (no WASM/ML in the browser), and the markers arrive together with the audio.

Since v1.1 (Phase 7), English has a **G2P phoneme layer** (see below): letters → ARPAbet phonemes (a pruned ~10k-word CMUdict lexicon plus letter-to-sound rules) → visemes. Since Phase 17 Polish has its own **rule-based phoneme path** (no lexicon). The character→viseme table remains as the fallback for every language (G2P not ready, no phonemes produced, or the engine select set to "Character table").

Limitations we must keep in mind:
1. **The alignment applies to normalized text** — numbers/readings are expanded into words; we map only the characters from the alignment.
2. **The alignment gives letters, not phonemes** — in EN we reconstruct phonemes with the G2P layer; in PL (nearly phonetic spelling) a deterministic rules engine handles digraphs, softness, devoicing and nasals; the character table remains the fallback.
3. **Languages without a phonetic script** (other than EN, handled by G2P/CMUdict, and other than PL) → acoustic fallback, jaw-only (no alignment), or in Phase 2 Rhubarb/MFCC ([docs/6](6-opensource-analysis-and-future.md)).

---

## 🧬 EN phoneme layer (v1.1, Phase 7) — G2P

English spelling is not phonetic: silent letters ("know", "though", "listen"), vowel digraphs ("ee", "ea", "oo", "ou") and silent endings ("-ed", "-tion") caused either phantom mouth movements without sound, or excessive articulation. ElevenLabs delivers timing only for **letters** — we reconstruct the phonemes on the client side.

### Pipeline

```
audio_event.alignment (letters + times)          src/audio/speech-backend.ts
   • normalizeAlignmentPayload()                 src/audio/alignment-normalize.ts (pure, tested)
       aliases, ms/seconds units, length + finite guards, negative times clamped to 0
   • rescaleAlignmentToAudio()                   src/audio/alignment-rescale.ts
       first char -> speech onset, last char -> speech offset (70 ms RMS windows), factor clamped [0.5, 2.5]
        │  source: 'elevenlabs'
        ▼
mergeCharAlignmentToPhonemes()                  src/lipsync/g2p/phoneme-merge.ts
   • split into words by runs of letters (EN letters, PL diacritics, ' and -)
   • per-word language (language.ts): Polish diacritic / Polish-only digraph -> PL, else the engine default
   • EN word -> ARPAbet via g2p-en.ts:   pruned lexicon (~10k words, lazy chunk) -> apostrophe/hyphen
                                         ladder -> letter-to-sound rules
     PL word -> viseme classes via g2p-pl.ts: ordered rules, no lexicon
   • word time distributed over the phonemes (vowels/diphthongs 1.2, consonants 0.8);
     35 ms SOFT minimum, renormalized inside the word window (hard floor 17.5 ms)
   • AY and AW emit two spans (own pose 60%, then the glide end pose IH / UH 40%)
        ▼  PhonemeSpan[] { phoneme, startMs, durationMs, glideOf? }  (anchors from ElevenLabs!)
mapPhonemeToShapes()                            src/lipsync/g2p/phoneme-visemes.ts
   • PHONEME_POSES (ARPAbet) + PL_PHONEME_POSES (PL_* classes) -> ARKit visemes
        ▼
VisemeScheduler.enqueue()  (no API change)
```

The spans of a word always sum to the word's time window and never cross its end (tested for every sentence of the golden-span corpus, `tests/lipsync-corpus.test.ts`).

### Components

| Module | Role |
| :--- | :--- |
| `g2p-en.ts` | `ensureG2pLoaded()` (lazy dynamic import of the committed, build-time-pruned `dict-en-pruned.json`: 10,000 words, ~259 kB / ~65 kB gz as a separate Vite chunk; the full 135k-word dictionary stays a devDependency, `npm run build:dict` regenerates the artifact idempotently), `wordToPhonemesSync()` (lexicon, then letter-to-sound rules for OOV words incl. silent letters and -tion/-sion; stress digits are stripped) |
| `g2p-pl.ts` | `g2pPl(word)` — Polish rules: digraphs, softness-i, nasals, final devoicing; no lexicon |
| `language.ts` | per-word language dispatch (`detectWordLanguage`) and the chunk-level `charsLookPolish` used by the character path |
| `phoneme-merge.ts` | `mergeCharAlignmentToPhonemes(alignment, { defaultLanguage })` — word timing from the alignment, window-invariant duration split, diphthong glide spans |
| `phoneme-visemes.ts` | `PHONEME_POSES` / `PL_PHONEME_POSES` (single source of truth for every consumer, incl. the Calibrator preview) and `mapPhonemeToShapes(phoneme)` — pose → ARKit combos (Left/Right symmetric) |
| `alignment-normalize.ts` | `normalizeAlignmentPayload(payload)` — the pure input normalizer (see the pipeline) |

> 📄 **Work on per-phoneme mouth poses:** `docs/en-visemes.md` — working document (description of articulation → ARKit parameters, analysis of "twin" visemes and the nuances that tell them apart).

### Operating rules

1. G2P is loaded lazily (`FaceController` preloads it in the constructor). Until `isG2pReady() === true` (the first moments; the pruned lexicon parses in ~15 ms) the character path runs for the EN engine — the avatar always speaks. The Polish engine needs no lexicon and starts at once.
2. No lexicon entry → rule-based letter-to-sound fallback (never an empty list for a word that has letters).
3. `source === 'energy-fallback'` (no alignment from the server) takes priority — then only the jaw ∝ RMS energy (see below) is driven, without text conversion.
4. The Studio Animation panel select "Lip-sync engine" chooses `phoneme-en`, `phoneme-pl` or `char` in real time (persisted in the settings blob; the legacy value `phoneme` migrates to `phoneme-en`). Words with Polish evidence are routed to the Polish rules by either phoneme engine.

### PL phoneme layer (Phase 17)

Polish orthography is nearly phonemic, so `g2p-pl.ts` is a left-to-right, longest-match-first rules engine that emits **viseme classes** (not IPA): shared ARPAbet keys where the mouth shape coincides (AA, EH, IY, AO, UW, IH, SH, ZH, CH, JH, W, Y, ...) and `PL_*` keys for the rest (`PL_H` the velar fricative of "ch"/"h", `PL_SI/ZI/CI/DZI` the soft sibilants, `PL_NI`, `PL_TS`, `PL_DZ`, `PL_AN/PL_EN` the nasal vowels).

* digraphs sz/cz/rz/ch/dz and the two-letter dz-acute / dz-dot; "ch" is **[x]**, not the English "church" pose;
* **softness-i**: ci/ni/si/zi/dzi followed by a vowel collapse into ONE soft consonant ("ziarno" = PL_ZI AA R N AO); before a consonant or at the end of the word the i stays a vowel ("zima" = Z IY M AA, no false softening);
* the acute letters are always soft, z-dot is ZH, l-stroke is W, o-acute is UW, a nasal e at the very end of a word is a plain e;
* **final devoicing** on the last token (b->p, d->t, g->k, w->f, z->s and the soft/dotted variants), e.g. "chleb" ends in P.

Control words are unit-tested without a model (`tests/g2p-pl.test.ts`). Mixed-language turns are handled per word only; automatic turn-level language detection is out of scope.

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
When `audio_event` does not carry `alignment`, `src/audio/energy-fallback.ts` generates substitute markers from the RMS energy of the signal (70 ms windows, `source: 'energy-fallback'`). `FaceController` then queues **only `jawOpen`** ∝ energy (no false vowels — before v1.1 the fallback inserted A/O/E/I and caused a rhythmic flapping of the mouth). Telemetry and the Studio badge (`ALIGN: EL ✓` / `ALIGN: FALLBACK ⚠`) show which source actually drives the mouth; in user mode a subtle chip "Simplified lip-sync" appears next to the status pill while the fallback is active and clears after two consecutive chunks with real alignment. The window count is rounded (a tail of at least half a window becomes a slice), silence yields no viseme, and an invalid sample rate is rejected loudly.

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
| `M`, `B`, `P` | `mouthClose`, `mouthPress*` | `1.00`, `0.15` | **closure** on the character path (the phoneme path uses the perceived-closure pose, see section 4) — the most important lip-sync test |
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

* **Blend-In** 35 ms (`viseme.blendInSec`): rise 0 → target value (cosine ease).
* **Hold**: the duration of the phoneme/character (EN: the phoneme span from `phoneme-merge`; PL/fallback: `char_durations_ms`).
* **Blend-Out** 45 ms (`viseme.blendOutSec`): fade out, unless the same key is taken over by the next phoneme.

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

### 4. Scale semantics and effective-value layering (v1.1, corrected in Phase 17)

The values in the mapping tables (character→viseme and phoneme→viseme) are **table values** — the scheduler multiplies them **exactly once**, by the scale from the calibration profile:

```ts
effective = tableValue × scaleForShape(shape)
contribution = maxVal × scaleForShape(shape) × easingWeight
scaleForShape(shape):           // per profile; closeScale 0.50 / 0.60 / 0.70 in subtle / balanced / expressive
  mouthClose / mouthPress*  → min(closeScale, common.mouthCloseCap = 0.85)   // the cap limits the SCALE
  jawOpen                    → jawScale
  mouthPucker                → puckerScale
  mouthFunnel                → funnelScale
  mouthRollLower, mouthShrug*→ rollScale
  mouthUpperUp*, mouthLowerDown* → teethExposureScale
  mouthSmile*                → smileScale
  (tongueOut and the rest)   → 1.0
```

Presets are **tasteful** multipliers around 1.0 for jaw, pucker, funnel, roll, teeth and smile (subtle 0.85 / balanced 1.00 / expressive 1.15), so 'A' jawOpen reaches ~0.55 instead of the squashed ~0.30 (the cause of the visual "flatness" before v1.1). `closeScale` is deliberately lower (0.50 / 0.60 / 0.70) because a high `mouthClose` pulls the lower lip onto the nose on MetaPerson.

**Worked example — bilabial closure under "balanced" (closeScale 0.60):** the closure is *perceived* closure, not `mouthClose` alone. The M/B/P pose is `jawOpen 0.02`, `mouthClose 0.50`, `mouthPress 0.58`, `mouthRollLower 0.25`, `mouthRollUpper 0.15`; the effective values are `mouthClose 0.50 × 0.60 = 0.30`, `mouthPress L/R 0.58 × 0.60 = 0.348`, `jawOpen 0.02`. The automated criterion is `mouthClose ≤ 0.35 ∧ mouthPress ≥ 0.3 ∧ jawOpen ≤ 0.05` (`tests/phoneme-visemes.test.ts`, `tests/lipsync-corpus.test.ts`); the old "effective mouthClose ≥ 0.85" goal was dropped because it is exactly what lifts the lip onto the nose. A `closeScale` above 0.85 is clamped to 0.85 (the cap applies to the scale).

**The closure-priority rule** still applies (bilabial jaw gate, Phase 11.2 SHOW-06): when `mouthClose` **or** `mouthPress` exceeds `viseme.closeJawThreshold` (0.15), `jawOpen` is suppressed: `closure = min(1, max(mouthClose/closeScale, mouthPress/pressRef))`, `jaw × max(0, 1 − closure × closeJawFactor)` with `closeJawFactor` 0.95 and `pressRef` 0.35 (the effective press of a full M/B/P). Press is part of the gate because a bilabial's `mouthClose` alone can be low on MetaPerson — this protects against the MetaPerson artifact where the "lower lip rides up under the nose". The effective `mouthClose` never exceeds `common.mouthCloseCap` (0.85) — one constant shared by the viseme and the frames track (the frames track clamps its absolute `mouthClose` to it). The old cap `min(closeScale, 0.28 + 0.5×jaw)`, which prevented full closure, was removed.

### 5. Lambda per muscle group (v1.1)

A single lambda = 18 was too slow for short EN consonants (40–80 ms) — the shape did not reach its target before the end of the phoneme (another cause of the "flatness"). Lambda now depends on the muscle group (base `cs` = `coarticulationSpeed` from the calibration profile — 30 in all presets; there is no fallback constant any more, the old λ = 18 default was dead code and was removed in Phase 16). The tier multipliers are `viseme.lambdaTiers` in `src/realism/anim-config.ts`:

| Group | Keys | Lambda |
| :--- | :--- | :--- |
| Closure | `mouthClose`, `mouthPress*` | `closure` 1.7 × cs — fast, sharp contact |
| Jaw | `jawOpen`, `tongueOut` | `jawTongue` 1.55 × cs |
| Rounded lips | `pucker`, `funnel`, `roll`, `shrug`, `upperUp`, `lowerDown` | 1.0 × cs |
| Smile | `mouthSmile*` | `smile` 0.45 × cs — slow return after a pause |

```ts
alpha(shape) = 1 − exp(−lambdaForShape(shape) × dt)   // independent of FPS
```

### 6. Emotion mix and shared clamps (Phase 16)

* **One emotion policy for both tracks.** While the avatar speaks, the base emotion (brows, cheeks, a gentle smile) is mixed in at `emotion.mixFactorSpeaking` = **0.3** in the viseme track *and* in the frames (A2F) track. **Behavior change:** the frames track used to apply 100 % of the emotion on the shapes the clip does not own; it now matches the viseme track. Rationale: when LIVE and A2F are compared A/B in the Studio, the two sources should differ in their *mouth*, not in how strongly the brows react. The smile emotion is still suppressed while `mouthClose` > `emotion.smileSuppressClose` (0.25), so M/B/P seal cleanly. (The unused A2E `carriesEmotion` path was removed; there is no producer for it.)
* **Speech subset.** The scheduler only drives `jaw*`, `mouth*`, `tongue*`, `cheek*`, `nose*`; its decay-to-zero rule therefore cannot touch eye/brow regions owned by gaze, blink and emotion ([docs/4](4-audio-and-barge-in.md)).
* **Shared constants** (`src/realism/anim-config.ts`, frozen `ANIM_DEFAULTS`): `common.mouthCloseCap` 0.85, `common.snapEpsilon` 0.001 (weights below it snap to a hard 0), `manual.jawGuardMargin` 0.20 (manual `mouthClose` ≤ `jawOpen` + margin), `relax.durationMs` 150, `relax.finishEpsilon` 0.005, `frame.dtCapSec` 0.1. Six of them are snapshot-tested (`tests/anim-config.test.ts`) so a change is always a conscious one. The user-facing `CalibrationProfile` (studio sliders) is separate and unchanged by this layer.

---

## 💻 Update loop (improved algorithm)

The previous version of this document had two bugs: (a) keys absent from the dictionary of active visemes **never returned to 0** (the mouth stayed open), (b) the fixed `lerp(…, 0.35)` depended on the FPS. The version below fixes both:

```javascript
// FaceController.render(dt) — called from the Three.js render loop.
// The only module that writes to morphTargetInfluences (docs/4).
render(dt) {
  const now = this.audibleClock();   // audio time actually HEARD (output latency compensated), see docs/4
  const targets = new Map(); // (shape → weight)

  // 1. Decay to zero (foundation rule): start from zero,
  //    contributions add up — keys without a contribution naturally tend to 0.
  const SPEECH_KEYS = this.speechShapeNames; // speech subset of the driver shapes (jaw/mouth/tongue/cheek/nose)

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
* **Forced closure**: for `M/B/P` the closure (press + roll, and `mouthClose` capped at 0.85 of scale) takes precedence over `jawOpen` through the closure-priority rule above — closure is visually dominant.
* Implementation in code: `src/lipsync/viseme-scheduler.ts` — `scaleForShape()`, `lambdaForShape()`, `update()`; all constants in `src/realism/anim-config.ts`. The per-frame hot path allocates nothing (scratch maps, in-place queue compaction — verified in `tests/hot-path-allocations.test.ts`).


---

## 🧪 Anti-robotic checklist (higher-quality speech)

* Punctuation (`.` `,` `?` `!`) = a 60–120 ms micro-pause with full closure — natural "breathing" between sentences.
* Never come back from a pause with a full smile — after a pause `mouthSmile*` rises more slowly (separate lambda: ~6).
* Micro-jitter on `jawOpen` (±1% noise at ~4 Hz) — removes the "perfect", unnatural flatness of the motion.
* Blinking during speech stays enabled (do not turn blinks off while the avatar speaks — it is the strongest signal of "aliveness").
