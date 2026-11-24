# EN visemes — English visemes (working document)

> **Status:** working draft • **Goal:** make every viseme have a **recognizable, distinct** mouth pose. Before Phase 17 some visemes were "twin-like" (section 5); the Phase 17 status notes below record what changed. Whether the result reads well is a live-UAT question, not something this document can settle.
> **How to use:** articulation description → proposed parameters of our blendshapes → test in the **Viseme Editor** (✏️) on the model → come back and add "what worked" in the **test** column.
> **Related:** code `src/lipsync/g2p/phoneme-visemes.ts` (EN table), `src/lipsync/g2p/phoneme-merge.ts`, Editor: `src/lipsync/viseme-overrides.ts`.

---

## 0. Legend — what we have

### 0.1 Our parameters (ARKit blendshapes) and what they do

| Parameter | Articulatory meaning |
|---|---|
| `jawOpen` | jaw opening (the main "volume/mouth" lever) |
| `mouthClose` | lips closed / in contact (for P/B/M) |
| `mouthPressLeft/Right` | lips pressed (emphasizes the P/B/M closure) |
| `mouthPucker` | lips pushed forward / rounded "into a beak" (rounding of back vowels) |
| `mouthFunnel` | lips in a "tube", small opening (SH/CH, deep rounding of U) |
| `mouthRollLower` | lower lip **rolled in** (contact with the upper teeth — F/V) |
| `mouthShrugLower` | lower lip raised upward (without rolling in) |
| `mouthUpperUpLeft/Right` | upper lip raised → **exposes the upper teeth** |
| `mouthLowerDownLeft/Right` | lower lip down → **exposes the lower teeth** |
| `mouthSmileLeft/Right` | mouth corners stretched sideways ("smile speech": IY/EY/S) |
| `tongueOut` | tongue out (TH — if the model has it) |

All values 0..1. In the rest of this document I write L/R as one (e.g., `upperUp 0.4` = both sides).

### 0.2 What CANNOT be shown on this rig (important!)
- **shape/parts of the tongue** (rounding, the S groove, the R retroflex) — the tongue only has `tongueOut`,
- precise teeth contact,
- that is why we **must encode the differences on the lips and the jaw**, and some phonemes (e.g., T vs N) will deliberately be **the same viseme** — this is natural and correct (visemes are classes that are equivalent *visually*, not phonemes).

### 0.3 Phoneme names
We use **ARPAbet** (2-letter symbols, as in CMUdict / our G2P) — see the sources at the end. The grouping of "visemes" (one mouth pose) is **broader** than the phoneme — many phonemes share one pose.

---

## 1. Index of EN visemes (one row = one mouth POSE)

| Viseme | ARPAbet | IPA | Examples | Visual key (one sentence) |
|---|---|---|---|---|
| V-AA | AA | ɑ | h**o**t, f**a**ther | wide open, neutral lips |
| V-AE | AE | æ | c**a**t, b**a**d | wide, corners slightly sideways |
| V-AH | AH | ʌ | c**u**p, l**u**ck | medium open, neutral |
| V-AO | AO | ɔ | th**ou**ght, st**o**ry | open + rounded (oval) |
| V-ER | ER | ɝ | h**er**, b**ir**d | half-open, slight rounding (r-colored) |
| V-EY | EY | eɪ | s**ay**, d**ay** | half-open + smile, teeth slightly |
| V-EH | EH | ɛ | b**e**d, s**e**t | half-open, corners slightly sideways |
| V-IH | IH | ɪ | s**i**t, b**i**t | narrow, lips neutral/flattened |
| V-IY | IY | i | s**ee**, t**ea**m | narrow + wide smile, teeth |
| V-UH | UH | ʊ | g**oo**d, b**oo**k | almost closed + slight rounding |
| V-UW | UW | u | t**oo**, bl**ue** | pucker (small opening, protrusion) |
| V-OW | OW | oʊ | g**o**, n**o** | medium open, clear rounding |
| V-AY | AY | aɪ | m**y**, t**i**me | wide→smile (movement) |
| V-AW | AW | aʊ | h**ow**, n**ow** | wide→rounding (movement) |
| V-OY | OY | ɔɪ | b**oy**, t**oy** | rounding→smile (movement) |
| C-MBP | P B M | p b m | m**ap**, b**oy**, p**en** | full lip closure |
| C-FV | F V | f v | f**ine**, v**an** | lower lip under the upper teeth |
| C-THDH | TH DH | θ ð | th**ink**, th**is** | tongue between the teeth, lips parted |
| C-TDN | T D N | t d n | t**ime**, d**og**, n**o** | neutral lips, slightly parted |
| C-SZ | S Z | s z | s**ee**, z**oo** | narrow + smile, teeth close |
| C-SH | SH ZH | ʃ ʒ | sh**ip**, mea**s**ure | lips into a "tube" (rounded), teeth close |
| C-CH | CH JH | tʃ dʒ | ch**at**, j**ump** | like SH with a firmer initial closure |
| C-KG | K G | k ɡ | c**at**, g**o** | neutrally open (back of the tongue) |
| C-NG | NG | ŋ | si**ng**, lo**ng** | slightly open, neutral |
| C-L | L | l | l**ike**, b**ottle** | parted, tip of the tongue up |
| C-R | R | ɹ | r**ed**, t**ree** | slight rounding/drawing in of the lips |
| C-Y | Y | j | y**es**, y**ou** | like IY, short |
| C-W | W | w | w**e**, w**ould** | strong rounding (like U), short |
| C-HH | HH | h | h**i**, h**ow** | neutral, lips set for the following vowel |

