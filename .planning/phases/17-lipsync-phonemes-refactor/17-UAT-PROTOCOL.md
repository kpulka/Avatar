---
phase: 17-lipsync-phonemes-refactor
type: uat-protocol
created: 2026-11-24
status: written-not-executed
executed_by: none (DEFERRED-HUMAN: needs a person, a mic, an EN agent and the MetaPerson model)
---

# 17-UAT-PROTOCOL: live lip-sync verification (scripted, repeatable, recorded)

This protocol turns "judge it by eye in a demo" into a repeatable session. One run closes the Phase 17
UAT AND the long-pending Phase 07 plan 07-04 UAT (section 9 maps each item).

**Recording rule.** Every section gets PASS or FAIL plus a one-line observation, written into
`17-VERIFICATION.md` section 2. A FAIL becomes a finding row (severity, suspected module from the
evidence map below) and is never re-run to green without a code change. Items that cannot be run in the
session are marked PENDING with the reason, never PASS.

## 0. Setup

| Item | How |
|---|---|
| Dev server | `npm run dev`, open the printed URL in Chrome (WebGL on), `?studio=1` for the Studio panels |
| Model | MetaPerson avatar loaded (Scene panel shows "Model: ... speech meshes: N") |
| Agent | an ElevenLabs agent with an English voice for the live sections (5, 6); sections 1 to 4 and 7 can run offline with the demo speech and the Animation panel buttons |
| Telemetry | Studio, Session panel: ALIGN badge and FPS visible; browser console open (filter `AlignDiag`) |
| Engine | Studio, Animation panel, "Lip-sync engine": `EN phonemes` for sections 1 to 3, `PL phonemes` for section 4 |
| Profile | Articulation profile "Balanced" (the reference numbers below assume it) |
| Slow motion | record the screen at 60 fps and step frames; the Compare A/B feature (Phase 11) replays the last agent turn from LastTurnBuffer with the same PCM and alignment, so one live turn can be re-watched without the agent |
| Control sentences (EN) | `docs/en-visemes.md` section 6; the same set is the committed fixture `tests/fixtures/lipsync-corpus.json` (`control-*` cases), so the offline test and the live session use identical text |

Say or trigger each sentence at least 3 times before judging. One observer, one machine, write down the
machine (GPU, browser, display refresh rate).

## 1. EN closures (LIPS-06, 07-04 item "closures")

- **Trigger:** speak or `triggerDemoSpeech` with "Map, mop, pop, maybe, rhubarb, bumble" and the control line
  "Map, mop, pop - fine, five, very - wine, white".
- **Observe:** the lips visibly meet on every M, B and P; F and V show the lower lip under the upper teeth;
  W is pursed without closing.
- **Reference numbers (Balanced):** effective values = table value x profile scale, with the close scale capped
  at 0.85: mouthClose 0.50 x 0.60 = 0.30, mouthPress L/R 0.58 x 0.60 = 0.348, jawOpen 0.02. Open the Studio
  Inspector on `mouthClose` and `mouthPressLeft` during a bilabial to read the live value.
- **NOTE (drift correction).** The old 07-04 criterion "effective mouthClose >= 0.85" is stale. Since the Phase
  11.2 showcase fix a high mouthClose pulls the lower lip onto the nose on MetaPerson, so the bilabial pose is
  PERCEIVED closure: mouthClose <= 0.35, mouthPress >= 0.3, jawOpen <= 0.05. The automated half is
  `tests/lipsync-corpus.test.ts` ("every bilabial pose is a PERCEIVED closure"); this section judges whether it
  also LOOKS closed.
- **PASS:** closure visible on every bilabial in 3 of 3 repetitions, no lip-on-nose artifact, no jaw gap.
  **FAIL:** any bilabial that stays open, or a lip-on-nose artifact. Suspected: `phoneme-visemes.ts` (BILABIAL
  pose), `viseme-scheduler.ts` (closure damping), the model's mouthPress morph.

## 2. EN silent letters (LIPS-05, 07-04 item "silent letters")

