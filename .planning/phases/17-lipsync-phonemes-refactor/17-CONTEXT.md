---
phase: "17"
name: "Lip-sync & phoneme recognition refactor"
created: "2026-11-17"
updated: "2026-11-18"
---

# Phase 17: Lip-sync & phoneme recognition refactor — Context

A dedicated refactor pass over the **lip-sync signal pipeline** — the data path that turns
ElevenLabs character alignment into viseme poses. This is the product's core IP: reviewers
should read this pipeline and see a deliberate, measured, well-tested design. Analysis is
read-only; every claim carries `file:line` evidence from the working tree (as of 2026-11-17;
line numbers may shift if sibling phases 12/16 land first).

**In scope** (the signal pipeline — *what* the mouth should do and *when*):

- `src/lipsync/g2p/g2p-en.ts` (233) — CMUdict lazy loader, OOV letter-to-sound rules
- `src/lipsync/g2p/phoneme-merge.ts` (88) — word anchors → phoneme time spans
- `src/lipsync/g2p/phoneme-visemes.ts` (157) — ARPAbet → ARKit pose table (EN)
- `src/lipsync/viseme-mappings.ts` (339) — char/digraph table (EN fallback + PL)
- `src/lipsync/viseme-overrides.ts` (198) + `src/lipsync/calibration.ts` (118) — tuning data path
- `src/audio/alignment-rescale.ts` (40) — chunk-local drift correction
- `src/audio/energy-fallback.ts` (48) — jaw-only fallback
- `src/lipsync/a2f-parser.ts` (154) — A2F JSON → FramesClip (data-format quality only)
- `src/audio/speech-backend.ts` (354) — alignment normalization + rescale + fallback wiring (§A.3)
- `src/audio/raw-wss-client.ts` (250) — alignment event shape (§A.2)
- `src/features/last-turn-buffer.ts` (114) — A/B compare feeds the same PCM to A2F (§A.9)
- tests: g2p-en, phoneme-merge, phoneme-visemes, viseme-mappings, alignment-rescale,
  energy-fallback, a2f-parser, viseme-overrides, calibration