Diphthongs (EY/AY/AW/OY/OW) in real speech are a **movement** (start→end). Our engine holds a single pose — see §5 on modeling movement.

---

## 2. Vowels — articulation description + parameters

> Source of the description: articulatory phonetics (place, openness, **lip rounding**) following the IPA/English standard; rounding applies only to back vowels: AO/OW/UH/UW (and, in some accents, AO). Front vowels (IY IH EY EH AE) are **unrounded** (parted/wide corners).
> The **test** column = filled in after checking on the model.

### IY /i/ — "see, team"
- **Description:** front, high, unrounded vowel. Lips **stretched into a smile**, jaw almost closed, teeth slightly visible ("cheesy smile"). The brightest "smile" of all visemes.
- **Parameters (base):** `jawOpen .25 · smile .25` → *proposal:* add `upperUp .15` (a bit of the upper teeth), smile ~.35 (the strongest speech smile).
- **Test:**

### IH /ɪ/ — "sit, bit"
- **Description:** like IY, but **lower and looser**: corners barely parted, jaw slightly more open, **without** a strong smile. Neutral-flattened lips.
- **Parameters (base):** `jawOpen .25 · smile .20` → *proposal:* lower the smile to ~.12 and jawOpen to ~.22 (distinguish from IY by **smile strength**, not just 0.05).
- **Test:**

### EY /eɪ/ — "say, day" (diphthong, we hold the start pose + glide)
- **Description:** starts from [e] — medium open, corners in a medium smile, **upper teeth visible**; moves toward [ɪ]. Visually: "half-smile with teeth".
- **Parameters (base):** `jawOpen .35 · smile .25` → *proposal:* smile .30 + `upperUp .20` (teeth!), jaw .32.
- **Test:**

### EH /ɛ/ — "bed, set"
- **Description:** front, mid-open, unrounded. Jaw moderately lowered, corners in a **weak** smile / neutral. Fewer "teeth" than EY.
- **Parameters (base):** `jawOpen .35 · smile .30` → *proposal:* this is almost a twin of EY — differentiate: EH **more jaw, less smile, no teeth** (jaw .38, smile .15); EY less jaw + smile + teeth.
- **Test:**

### AE /æ/ — "cat, bad"
- **Description:** front, low, wide open. Jaw **strongly down**, lips widely parted (in GA often slightly tensed). The largest front opening.
- **Parameters (base):** `jawOpen .45 · smile .20` → *proposal:* jaw .50, smile .10 (width comes from the jaw, not from the smile).
- **Test:**