- **Trigger:** "Do you know, though? Listen: it is an island. Wednesday, a question, the receipt, my castle."
- **Observe:** no mouth motion for the silent letters (k in know, gh in though, t in listen, s in island,
  d and e in Wednesday, p in receipt, t in castle); "question" shows K W EH S CH AH N (the "ti" is a CH).
  Slow-motion replay is required: silent letters are 40 to 80 ms.
- **PASS:** no phantom mouth shape for the listed letters in 3 of 3 repetitions.
  **FAIL:** a visible extra shape. Suspected: `g2p-en.ts` (OOV_EXCEPTIONS / suffix rules), the lexicon
  artifact, `phoneme-merge.ts` (time absorbed by neighbours).

## 3. Twin distinctness (A.6 verdict)

- **Trigger:** the control lines "see, she - sip, ship - so, show" (S vs SH), "caught, coat, coot, could, cow"
  (back rounded), "bed, bad, bayed, bid, bead" (front vowels), "her, red, are, ear" (R), "my, boy, how, go, day"
  (diphthongs). The Animation panel phoneme buttons ([ A ], [ E / I ], [ O / U ], [ M / B / P ], [ SZ / CZ ],
  [ F / V ]) show the static poses for a side-by-side look (they read the same tables as live speech).
- **Computed baseline** (from `tests/lipsync-corpus.test.ts`): 29 distinct poses, minimum pairwise L1 distance
  0.18 outside three pinned near-twins: ER vs R (0.02), AY start vs EH (0.08), AH vs K/G (0.12). Voiced and
  voiceless pairs share one pose by design (B/M/P, D/N/T, S/Z, SH/ZH, CH/JH, F/V, DH/TH, G/K).
- **Observe and RECORD A VERDICT for each pair, even when it passes:** S vs SH, O vs U, A vs E, EH vs AE (the
  smile twin: AE keeps smile 0.18 while the doc intends about 0), ER vs R, AH vs K/G, the AY glide (a visible
  open-to-closing motion on "my", "how").
- **PASS:** a naive observer can tell S from SH, O from U and A from E in slow motion, and the diphthong glide
  moves. **FAIL:** a pair is indistinguishable. A FAIL on a pinned near-twin is a FINDING for a table tweak
  guided by the harness, not a silent edit (suspected: `phoneme-visemes.ts` PHONEME_POSES).

## 4. PL digraphs (17-04, LIP-05)

- **Setup:** Animation panel, "Lip-sync engine" = `PL phonemes`. Trigger: the "Test sentence (PL)" button, then speak
  or replay: `szczypczyzna`, `dziękuję`, `chata`, `ziarno`, `zima`, `trzeba`, `chleb`, `kąt`.
  Fixture: `tests/g2p-pl.test.ts` holds the expected token sequences.
- **Observe:** sz and cz are a sharp funnel with teeth; dzi in "dziękuję" is ONE soft shape (smile with
  a little funnel), not "dz" then "i"; "chata" opens without rounding (NOT the English "church" funnel);
  "zima" has a plain z followed by i; the nasal vowels in "kąt" are open with a slight funnel.
- **A/B:** repeat the same phrase with the engine on `Character table (fallback)`; the phoneme path should be
  visibly sharper on digraphs. Record which path you preferred and why.
- **PASS:** every listed word matches its description on `PL phonemes`, and the A/B favours the phoneme path or
  is a tie. **FAIL:** any mismatch. Suspected: `g2p-pl.ts` (rule order), `phoneme-visemes.ts` (PL_PHONEME_POSES).
  This section is DEFERRED-HUMAN: it needs a Polish voice (or the PL test phrase) and an observer.

## 5. 30 s drift (LIP-03, 07-04 item "30 s timing")

- **Trigger:** a long agent turn (read-aloud paragraph, at least 30 s of speech).
- **Read:** the console `[AlignDiag]` lines. Since 17-03 each line carries `raw=<ratio>` measured BEFORE the
  rescale (the post-rescale ratio is about 1.0 by construction and proves nothing). Lines whose raw ratio is
  outside [0.5, 2.5] are flagged.