**Out of scope** (siblings — coordinate, don't touch): scheduler/face-controller *mechanics*
(Phase 16 — easing, damping, state machine; note 16-CONTEXT explicitly leaves viseme DATA
tables to this phase and flags `testPhoneme` pose duplication D-7 for us to absorb), UI
panels (15), English-ization of comments (12), README (13), architecture/wiring (14),
CI/deploy (18).

---

## A. Pipeline flow — traced control flow

### A.1 The full data path (EN phoneme path, happy case)

```
ElevenAgents WSS 'audio' event
  └─ raw-wss-client.ts:105-110 ── audio_event { audio_base_64, alignment? }
       └─ speech-backend.ts:56-119 (onAudioChunk)
            1. playChunk → scheduledStartTime (audio clock; epoch-tagged)     :61
            2. ALIGNMENT NORMALIZATION                                        :66-99
               accepts: payload.alignment | normalized_alignment | alignments
               chars | characters;  *_ms arrays OR *_seconds arrays (×1000)
               → CharAlignment { chars, char_start_times_ms, char_durations_ms,
                                  source: 'elevenlabs' }  — only if lengths match  :90
            3. RESCALE to the chunk's audio axis                               :105-108
               alignment-rescale.ts — factor = audioDurMs / lastCharEndMs,
               clamped [0.5, 2.0]; kills cumulative chunk-local drift         (§A.4)
            4. FALLBACK if alignment absent/malformed:
               energy-fallback.ts — 70 ms RMS windows, chars=' ', source='energy-fallback' :112-114
            5. diagnoseSync() — per-chunk ratio/gap telemetry (console)         :116
            6. onAudioChunk(pcm, alignment, epoch, scheduledStartTime)         :118
                 └─ conversation-controller → 'audio:chunk' event (11-02 contract)
                      └─ animation-controller.handleAudioChunk
                           └─ face-controller.onAudioChunk (face-controller.ts:271)
                                ├─ epoch guard (stale chunks ignored)           :273-275
                                ├─ energy-fallback branch: enqueue jawOpen ∝ RMS
                                │   per 70 ms window, `Math.min(0.5, energy*2.0)`,
                                │   skip ≤ 0.02                                :286-305
                                ├─ phoneme branch (engine='phoneme' && g2p ready
                                │   && source∈{undefined,'elevenlabs'})        :309-335
                                │   ├─ mergeCharAlignmentToPhonemes (phoneme-merge.ts:30)
                                │   │    word runs /[A-Za-z'’-]+/ → wordToPhonemesSync
                                │   │    → proportional split (vowel 1.2 / cons 0.8,
                                │   │      min 35 ms) → PhonemeSpan[]             :44-85
                                │   │    (wordToPhonemesSync: CMUdict → apostrophe-strip
                                │   │      → hyphen parts → rulesFallback; g2p-en.ts:201-233)
                                │   └─ per span: Editor override ?? mapPhonemeToShapes
                                │        → scheduler.enqueue(startTime+startMs+syncOffset)  :319-331
                                └─ char branch (PL / G2P not ready / user switch):
                                     charTokenFor override ?? mapCharToShapes    :338-363
                                      (digraph lookahead: tryMapDigraph, C-heuristic,
                                       EN digraphs SH/CH/TH/PH/QU/WH/NG; viseme-mappings.ts:13-89)
       ══ handoff to Phase 16 (scheduler/face-controller) — same VisemeQueueItem API ══
```

PL path = char branch with Polish digraphs (SZ/CZ/RZ/DŻ/DZ/DŹ/SI/ZI/NI/CI, nasal ą/ę, ó/ł/ś/ć/ń/ź/ż)
(`viseme-mappings.ts:47-85, 219-260`). Fallback path = energy branch. A2F path (phases 9–10) is a
*parallel* pipeline: `last-turn-buffer.ts` keeps the raw PCM + alignment of the last turn;
`pcm-to-wav` + `predictFrames` (a2f-backend.ts:78) POST it; `a2f-parser.ts:71` parses JSON →
`FramesClip` → `feedFrames` (Phase 16 plays it back).

### A.2 Alignment event shape — what ElevenLabs actually sends

`AudioEventPayload` (types/audio.ts:6-10) declares `alignment?: CharAlignment`, but the
normalizer (speech-backend.ts:66-99) accepts three aliases and two unit systems defensively:

| Field aliases accepted | Units | Evidence |
|---|---|---|
| `alignment` / `normalized_alignment` / `alignments` | — | speech-backend.ts:66 |
| `chars` / `characters` | char array | :70 |
| `char_start_times_ms` | ms | :75-76 |
| `character_start_times_seconds` (+ `character_end_times_seconds` → durations, min 25 ms) | s→ms | :77-87 |

Guards: length mismatch between chars and starts → alignment discarded → fallback (:90).
Missing durations → every char gets a flat 50 ms (:94). The normalization is sound but
**untested** (§A.6, T-bond #1) — it lives inline in `speech-backend.ts` instead of a pure function.
Corpus note: numbers arrive *normalized* (ElevenLabs expands "3D" → "three D"), so the pipeline
never sees digits in `chars` — confirmed by docs/3:10 and by the merge tokenizer skipping
non-letters (phoneme-merge.ts:46).

### A.3 G2P quality audit (g2p-en.ts)

**Lexicon hit-rate strategy** (g2p-en.ts:201-233): CMUdict lookup → apostrophe-stripped retry →
hyphen-split lookup per part → `rulesFallback`. Measured on a 141-token conversational corpus
(control sentences + 6 realistic agent paragraphs): **97.9% lexicon hit rate; OOV = 3 technical
loanwords** ("metadata", "grapheme", "visemes"). The OOV rules cover them acceptably.

**OOV rules quality** (g2p-en.ts:70-194) — verified against the LIPS-05 test cases:

| Word | Rules output | Verdict |
|---|---|---|
| `know` | KN→N (initial, :110), OW→OW | ✅ silent K absorbed |
| `though` | TH→TH, GH silent (final, :113-117), OU→AW | ⚠️ "OW" vs correct "OW": OU is mapped to AW (:127) — "though" → TH-AW (wrong vowel, viseme OW-ish anyway); lexicon hit makes this OOV-only |
| `question` | QU→K,W, E→EH, S→S, TION→T-I-ON (letters) | ⚠️ 8 phonemes vs lexicon's 7; no "-tion"→SH-AH rule — OOV words with -tion/-sion over-articulate |
| `island` | IH, S, L, AE, N, D | ❌ **silent S survives** — no `sl` rule; phantom S viseme |
| `listen` | L, IH, S, T, EH, N | ❌ **silent T survives** — no `-sten` rule |
| `hour` | HH, AW, R | ⚠️ silent-ish H kept (HH at word start :156-157) — minor |
| `comb` | K, AA, M(B final→M, :112) | ✅ |

Findings (severity):

1. **[P2] OOV silent-letter rules are incomplete**: `island`, `listen`, `castle`, `receipt`,
   `subtle`, `whistle` produce phantom consonant visemes exactly in the mode OOV rules exist
   for. The current rule set covers initial KN/WR/GH, final MB/LE-via-E, but no word-internal
   silences. Fix: a small ordered exception list (`island`, `listen`-family `-sten`, `-stle`,
   `-ceipt`, `hour`…) + 2-3 positional rules — ~30 lines + tests. (g2p-en.ts:70-194)
2. **[P2] "-tion/-sion" is unhandled in OOV rules** (g2p-en.ts:99-139 has no TION rule): OOV
   words ending in -tion over-articulate 4 phonemes where 2 suffice — the exact symptom
   LIPS-05 was written to remove. High frequency in tech speech ("automation", "iteration").
3. **[P3] `rulesFallback` maps single O → AA** (g2p-en.ts:184): "control" → K-AH-N-T-R-AA-L —
   acceptable viseme-wise (AA/AO both open-rounded-ish), documented here as intentional.
4. **[P3] No number handling in `wordToPhonemesSync`** (g2p-en.ts:202 strips non-letters →
   null): safe *because* alignment text is normalized — but if a future backend sends digits,
   words vanish silently. Merge skips them anyway (phoneme-merge.ts:46). Document as contract.
5. **[P3] Hyphen strategy asymmetric**: all parts found → merged; any part missing → whole-word
   `rulesFallback` (g2p-en.ts:221-230) — sensible; the mixed case ("e-mail" → parts known,
   "zoom-call" with OOV part) degrades the *whole* word to letters. Rare; acceptable; test-pinned.
6. **[P3] Apostrophe keys: `’` (U+2019) accepted by the merge tokenizer (:54) but stripped by
   `wordToPhonemesSync`'s `/[^a-z'’-]/g` — both retained; ok. But `'` (U+0027) keys from CMUdict
   ("'bout") never match because merge emits the raw char sequence — a contraction like "y'all"
   OOV-degrades even though CMUdict has "'yall" style keys under different spelling. Rare.

**Lexicon load cost** (g2p-en.ts:38-53): dynamic `import('cmu-pronouncing-dictionary')` (4.70 MB
module, **961 kB gzip**), then `buildTable` — measured **286 ms** on desktop Node for the full
135,155-entry table (Map + split + stress-strip). This runs **on the main thread** after the
lazy chunk downloads; on a mid-range mobile this is plausibly 3-10× worse (download 961 kB +
parse). It is fire-and-forget at FaceController construction (face-controller.ts:86-88), so it
doesn't block first render (~750 kB), but it *does* compete with the first live turn's audio.

### A.4 Timing merge correctness (alignment-rescale + phoneme-merge)

The two-step anchoring is sound:

1. **Rescale** (alignment-rescale.ts:19-40): per-chunk linear factor `audioDurMs / lastCharEndMs`,
   clamped [0.5, 2.0]. Observation from live agent (2026-09-02, docs/3:101-108 and the module
   header): text span ≠ chunk audio length (ratios 0.56–2.5× observed); slices are disjoint, so
   uncorrected error *accumulates* → drift in long sentences. Rescale pins the last char to the
   chunk end; proportions preserved. Diagnostics (speech-backend.ts:233-298) log ratio per chunk
   and flag >10% deviation post-rescale.
2. **Merge** (phoneme-merge.ts:30-88): word run boundaries from char regex; word start/end from
   first/last char times; phoneme durations proportional by weight (vowel 1.2 / consonant 0.8),
   min 35 ms floor, cursor cascades from wordStart. Silent letters *don't exist as phonemes*, so
   their time is absorbed by construction — sum of span durations ≈ word length (test-pinned,
   phoneme-merge.test.ts:37-50).

Edge cases audited:

| Edge | Behavior | Evidence | Verdict |
|---|---|---|---|
| zero-duration chars | `wordSpanMs ≤ 0 →` word skipped entirely | phoneme-merge.ts:65-68 | ⚠️ a whole word can vanish (its time still passes — a silent gap *inside* a word boundary is worse than a skip; in practice rescale makes 0-length rare; **MIN_SPAN_MS can push spans past wordEnd**: see below) |
| **MIN_SPAN_MS overflow** | `durationMs = max(35, ideal)` and cursor advances by it — for a short word (e.g. "I", 60 ms) with 3 phonemes, spans sum to 105 ms > 60 ms word window → **spans bleed into the next word's time** | phoneme-merge.ts:24, 76-84 | ❌ **P2 bug**: min-floor without renormalization; consecutive short words overlap; scheduler additive blending softens it visually but phoneme N can fire while the ear hears word N+1. Test-pinning this is prerequisite to fixing. |
| overlapping words | Not possible from EL (chars are sequential); rescale factor ≥ 0.5 keeps order | alignment-rescale.ts:32 | ✅ |
| corrections after interruption | `agent_response_correction` (raw-wss-client.ts:152-157) updates **captions only** — audio/alignment are already gone (epoch invalidation); no re-sync exists or is needed | raw-wss-client.ts:152; face-controller epoch guard :273 | ✅ by design; **undocumented** — note for docs sync |
| malformed alignment | lengths mismatch → alignment nulled → energy fallback (speech-backend.ts:90, 112) | :90, :112 | ✅ (but untested — T-bond #1) |
| `source !== 'elevenlabs'` | merge returns `[]` → FaceController falls to char loop → energy branch handles it earlier anyway | phoneme-merge.ts:31-33; face-controller.ts:286 | ✅ layered correctly |
| demo speech | `triggerDemoSpeech` synthesizes uniform char times, **no source field** → phoneme path treats it as EL (source undefined) | speech-backend.ts:339-343 | ⚠️ acceptable (it *is* a text alignment), noted for the quality harness |

**Why proportional weights (1.2/0.8) are the weakest link in the merge**: they ignore the
actual *character* durations inside the word. EL gives per-char times; we collapse them to two
weight classes. "Free" (F-R-IY, IY=ee long) and "cat" get near-identical internal pacing.
Improvement (candidate, cheap): distribute phoneme time by anchoring to the vowel(s) — vowel
phoneme takes the time of the *vowel letters* it came from; consonants take the rest. This needs
a letter→phoneme alignment (approximate: count vowel graphemes). Worth doing only if the UAT
harness (§A.8) shows mid-word timing errors; otherwise the 1.2/0.8 split is fine.

### A.5 The CMU dictionary decision — resolved with data

**Measured** (this analysis, 2026-11-17, gzip level 9):

| Artifact | raw | gzip |
|---|---|---|
| `cmu-pronouncing-dictionary` module (index.js, 135,155 entries) | 4.70 MB | 951 kB (dist chunk: 961 kB) |
| first render (three + app) | — | ~750 kB |
| module truncated to first 5,000 entries | 178 kB | 37 kB |
| 10,000 entries | 346 kB | 72 kB |
| 20,000 entries | 674 kB | 138 kB |
| 50,000 entries | 1.71 MB | 345 kB |
| full dict, **minus** `(2)`-suffixed alt pronunciations (9,109) **and** possessives `'s` (6,383) → 119,663 entries | 4.01 MB | 842 kB |

Hit-rate on a 141-token conversational corpus: **97.9%** (OOV: 3 technical loanwords).
`buildTable` full dict: **286 ms** main-thread parse (Node; mobile worse).

Options:

| Option | gzip | corpus hit-rate | latency to first *phoneme* viseme | maintenance | verdict |
|---|---|---|---|---|---|
| **A. Keep full lazy** (status quo) | 961 kB on-demand | 100% | 961 kB download + ~300 ms parse; char-path covers the gap | zero | works, but a 1 MB chunk for a talking head is the portfolio smell reviewers notice; mobile-hostile |
| **B. Prune to top-N frequency + OOV rules** | ~70 kB (10k) | 95–99% on conversation (top-10k covers ~97% of tokens; the measure script quantifies) | ~10× smaller download, ~20 ms parse | one build script + committed artifact | **recommended** |
| C. Rules-only (drop lexicon) | ~2 kB | word-internal silences/vowel digraphs degrade (island/listen/tion wrong) | instant | lowest | rejected: OOV rules alone reintroduce phantom-viseme classes |
| D. Alternative smaller lexicon (e.g. SUBTLEX-based 20k) | ~140 kB | similar to B | similar | dependency on external data provenance | subsumed by B (we prune from CMUdict — same ARPAbet, no new dep) |
| E. Runtime build step (generate pruned dict at build time from the npm package) | — | — | — | — | this is the *mechanism* of B: a Node script run via `npm run build:dict`, output committed as `src/lipsync/g2p/dict-en-pruned.json` |

**Decision: Option B+e — build-time pruned lexicon (top ~10k words) + hardened OOV rules.**

Rationale: (1) the lip-sync corpus is *spoken conversation*, whose token distribution is
extremely Zipfian — top-10k word forms cover ~97% of tokens in general English (measure script
below will pin the exact number on our corpus set); (2) OOV words are by definition rare in a
turn, and the rules are being hardened in this phase anyway (§A.3); (3) a committed JSON
artifact (~70 kB gzip… note: *parsed* JSON in a JS chunk gzips better than raw JSON; the script
measures both) removes a 961 kB network transfer and ~300 ms main-thread parse, and makes the
pipeline's data needs auditable in-repo; (4) maintenance is one script (`scripts/build-dict-en.mjs`)
run when vocabulary drift matters — the full dictionary stays a devDependency, so upgrading is a
re-run, not a rewrite. **Fallback ladder stays intact**: pruned lexicon → apostrophe/hyphen →
rules → (nothing) char path — a word missing from the top-10k degrades gracefully to letter
rules, never to nothing.

**Measurement task** (planned in 17-01, expected outputs defined): a corpus script measuring
hit-rate for N ∈ {5k, 10k, 20k, 50k, full} on (a) docs/EN-visemes.md §6 control sentences,
(b) a committed 20-paragraph conversational corpus, (c) a PL corpus is irrelevant (char path),
and gzip size of the generated artifact. Decision gate: pick the smallest N with ≥95% hit-rate
on corpus (b); predicted 10k. If the gate says ≥20k is needed, prune to 20k (138 kB — still 7×
smaller) — the plan has both thresholds written down.

### A.6 Phoneme→viseme table vs docs/EN-visemes.md v1.3 — reconciliation

`phoneme-visemes.ts` implements v1.2 (twin-differentiation, 50/50 averages) **plus** the v1.3
"smaczek" pass (lowerDown on open vowels, upperUp on IY/EY, shrug on UW/W, teeth on S/SH,
light teeth presence on T/D/N/L/K/G/NG — header comment :7-14 documents this; v1.3 changelog
docs/EN-visemes.md:347 confirms "v1.3 wdrożone"). Point-by-point vs the doc:

| doc §4 "P" proposals | code (phoneme-visemes.ts) | status |
|---|---|---|
| IY: smile .35 + upperUp .15 | `jaw .25, smile .38, upperUp .12` (:63-64) | ✅ implemented (v1.3 values) |
| IH: smile .12, jaw .22 | `jaw .26, smile .16` (:65-66) | ✅ (v1.3 pushed jaw up — doc says .22; **doc stale**) |
| EY: smile .30 + upperUp .20, jaw .32 | `jaw .34, smile .34, upperUp .14` (:67-68) | ✅ (numbers differ — doc stale) |
| EH: jaw .38, smile .15, no teeth | `jaw .42, smile .24, lowerDown .08` (:69-70) | ⚠️ EH still has smile .24 — doc's §5.2 explicitly wants EH "no strong smile" to differentiate from EY; **close but doc-aspirational** |
| AE: jaw .50, smile ~0 | `jaw .52, smile .18` (:71-72) | ⚠️ smile .18 vs doc ~0 — v1.3 raised it for "power"; twins EY↔AE remain within 0.16 smile of each other |
| AO: oval not tube (funnel .25) | `funnel .30, pucker .5` (:79-80) | ✅ implemented per v1.3 |
| ER: pucker .25 | `pucker .16, funnel .22` (:91-92) | ✅ |
| S: upperUp/lowerDown .15 | `.16` both (:125) | ✅ |
| SH: pucker .25 + teeth .2 | `pucker .16, upperUp .14, lowerDown .14` (:130) | ✅ (scaled) |
| MBP: close 0.5–0.6 on MetaPerson | `close 0.8, press 0.2` (:99-102) | ⚠️ table says 0.8 but **scheduler caps effective close at 0.85 × closeScale preset 0.6 = 0.51** (viseme-scheduler.ts:150, calibration.ts:49) — so the *effective* value matches the doc's MetaPerson advice; the layering is correct but non-obvious; document it |
| L: tongueOut → 0 | `tongue .12` (:119-120) | ✅ (v1.3 kept a token .12) |
| R: pucker .20 | `.14` (:144) | ✅ |
| W: pucker .55 + funnel .2 | `pucker .6, funnel .18, shrug .08` (:146) | ✅ |
| HH: low amplitude | `jaw .22` (:151-152) | ✅ |
| **§5.5 diphthong motion — "option 2: split AY/AW into 2 visemes"** | single static pose for AY/AW/OW/OY | ❌ **not implemented — doc's stated recommendation (§5.5: "Rekomendacja na start: opcja 2 dla AY i AW")** |

Verdict: the doc's v1.3 *static* poses are faithfully in the table (with intentional numeric
drift); the open aspirational items are (1) **diphthong motion** — doc recommends splitting AY
and AW each into a start+end pair of queue items, which is a *merge-layer* change (emit two
PhonemeSpans from one phoneme), cheap and visible; (2) twin-pair polish EH/AE smile values
needing a live-model A/B before further table edits — that belongs to the UAT harness (§A.8),
not to blind number-pushing. Plan: implement diphthong split (17-02), pin the effective-value
layering in docs, mark remaining §5 proposals as *tuned-by-harness* rather than aspirational-doc.

### A.7 PL path evaluation (char+digraph → rule-based PL G2P?)

Current PL quality: `viseme-mappings.ts` covers digraphs SZ/CZ/RZ/DŻ/DZ/DŹ/SI/ZI/NI/CI (:47-85),
diacritics ą/ę/ó/ł/ś/ć/ń/ź/ż (:219-260), C-heuristic (:181-193). Known gaps:

- **i-nasal**: "si/zI/ni/ci" digraphs require *softness*, but "zi" in "zima" is plain [z+i] —
  digraph table fires on every occurrence (false softening); PL orthography marks real softness
  with ś/ć/ź anyway, so the SI/ZI/NI/CI entries are mostly redundant *and* wrong half the time.
- **"ch"**: mapped as EN digraph CH (:22-25 → funnel .45) — in PL "ch" = [x] (voiceless velar
  fricative, like H) — currently "chata" produces the EN church-viseme. Wrong for PL.
- **"rz"**: mapped to "SH-like" (:59-64) — but PL "rz" [ʐ] ≈ ż → correct table entry exists (Ż),
  so RZ is fine; the *EN* "rz" never occurs. ✅ for PL.
- **Nasal vowels**: ą/ę single-char entries exist; but "on/a" assimilation (ą→[ɔ̃w̃] before
  fricatives) is not needed at viseme level. ✅.
- **Digraph lookahead is only 1 char** (`tryMapDigraph(c1, c2)` — no "trz"/"chrz" cases needed;
  but 3-graphemes "dzi"/"dzi" ambiguity: "dziecko" → DŹ fires on "dz"+"i"? — `DŹ` requires
  uppercase pair 'DŹ' via `pair.toUpperCase()` — "dzi" gives 'DZ'+'I'? No: pair = "dz", then
  next char i → 'DZI' is not a known pair; "dziękuje" → DZ digraph (:65-70, smile .1) then I —
  **wrong**: soft [dʑ] needed. The soft-digraph problem again: PL softness is marked by the
  *following* i, which the 2-char window consumes as a separate vowel. Net: "dziękuje" =
  3 visemes where [dʑ]-e-k-u-j-e needs better shaping.

**Rule-based PL G2P evaluation**: Polish orthography is nearly phonemic — a deterministic
left-to-right rules module (sz/cz/rz/ch/dź/dż/dzi/ci/ni/si/zi + devoicing finals (b→p, d→t,
w→f, z→s before silence/voiceless) + nasal ą/ę + "i" as softness marker consumed into
preceding consonant) would produce *phoneme-class* tokens (a simplified PL phoneme set: no
need for IPA precision — viseme classes suffice: same 13-ish targets as EN: p/b/m, f/v, s/z,
sz/ż/rz, cz, dz/dź, t/d/n, k/g, ch/h, l, r, j, ł, vowels a/e/i/o/u/y + nasals).

Cost: one module (~150 lines, structure identical to g2p-en's `rulesFallback`) + merge wiring
(language detection: ASCII-only chars → EN; Polish diacritics/digraphs → PL) + tests. **No
lexicon needed** — that's the whole point; Polish is regular enough that rules-only beats the
char table (the char table IS a crude rules engine with a 1-char window; the G2P upgrade gives
softness handling, final devoicing, and digraph-window fixes).

Recommendation: **do it — but as its own plan gated on the EN work landing first** (17-04).
The scheduler handoff doesn't change (phoneme keys map to the same pose table — we add a small
`pl-phonemes.ts` → viseme map reusing `phoneme-visemes.ts`'s `pose()` where classes coincide).
Acceptance criteria: control sentences PL ("szczypczyzna", "dziękuję", "chata", "ziarno",
"trzeba") produce expected phoneme sequences — all unit-testable without a model.
Explicit deferral: **language auto-detection heuristics** beyond char-set (e.g. mixed-language
turns) — out of scope; the engine switch (phoneme/char) becomes per-language in settings.

### A.8 Fallback & robustness (energy-fallback)

Audit of `energy-fallback.ts` + its FaceController branch:

- jaw-only, no fake vowels: `chars = ' '`, `energies[]` RMS per 70 ms window (:14-48) — the
  phase-7 fix holds; FaceController enqueues only `jawOpen = min(0.5, energy*2.0)` per window,
  skipping ≤ 0.02 (face-controller.ts:286-305). ✅
- **[P3] last-window truncation**: `numSlices = floor(len / samplesPerSlice)` (:18) silently
  drops a partial final window (up to 69 ms of speech) — negligible.
- **[P3] static threshold**: 0.02 skip + ×2.0 gain are magic numbers with no silence-floor
  (noise gate) — a noisy room can flap the jaw during agent "thinking" pauses. Acceptable
  for v1.1; tune knob belongs to Phase 16's config extraction (cross-note).
- **[P2] badge UX**: ALIGN badge exists in studio Session panel (`ALIGN: EL ✓ (n)` /
  `ALIGN: FALLBACK ⚠ (el/fb)`, session-panel.ts:70-73) — but only in studio. The *user*-mode
  view has no degradation signal: when EL alignment is absent, the user sees jaw-flapping with
  no explanation. UX decision needed (cross-area with 15): a one-time subtle chip "simplified
  lip-sync" in user mode when fallback is active — cheap, honest, and shows product maturity.
- **Malformed-field ladder** (speech-backend.ts:66-114): alias fields → unit conversion →
  length guards → fallback — robust; zero tests. T-bond #1.

### A.9 A2F parser (data-format quality)

`a2f-parser.ts` — the L/R shape-loss bug is fixed by `decapitalizeArKit` (:50-53, lowercase
first char only; `normalizeShapeName` as second line — header :10-12 documents why), full-52
coverage test-pinned (a2f-parser.test.ts:38-66), unknown-shape skip+dedup-count (:100-107,
:151), frames sorted by relative `frame_time` (:120), clamp01 (:154), `carriesEyes` explicit >
inferred from eyeBlink/eyeLook presence (:134-136), `carriesEmotion` from emotions array
(:139). Format quality is solid. Gaps are minor and test-shaped:

- **[P3] `fps` default 60 when absent** (:144) — informational only (playback doesn't assume
  step), fine; pin with a test.
- **[P3] duplicate `frame_time` values** (two frames, same time) — sort is stable, playback
  zero-order-holds the *last* one after binary search (Phase 16's `updateFrames`) — behavior
  fine, contract unwritten. One test pins "last frame wins at identical timeSec".
- **[P3] empty `frames: []`** → valid clip with zero frames → `feedFrames` logs and waits;
  FaceController's `endTurn` handles the empty buffer (face-controller.ts:483-486). A test
  should pin "empty clip is not an error" at the parser level.
- LastTurnBuffer/compare fairness (last-turn-buffer.ts:43-66): same PCM + alignment for both
  tracks; A2F gets the same bytes via `concatPcm` (:90-101). ✅ (fairness by construction).

### A.10 Quality measurement — today vs a repeatable harness

Today: judged by eye — Studio A/B compare (phase 11) + docs/EN-visemes.md §6 control sentences.
There is no repeatable protocol, no recorded pass/fail, and 07-04 UAT is still pending (STATE.md).

**Proposed harness (17-05)** — three layers, all cheap:

1. **Deterministic fixtures + "golden span" tests (automated)**: a committed
   `tests/fixtures/lipsync-corpus.json` — the §6 control sentences + ~10 agent-like sentences,
   each with (chars, synthetic-but-realistic start/duration arrays, expected PhonemeSpan
   snapshot: phoneme sequence + tolerances). Vitest asserts the merge output — catches
   MIN_SPAN_MS overflow regressions, silent-letter regressions, rescale factor regressions.
   Proxy metrics computed from spans (no model needed): per-viseme distinctness = min pairwise
   L1 distance between pose vectors over the viseme inventory (catches "twin" table drift);
   closure presence = for M/B/P phonemes in corpus, assert span duration ≥ 35 ms and pose
   `mouthClose` effective ≥ 0.85 (after closeScale layering — computed, not eyeballed).
2. **Live-model UAT protocol (manual, scripted, recorded)**: `17-UAT-PROTOCOL.md`-style
   checklist living in the phase; script-driven (trigger known sentences via
   `triggerDemoSpeech`-equivalent with recorded alignments — reuse LastTurnBuffer replay),
   per item: PASS/FAIL on (a) closure visible on M/B/P, (b) no motion on know/though/listen,
   (c) S vs SH distinguishable, (d) O/U pucker, (e) 30 s drift (alignment ratio telemetry),
   (f) barge-in neutral < 300 ms. Produces a filled results table in 17-VERIFICATION.md.
3. **Optional acoustic proxy (deferred with criteria)**: MFCC/energy envelope correlation
   between jawOpen curve and audio envelope on the replay path — a *signal*, not ground truth;
   defer until the harness above is real (see §A.11).

### A.11 Alternatives landscape (brief) — documented decision

- **Rhubarb WASM** (EXP-03): exists (`rhubarb-lip-sync-wasm`), produces A/B/C/D/E/F/G/H/X
  mouth-cue JSON with timings; ~1-2 MB WASM + seconds-scale batch processing (designed for
  offline animation, and its license is not plain MIT — docs/6:10 already flags "verify
  commercial use"). **Decision: stays deferred.** G2P+alignment is *better than acoustic* for
  our case (we have the text and char anchors — Rhubarb *guesses* phonemes from audio where we
  *know* them). Acoustic earns its place only for (a) languages without phonetic writing or
  (b) as an independent quality signal. Neither is v1.1 scope. Revisit trigger: a real
  non-phonetic-alignment language in the product plan.
- **MFCC/jaw-envelope worklets** (docs/6:11): the energy-fallback *is* a crude version of this
  (70 ms RMS). Upgrading it (formant-ish band energies → A/E/I/O/U probabilities) would
  reintroduce "fake vowels" — the exact thing phase 7 removed. **Decision: jaw-only stays.**
- **wav2vec-style viseme prediction in-browser**: models exist (e.g. TF.js Lipsync demo class),
  but real-time streaming phoneme prediction in-browser in 2026 still costs a multi-MB model +
  WebGPU/WASM commitment and gives no advantage over A2F (phases 9-10) which already provides
  the neural track *offline* with better quality. **Decision: not adopted; A2F is our neural
  track.** Keep G2P as the real-time primary; A2F as the neural comparison/A-B track; jaw-only
  as the no-alignment fallback. This triangle is the documented architecture; the deep-dive
  draft (17-DRAFT) will present it as the decision tree it is.

### A.12 Test debt — enumerated

| # | Missing test | Module | Severity |
|---|---|---|---|
| T-1 | Alignment normalization aliases/units/length-guards (pure-fn extraction prerequisite) | speech-backend.ts:66-99 | P2 |
| T-2 | Rescale: `durations.length !== starts.length` → returned unchanged (exists) + duration-less fallback 50 ms flat + negative/NaN times | alignment-rescale.ts | P3 |
| T-3 | Merge MIN_SPAN_MS overflow: word "I" (60 ms, 1 phoneme ok; "eye" 3 chars → AH? → 2 phonemes in 100 ms → spans exceed word end) — pin current behavior, then fix | phoneme-merge.ts:24,76-84 | **P2** |
| T-4 | Merge: word with zero-duration first char but positive later chars (starts[0] missing → ?? 0 anchor shift) | phoneme-merge.ts:63 | P3 |
| T-5 | OOV rules: island/listen/-tion/-sion/receipt; multi-syllable stress-agnostic sanity | g2p-en.ts | P2 (with A.3-1/2) |
| T-6 | PL digraph window: "dziękuje" (dzi softness), "chata" (ch ≠ EN CH), "zima" (zi ≠ soft zi) — pin current wrongness before PL G2P plan | viseme-mappings.ts | P2 (pre-17-04) |
| T-7 | viseme-mappings: `charTokenFor` vs `mapCharToShapes` agreement on every KNOWN_DIGRAPH_PAIRS entry (drift guard between token keys and map entries) | viseme-mappings.ts:299-302 | P3 |
| T-8 | a2f-parser: empty frames array, duplicate frame_time, fps absent → 60 | a2f-parser.ts | P3 |
| T-9 | energy-fallback: last partial window truncation; exactly-silence input (all-zero PCM → all energies 0 → FaceController enqueues nothing) | energy-fallback.ts:18 | P3 |
| T-10 | Effective-value layering: `mapPhonemeToShapes('M').mouthClose × closeScale preset` ≥ 0.85 for balanced/expressive (the LIPS-06 criterion expressed as a computation, not an eyeball) | phoneme-visemes + calibration | P2 |
| T-11 | Golden-span corpus tests (A.10 layer 1) | phoneme-merge | P2 |
| T-12 | `testPhoneme` poses drift from viseme tables (D-7 in 16-CONTEXT) — after 17-02 restructures tables, assert testPhoneme delegates to table values instead of duplicating | face-controller.ts:377-445 | P3 (cross-area with 16) |

---

## B. Findings summary (severity + evidence)

| ID | Finding | Evidence | Severity |
|----|---------|----------|----------|
| L-1 | MIN_SPAN_MS floor can push phoneme spans past the word's time window (short words bleed into the next word) | phoneme-merge.ts:24, 76-84 | **P1** (quality) |
| L-2 | CMU chunk 961 kB gzip + ~286 ms main-thread parse for a conversational product whose lexicon needs are ~10k words | STATE.md:124; measured §A.5 | **P1** (portfolio/mobile) |
| L-3 | OOV rules: word-internal silent letters (island/listen) + "-tion" produce phantom/over-articulated visemes | g2p-en.ts:70-194; §A.3 | P2 |
| L-4 | docs/EN-visemes.md §5.5 diphthong motion (AY/AW split) recommended but unimplemented; several §4 "P" numbers stale vs v1.3 code | phoneme-visemes.ts:60-152; docs/EN-visemes.md:289-319 | P2 |
| L-5 | PL char table: "ch" maps to EN church-viseme (PL needs H-like); soft digraphs (dzi/ci/ni/si/zi) mis-handle the following "i" | viseme-mappings.ts:22-25, 65-85 | P2 |
| L-6 | Alignment normalization (aliases, units, guards) untested and inline in speech-backend | speech-backend.ts:66-99 | P2 |
| L-7 | No repeatable quality measurement — golden-span tests, closure computation, UAT protocol all missing (07-04 UAT also still pending) | §A.10 | P2 |
| L-8 | Effective mouthClose layering (table 0.8 × preset 0.6 = 0.51) matches docs' MetaPerson advice but is non-obvious and untestified | viseme-scheduler.ts:150; calibration.ts:49; T-10 | P3 |
| L-9 | Energy-fallback: partial last window dropped; static noise floor; no user-mode degradation badge | energy-fallback.ts:18; face-controller.ts:291-299; session-panel.ts:70-73 | P3 |
| L-10 | a2f-parser minor contracts unpinned (empty frames, dup frame_time, fps default) | a2f-parser.ts:120,144 | P3 |
| L-11 | `agent_response_correction` affects captions only — audio/viseme implications undocumented | raw-wss-client.ts:152-157 | P3 (docs) |
| L-12 | testPhoneme hardcodes 8 poses duplicating table values (drift risk — 16-CONTEXT D-7) | face-controller.ts:377-445 | P3 (absorb here) |

---

## C. Target-state decisions

1. **CMU decision executed per data**: build-time pruned lexicon (~10k words, target ≤ 80 kB
   gzip in-chunk), full dictionary stays a devDependency; fallback ladder untouched. Gate on
   the measured hit-rate (≥95% on corpus → 10k; else 20k). (17-01)
2. **OOV rules hardened** to close the silent-letter/-tion classes that motivated them. (17-01)
3. **Merge correctness**: MIN_SPAN_MS overflow fixed (renormalize inside word or clamp),
   zero-length word edge pinned, golden-span corpus fixtures added. (17-02)
4. **Table/doc reconciliation**: diphthong split (AY, AW) implemented in the merge layer
   (two spans per diphthong — no scheduler change); stale §4 numbers synced to v1.3 reality;
   EH/AE smile twins explicitly re-evaluated in the UAT harness rather than blindly edited.
   Effective-value layering (L-8) documented + testified. `testPhoneme` delegation (L-12).
   (17-02)
5. **PL rule-based G2P** built as the PL phoneme path (17-04), gated behind EN plans landing;
   char table stays as ultimate fallback. Deferral recorded: language auto-detection beyond
   char-set, EN↔PL mixed turns.
6. **Quality harness** (17-05): fixture corpus + golden spans + computed closure/distinctness
   metrics + scripted live UAT protocol producing a filled 17-VERIFICATION.md. Acoustic proxy
   (EXP-03) stays deferred with an explicit revisit trigger (non-phonetic language or quality
   signal need).
7. **Fallback UX** (17-06): user-mode degradation chip + fallback polish per §A.8; docs sync
   (docs/3 pipeline diagram update, EN-visemes status column honest, correction semantics §).
8. Everything scheduler/mechanics stays in Phase 16's lane; our handoff contract is
   `VisemeQueueItem[]` and `FramesClip` — unchanged.

## D. Cross-area notes (for the orchestrator)

- **Phase 16** owns scheduler mechanics; 16-04's config extraction will move MIN_SPAN-like
  constants — sequence 17-02 (merge fix) *before* 16-04 or re-anchor at execution. 16 flagged
  `testPhoneme` duplication (D-7) to us; we absorb it in 17-02. 16's G-6 state guard for
  testPhoneme is theirs; our delegation removes the pose duplication only.
- **Phase 12** (English-ization) will shift every file:line in these plans — plan owners
  re-anchor at execution; artifacts avoid quoting Polish text except where it *is* the data
  (PL digraph keys).
- **Phase 13** (README): 17-DRAFT-lipsync-deep-dive.md is written docs/-ready; the "How
  lip-sync works" README section should link it.
- **Phase 15** (web UI): the user-mode degradation chip (L-9) is a small UI change in the
  conversation dock — 17-06 specifies it, 15 implements if it lands first.
- **Phases 9-10** (A2F): a2f-parser contract tests (T-8) harden their client edge; no schema
  change proposed. The compare A/B harness (11) gains the golden-span fixtures as a demo
  corpus — nice synergy, no dependency.
- **Phase 18** (CI): golden-span + prune-script verify (`npm run build:dict` idempotency
  check) are CI-friendly; recommend promoting after 17-01/17-05 land.

## E. Proposed requirements (LIP-xx)

- **LIP-01 Pruned EN lexicon**: the G2P lexicon ships as a build-time-pruned artifact
  (top-N conversational words, N chosen by measured ≥95% corpus hit-rate; ≤ ~150 kB gzip),
  generated by a committed script from the devDependency full CMUdict; full dictionary no
  longer ships to browsers; fallback ladder (pruned lexicon → apostrophe/hyphen → rules →
  char path) unchanged and covered by tests.
- **LIP-02 OOV rule coverage**: words with word-internal silent letters (island, listen,
  -stle/-sten/-ceipt classes) and -tion/-sion endings produce phoneme sequences without
  phantom visemes — pinned by unit tests on a committed OOV word list.
- **LIP-03 Merge timing correctness**: phoneme spans never exceed their word's time window
  (MIN_SPAN overflow fixed/renormalized); zero-duration and degenerate alignments are pinned
  by tests; a golden-span fixture corpus (control sentences + conversational paragraphs)
  asserts phoneme sequences and span sums.
- **LIP-04 Table-doc reconciliation**: phoneme-visemes.ts is the documented source of truth;
  diphthong motion (AY, AW split spans) implemented; docs/EN-visemes.md stale numbers synced;
  effective-value layering (table × preset × cap) documented and covered by a computed
  closure-presence test (M/B/P effective mouthClose ≥ 0.85 for balanced profile).
- **LIP-05 PL phoneme path**: rule-based PL G2P (digraphs + softness-i + final devoicing +
  nasals) produces PL phonemes driving the same pose tables; char path remains the PL fallback;
  PL control sentences pinned by unit tests.
- **LIP-06 Fallback honesty**: jaw-only fallback retained (no fake vowels); user mode shows a
  degradation signal when alignment is absent; malformed alignment handling is a tested pure
  function (extraction from speech-backend).
- **LIP-07 Quality harness**: repeatable quality measurement committed — fixture corpus with
  golden spans, computed proxy metrics (closure presence, per-viseme distinctness), and a
  scripted live UAT protocol whose results fill 17-VERIFICATION.md; the acoustic-alternative
  decision (G2P primary, A2F neural track, jaw-only fallback; Rhubarb/MFCC deferred with
  revisit triggers) is documented in docs/.

*Mapped to plans: LIP-01/02 → 17-01; LIP-03/04 → 17-02; LIP-07 (automated part) → 17-03;
LIP-05 → 17-04; LIP-07 (UAT part) → 17-05; LIP-06 → 17-06.*