### AA /ɑ/ — "hot, father"
- **Description:** back, open, **unrounded** (mouth open like at the doctor's "ah", lips neutral, not drawn in). The largest total opening.
- **Parameters (base):** `jawOpen .55 · smile .10` → stays (jaw ~.55, lips neutral).
- **Test:**

### AH /ʌ/ — "cup, luck"
- **Description:** central, mid-open, neutral lips, jaw medium; a "calm a".
- **Parameters (base):** `jawOpen .40` → stays; check the distinction from AA (AA = more jaw), from EH (AH neutral corners, EH parted).
- **Test:**

### AO /ɔ/ — "thought, story"
- **Description:** back, mid-open, **rounded** (lips in an oval, not strongly pushed forward). Key: an open oval with visible rounding.
- **Parameters (base):** `jawOpen .40 · pucker .50 · funnel .45` → *proposal:* reduce jaw to .35 (funnel makes a "tube" — AO is an oval, not a tube: pucker .40/funnel .25? to be tested). *Note: AO vs OW vs AW — see §5.*
- **Test:**

### OW /oʊ/ — "go, no"
- **Description:** starts with a rounded, mid-[o] and closes toward [ʊ]. Visually the start = **clearly rounded**, a smaller opening than AO.
- **Parameters (base):** `jawOpen .35 · pucker .55 · funnel .45` → stays as "compact rounding".
- **Test:**

### AW /aʊ/ — "how, now"
- **Description:** starts with a wide-open [a], ends with a rounded [ʊ]. Visually the **most contrasting movement**: wide → pucker.
- **Parameters (base):** `jawOpen .50 · pucker .45` → *proposal:* for a static pose pick the middle: jaw .35 + pucker .5 (like OW?) — better to differentiate from OW with a larger starting jaw; to be tested.
- **Test:**

### UH /ʊ/ — "good, book"
- **Description:** back, high, **weakly rounded**: lips slightly pushed forward, small opening, jaw almost closed.
- **Parameters (base):** `jawOpen .20 · pucker .55 · funnel .35` → *proposal:* pucker .45/funnel .20 (lighter than UW).
- **Test:**

### UW /uː/ — "too, blue"
- **Description:** back, high, **strongly rounded**: lips pushed forward into a clear small opening (a beak). The strongest pucker/funnel.
- **Parameters (base):** `jawOpen .20 · pucker .65 · funnel .40` → stays as the maximum "beak".
- **Test:**

### ER /ɝ/ — "her, bird" (r-colored)
- **Description:** central with a retroflex; on the mouth: jaw medium open, lips **slightly rounded** (r-coloring), tongue not visible.
- **Parameters (base):** `jawOpen .30 · funnel .20` → *proposal:* add a gentle pucker .25 (to distinguish from EH — see §5).
- **Test:**

### AY /aɪ/ — "my, time"
- **Description:** [a]→[ɪ]: the wide opening turns into a smile. Statically it represents "start wide, end narrow" — the middle: open with corners.
- **Parameters (base):** `jawOpen .45 · smile .20` (identical to AE — to be distinguished, see §5).
- **Test:**

### OY /ɔɪ/ — "boy, toy"
- **Description:** [ɔ]→[ɪ]: rounding → smile.
- **Parameters (base):** `jawOpen .40 · pucker .40` → *proposal:* add smile .15 (the target direction toward [ɪ]).
- **Test:**

---

## 3. Consonants — description + parameters

### P / B / M (C-MBP) — "map, boy, pen"
- **Description:** **lip closure** (bilabial). P/B = lips closed with slight pressure (P voiceless + aspiration, B voiced). M = lips closed, sound through the nose — **visually the same**: mouth closed in a natural line, teeth apart, no "sucking". This is the most important test of lip-sync readability.
- **Parameters (base):** `mouthClose 1.0 · press .15` (historical). **In code since Phase 11.2 SHOW-06 (v1.3):** `jawOpen .02 · mouthClose .50 · mouthPress L/R .58 · mouthRollLower .25 · mouthRollUpper .15` — closure is *perceived* (press + roll), `mouthClose` stays low because a high value pulls the lip onto the nose. Effective values are table x profile scale: balanced (closeScale .60, capped at .85) gives close `.50 x .60 = .30`, press `.58 x .60 = .348`, jaw `.02`. Do NOT add jawOpen.
- **Test:** *(check: full lip contact, the lower lip does NOT ride up under the nose)*

### F / V (C-FV) — "fine, van"
- **Description:** **labiodental**: the lower lip rolled in slightly touches the edge of the upper incisors; jaw close; corners neutral. V voiced (vibration).
- **Parameters (base):** `jawOpen .12 · rollLower .65 · upperUp .50 · shrugLower .18`
- **Test:**

### TH / DH (C-THDH) — "think, this"
- **Description:** **interdental**: the tip of the tongue between (behind) the upper teeth; mouth parted enough for the tongue to be visible; lips do not take part.
- **Parameters (base):** `jawOpen .20 · tongueOut .30` (if the model has tongueOut; otherwise just the jaw)
- **Test:**

### T / D / N (C-TDN) — "time, dog, no"
- **Description:** **alveolar**: the tip of the tongue to the alveolar ridge; on the outside the mouth is **neutral, slightly parted**; T/D = closure + release, N nasal — visually the same pose (that is OK).
- **Parameters (base):** `jawOpen .20`
- **Test:**

### S / Z (C-SZ) — "see, zoo"
- **Description:** **alveolar fricative**: the tongue in a groove behind the teeth, **teeth almost touching**, lips parted in a **narrow smile** (visible teeth), air hissing.
- **Parameters (base):** `jawOpen .15 · smile .15` → *proposal:* add `upperUp .15`/`lowerDown .15` (teeth!) — otherwise S merges with T/D/N/EH.
- **Test:**

### SH / ZH (C-SH) — "ship, measure"
- **Description:** **postalveolar fricative, labialized**: the tongue flat behind the ridge, and the lips **pushed forward and rounded into a tube** [ʃʷ], teeth close (visible through the opening). This is what distinguishes SH from S.
- **Parameters (base):** `jawOpen .20 · funnel .50` → *proposal:* add `pucker .25` + `upperUp/lowerDown ~.2` (teeth in the tube) for a stronger "sh" on MetaPerson.
- **Test:**

### CH / JH (C-CH) — "chat, jump"
- **Description:** **affricates**: first a closure like T (tongue to the ridge), then a fricative like SH (lips in a tube). Visually = SH with a clearer initial closure.
- **Parameters (base):** `jawOpen .25 · funnel .45` → see SH (similar — differentiate: CH slightly more jaw and less funnel at the start).
- **Test:**

### K / G (C-KG) — "cat, go"
- **Description:** **velar**: the back of the tongue to the soft palate; mouth neutral, **fairly widely open** (because the lips do no work); from the outside an "empty opening".
- **Parameters (base):** `jawOpen .35` → *proposal:* no smile, jaw .35 (distinguish from AH: AH .40 without context; K/G short and "hard").
- **Test:**

### NG /ŋ/ (C-NG) — "sing, long"
- **Description:** like K/G but nasal, mouth **slightly** open, neutral.
- **Parameters (base):** `jawOpen .25`
- **Test:**

### L (C-L) — "like"
- **Description:** **lateral**: the tip of the tongue to the ridge, air flowing around the sides; mouth parted, corners neutral (dark L at the end of a syllable is even "deeper").
- **Parameters (base):** `jawOpen .30 · tongueOut .30` (tongueOut only symbolically — L does not stick the tongue out! *remove or ignore*)
- **Test:** *(consider: tongueOut for L is wrong — L = tongue UP; keep just the jaw or add a gentle lowering)*

### R /ɹ/ (C-R) — "red, tree"
- **Description:** **postalveolar approximant, labialized**: the tongue pulled back/bunched, lips **slightly rounded and pushed forward** (especially before a vowel) — this is what is most visible on the mouth.
- **Parameters (base):** `jawOpen .30 · funnel .20` → *proposal:* add pucker .20-25 (r-coloring); distinguish from ER (ER = a longer vowel, R = short onset consonant).
- **Test:**

### Y /j/ (C-Y) — "yes, you"
- **Description:** **palatal approximant**: like a very short [i] — lips parted, jaw almost closed; it immediately moves into the next vowel.
- **Parameters (base):** `jawOpen .25 · smile .20` → *proposal:* smile .25 (like IY), short.
- **Test:**

### W /w/ (C-W) — "we, would"
- **Description:** **labio-velar**: **strong rounding and pushing forward of the lips** (like [u]), then a transition into the vowel. The most "labial" consonant.
- **Parameters (base):** `pucker .40 · jawOpen .15` → *proposal:* pucker .55 + funnel .2 (a brighter "beak", shorter than UW only in duration).
- **Test:**

### HH /h/ (C-HH) — "hi, how"
- **Description:** **glottal**: no lip work — the mouth sets itself for the **following vowel**; the h itself is only airflow.
- **Parameters (base):** `jawOpen .25` → *proposal:* basically no pose of its own (neutral), keep the amplitude low.
- **Test:**

---

## 4. Summary parameter table (working sheet)

> **Status (Phase 17):** columns **B** and **P** are historical working values. The source of truth is `PHONEME_POSES` in `src/lipsync/g2p/phoneme-visemes.ts` (v1.3), which is also what the Calibrator preview and the tests read. The MBP row below shows the v1.3 code values.

Legend: **B** = current value (code v1); **P** = proposal to test; blank = not used (0).
L/R entered once (symmetry). `jaw`=`jawOpen`, `close`=`mouthClose`, `press`=`mouthPress`, `puck`=`mouthPucker`,
`fun`=`mouthFunnel`, `roll`=`mouthRollLower`, `shrug`=`mouthShrugLower`, `uUp`=`mouthUpperUp`,
`lDn`=`mouthLowerDown`, `sm`=`mouthSmile`, `tong`=`tongueOut`.

| Viseme | jaw | close | press | puck | fun | roll | shrug | uUp | lDn | sm | tong |
|---|---|---|---|---|---|---|---|---|---|---|---|
| IY | B .25 / P .25 | | | | | | | P .15 | | B .25 / P .35 | |
| IH | B .25 / P .22 | | | | | | | | | B .20 / P .12 | |
| EY | B .35 / P .32 | | | | | | | P .20 | | B .25 / P .30 | |
| EH | B .35 / P .38 | | | | | | | | | B .30 / P .15 | |
| AE | B .45 / P .50 | | | | | | | | | B .20 / P .10 | |
| AA | B .55 | | | | | | | | | .10 | |
| AH | .40 | | | | | | | | | | |
| AO | .40 / P .35 | | | | B .50/P.40 | | | | | | |
| OW | .35 | | | .55 | .45 | | | | | | |
| AW | .50 / P .40 | | | .45 / P .50 | | | | | | | |
| UH | .20 | | | .55/P.45 | .35/P.20 | | | | | | |
| UW | .20 | | | .65 | .40 | | | | | | |
| ER | .30 | | | P .25 | .20 | | | | | | |
| AY | .45 | | | | | | | | | .20 | |
| OY | .40 | | | .40 | | | | | | P .15 | |
| MBP | .02 | .50 | .58 | | | .25 (+ rollUpper .15) | | | | | |
| FV | .12 | | | | | .65 | .18 | .50 | | | |
| THDH | .20 | | | | | | | | | | .30 |
| TDN | .20 | | | | | | | | | | |
| SZ | .15 | | | | | | | P .15 | P .15 | .15 | |
| SH | .20 | | | P .25 | .50 | | | P .2 | P .2 | | |
| CH | .25 | | | | .45 | | | | | | |
| KG | .35 | | | | | | | | | | |
| NG | .25 | | | | | | | | | | |
| L | .30 | | | | | | | | | | (.30 → P 0) |
| R | .30 | | | P .20 | .20 | | | | | | |
| Y | .25 | | | | | | | | | .20/P.25 | |
| W | .15 | | | .40/P.55 | P .2 | | | | | | |
| HH | .25 | | | | | | | | | | |

---

## 5. Analysis of "twin" pairs and the nuances that tell them apart

The most important part for us. For each pair: **why they look the same today**, **what the real articulatory difference is**, **how to show it on our blendshapes**.

### 5.1 Pairs IDENTICAL in code (base) — need to be told apart

| Pair | Today (both) | Real difference | How to tell them apart on the rig |
|---|---|---|---|
| **EY ↔ AE** (and AY!) | jaw .35/.45… AE vs EY: AE jaw .45 sm .2; EY jaw .35 sm .25 — close; **AY = identical to AE** | /æ/ low, no smile; /eɪ/ "half-smile + teeth"; /aɪ/ start wide→smile | AE: large jaw, smile ~0 (width from the jaw). EY: smaller jaw, smile .3 + **upperUp (teeth)**. AY: middle — jaw .4 + smile .25 |
| **IH ↔ Y** (and close to IY) | jaw .25 sm .2 = Y | /ɪ/ loose vowel; /j/ short "i" transition | Y short + smile .25; IH longer, smaller smile (~.12), loose |
| **ER ↔ R** | jaw .3 fun .2 | /ɝ/ r-colored vowel (long); /ɹ/ onset consonant | add pucker .2 to R (syllable onset); ER without pucker, longer |
| **HH ↔ NG** (and TDN .2) | jaw .25 | /h/ no pose (neutral); /ŋ/ back nasal | HH = neutral, very low amplitude; NG = jaw with a slight "empty opening" like K/G but smaller (.25 ok, HH .18) |
| **SH ↔ CH** | fun .50 vs .45 (almost) | /ʃ/ fricative; /tʃ/ closure→fricative | CH: more jaw .28 + less fun .35 (closed start); SH: less jaw, more fun |
| **UH ↔ UW** | different but close | /ʊ/ weak rounding; /uː/ strong protrusion | UH: puck .45 fun .2; UW: puck .65 fun .4 (max) |

### 5.2 "Ladders" that are easy to confuse (values per 0.05)
Front unrounded `IY .25/.25 → IH .25/.20 → EY .35/.25 → EH .35/.30 → AE .45/.20` — differences on the order of 0.05 are **invisible**. Proposal: spread them **two-dimensionally** (jaw AND smile/teeth), not only by the value itself:

- **IY**: strongest smile + teeth (`sm .35, uUp .15, jaw .25`)
- **IH**: loose, almost no smile (`sm .10, jaw .25`)
- **EY**: medium smile + teeth (`sm .30, uUp .20, jaw .32`)
- **EH**: larger jaw, no teeth (`jaw .38, sm .15`)
- **AE**: max jaw, smile ~0 (`jaw .50`)
- **AA**: max neutral jaw (differs from AE in tongue direction — invisible; keep it similar, differentiate by timing/context)
- **AH**: medium jaw, neutral (differs from EH: EH slightly parts the corners — add AH `sm 0`, EH `sm .15`)

### 5.3 Rounded back: AO vs OW vs AW vs UH vs UW
They are all "rounded" — easy to merge. The key = **degree of protrusion and openness**:
- **AO** /ɔ/: open oval — `jaw .35, puck .40, fun .25` (open, not a tube)
- **OW** /oʊ/: compact rounding — `jaw .30, puck .55, fun .45`
- **UW** /uː/: max beak — `jaw .20, puck .65, fun .40`
- **UH** /ʊ/: light beak — `jaw .25, puck .40, fun .20` (lighter than UW)
- **AW** /aʊ/: start WIDE (`jaw .45`) → rounded end — statically: `jaw .35, puck .5` (closer to OW; the difference comes from context: AW after a wide A)

### 5.4 Consonant traps
- **S vs SH**: S = smile + teeth, SH = tube. If SH has no pucker it will look like S. **Add SH pucker .25**.
- **F/V vs TH/DH**: F = lower lip UNDER the teeth (`rollLower` + `upperUp`); TH = tongue BETWEEN the teeth (tongueOut). Without tongueOut, TH looks like nothing — give TH a larger jaw + possibly `mouthShrugLower` / parting.
- **P/B/M vs F/V**: P = lips closed (close); F = lip under the teeth (roll) — already distinguishable, just make sure M does not accidentally get jawOpen.
- **K/G vs NG vs T/D/N**: from the outside all are a "neutral opening" — differentiate by jaw AMPLITUDE (K/G .35, T/D/N .20, NG .25, HH .18) — see 5.1.

### 5.5 Diphthongs and "movement"
EY/AY/AW/OY/OW in reality **shift** the mouth. Holding a single pose = "a frozen middle". Options (to be decided):
1. keep static (simplest; the context helps anyway),
2. **split the diphthong into 2 visemes in the queue** (start→end, half and half of the time) — this requires a change in `phoneme-merge` / the map (e.g., AY → first an AA-ish, then an IH-ish),
3. compromise: middle + a slight tilt (smile for AY/OY, pucker for AW/OW).
> Recommendation to start: **option 2 for AY and AW** (the most contrasting), the rest static. Add the decision after the test.

**Status (Phase 17-02): option 2 is implemented for AY and AW.** The merge emits the diphthong's own pose over 60% of its time, then a glide end pose over the remaining 40% (AY -> IH, AW -> UH; `DIPHTHONG_END_POSES` in `phoneme-visemes.ts`, the second span carries `glideOf`). EY, OW and OY stay single static poses. Whether the glide is visible enough is judged in the live UAT (`17-UAT-PROTOCOL.md` section 3), so it is *tuned-by-harness*, not final. The remaining `5.1` twin pairs are checked by a computed proxy (`tests/lipsync-corpus.test.ts`): three near-twins stay pinned (ER/R, AY start vs EH, AH vs K/G) and every other pair of distinct poses is at least 0.15 apart (L1 over the pose vectors).

---

## 6. Control sentences for evaluation (minimal pairs)
- **Lips:** "Map, mop, pop — fine, five, very — wine, white" *(P/B/M, F/V, W)*
- **S vs SH:** "see, she — sip, ship — so, show"
- **Front vowels:** "bed, bad, bayed, bid, bead" *(EH AE EY IH IY)*
- **Back rounded:** "caught, coat, coot, could, cow" *(AO OW UW UH AW)*
- **R:** "her, red, are, ear"
- **TH:** "think, this, three, they"
- **Diphthongs:** "my, boy, how, go, day"

---

## 7. Sources (research 2026-09)
- Wikipedia: **ARPABET** — full ARPAbet ↔ IPA ↔ examples table (used by CMUdict). https://en.wikipedia.org/wiki/ARPABET
- Wikipedia: **English phonology** — 24 consonants (place/manner), GA/RP vowels, labialization of /ʃ ʒ tʃ dʒ/, realizations of /r/ and /l/, r-coloring. https://en.wikipedia.org/wiki/English_phonology
- Articulatory phonetics (standard): vowel features (openness / front–back / **lip rounding**) and consonant features (place + manner) — the basis of the descriptions in §2–§3.
- Our dictionary: CMUdict (`cmu-pronouncing-dictionary`) — it is what provides the ARPAbet for G2P.

---

## 8. Change log / decisions
| Date | Decision |
|---|---|
| 2026-09 | Document created; twin pairs identified: EY/AE/AY, IH/Y, ER/R, HH/NG, SH/CH, UH/UW; proposed distinctions in §5. |
| 2026-09 | **v1.2 deployed** to `src/lipsync/g2p/phoneme-visemes.ts` as a 50/50 average (current ↔ §5 proposals). New values = averages: MBP close .78, front vowels spread apart (jaw+smile+`upperUp`), SH/SZ with teeth exposed, back rounded vowels separated (AO oval → UW beak), HH low amplitude .22, L without `tongueOut`. Column **B** in §4 is outdated as "code" — see the code/table above. |
| 2026-09 | **v1.3** — more "power" (larger jaw/smile/rounding) + the "extra touch": open vowels got `lowerDown` (lower teeth), IY/EY stronger `upperUp`, UW/W got `shrugLower` (protrusion), SZ/SH strong teeth exposure, K/G/NG/T/D/N/L gentle teeth presence (so that "neutral" visemes are not empty). |
| 2026-11 | **Phase 17-02:** poses extracted into one table (`PHONEME_POSES`) read by live speech, the Calibrator preview (`testPhoneme`) and the tests; word-window invariant with a 35 ms soft minimum; diphthong glide for AY and AW (section 5.5); closure criterion changed from "effective mouthClose >= 0.85" to *perceived closure* (close <= .35, press >= .3, jaw <= .05 under balanced). |
| 2026-11 | **Phase 17-04:** Polish gets its own viseme classes (`PL_PHONEME_POSES`: velar fricative, soft sibilants, nasal vowels) next to this table; the English table is unchanged. |