- **Observe:** lips versus audio at 5 s, 15 s and 30 s: no cumulative offset; the last word still lands on its
  audio. Also listen for the speech-onset anchoring (17-03): a chunk with leading silence must not smear the
  first word.
- **PASS:** median raw ratio within +/-10% of 1.0 over the turn, no flagged chunk, no visible cumulative offset.
  **FAIL:** a persistent raw ratio outside the band or an end-of-turn offset. Suspected: `alignment-rescale.ts`,
  `speech-backend.ts` (sample-rate / chunk start time), `audio-engine.ts` (audible clock).

## 6. Barge-in x10 (CONV-04 re-validation)

- **Trigger:** 10 interruptions at random points of long agent turns (speak over the agent, or the Interrupt
  button).
- **Observe:** the audio stops without a perceptible lag, the face reaches neutral in under 300 ms, no stray
  mouth shape after the cut, the next turn starts clean.
- **PASS:** 10 of 10. **FAIL:** any miss. Suspected: `face-controller.ts` (`onInterruption`),
  `viseme-scheduler.ts` (queue clear), `audio-engine.ts` (hardStop, epoch).

## 7. Fallback honesty (LIP-06)

- **Trigger:** force the acoustic fallback: in Studio, replay a turn through an alignment-stripped chunk (the
  Phase 11 replay path with `alignment` removed), or drop the `alignment` field in the console on one
  `audio:chunk`.
- **Observe:** jaw-only motion proportional to loudness, no fake vowels (no smile, no pucker), the Studio ALIGN
  badge reads `ALIGN: FALLBACK`, and in USER mode a subtle degradation chip is visible (chip lands in 17-06);
  the chip clears when alignment returns.
- **PASS:** all four. **FAIL:** a vowel shape during fallback, or a missing or stuck chip. Suspected:
  `energy-fallback.ts`, `face-controller.ts` (fallback branch), `conversation-dock.ts` (chip).

## 8. FPS (AVAT-02 spot check)

- **Trigger:** any long speech turn with the Studio Session panel open.
- **PASS:** at or above 60 FPS during speech on the reference machine, no hitch at chunk boundaries (the
  phoneme and Polish paths allocate nothing in the per-tick loop; `tests/hot-path-allocations.test.ts` guards
  this offline). **FAIL:** a sustained drop; record the machine and the profile.

## 9. Absorbing 07-04 (Phase 07 UAT checklist)

`07-VERIFICATION.md` was never written (07-04 stopped at status `pending-uat`, its nine checklist items are in
`07-04-SUMMARY.md`). The nine items map to this protocol as follows; closing a section here closes the item:

| 07-04 item | Closed by |
|---|---|
| ALIGN badge reads EL through the whole session | section 5 (live turn) and section 7 setup |
| silent letters ("Do you know, though?") | section 2 |
| M/B/P closures | section 1 (with the corrected perceived-closure criterion) |
| phoneme character ("vision, question, team, about") | section 3 |
| 30 s timing without drift | section 5 |
| 10x barge-in | section 6 |
| 60 FPS | section 8 |
| A/B char versus phoneme | sections 3 and 4 (engine select) |
| jaw-only fallback control | section 7 |

## 10. Evidence map (finding triage)

| Symptom | First suspect |
|---|---|
| wrong or missing phoneme | `g2p-en.ts` (lexicon / OOV rules) or `g2p-pl.ts` |
| right phoneme, wrong timing inside a word | `phoneme-merge.ts` (`distributeDurations`, weights, soft minimum) |
| whole-chunk offset, lips early or late | `alignment-rescale.ts`, `speech-backend.ts` (chunk start, sample rate) |
| pose looks wrong but sequence is right | `phoneme-visemes.ts` (PHONEME_POSES / PL_PHONEME_POSES), profile scales in `viseme-scheduler.ts` |
| lip-on-nose or open mouth on bilabials | BILABIAL pose, closure damping (`anim-config.ts` closeJawThreshold / pressRef) |
| fallback shows vowels | `face-controller.ts` fallback branch, `energy-fallback.ts` |
