---
phase: 12-english-language
type: glossary
status: normative
created: 2026-11-18
updated: 2026-11-22
---

# 12-DRAFT-GLOSSARY — Normative EN↔PL domain terminology

> NORMATIVE for every translation in Phase 12 (docs, UI, comments, tests) and for EN
> artifacts of phases 13–18. Reviewer greps translated output against the EN column.
> Terms verified to occur in the repo (docs/, src/, .planning/) as of 2026-11-18; re-verified
> 2026-11-22 (12-01 Task 1): every row has at least one attested form in the repo, and
> articulation terms from docs/3 and docs/EN-visemes.md missing in the first draft were added.

## Product & architecture

| PL | EN (canonical) |
|---|---|
| awatar | avatar |
| porozmawiać / rozmowa głosowa | voice conversation |
| mózg konwersacji | conversation brain |
| pętla konwersacji | conversation loop |
| wypowiedź | utterance (audio); use *turn* for a full agent turn |
| tura (rozmowy) | turn |
| przerwanie wypowiedzi (produkt) | barge-in |
| przerwanie (event `interruption`) | interruption (the event); barge-in (the product behavior) |
| zamrożona mina | frozen face |
| twarz neutralna | neutral face |
| oś czasu | timeline / time axis |
| epoka | epoch |
| surowy WSS | raw WSS |
| klucz API poza przeglądarką | API key never client-side |
| agent as code | agent as code (keep EN) |
| skrócony/signed URL | signed URL |
| renderer | renderer |
| warstwa abstrakcji | abstraction layer |
| adapterska zasada elastyczności | flexibility principle (renderer behind an adapter) |
| macierz decyzji | decision matrix |
| kamień milowy | milestone |
| faza | phase |
| kryteria akceptacji | acceptance criteria |
| przebiegka (akceptacyjna) | acceptance run / walkthrough |
| telemetria | telemetry |

## Lip-sync & phonetics

| PL | EN |
|---|---|
| wizema | viseme |
| głoska (w UI: klawisz wizemy) | viseme key (UI); phone/phoneme (linguistics) |
| fonem | phoneme |
| G2P / silnik fonemowy | G2P (grapheme-to-phoneme) / phoneme engine |
| ścieżka znaków | character path (legacy char→viseme table) |
| ścieżka fonemowa | phoneme path |
| koartykulacja | coarticulation |
| dwuznaki | digraphs (sz, cz, rz, ch, dź, dż) |
| nosówki | nasal vowels (ą, ę) |
| litery nieme | silent letters |
| leksykon / słownik CMU | CMU dict / CMUdict lexicon |
| reguły OOV | OOV (out-of-vocabulary) rules |
| timing słów | word timings |
| alignment znaków | char alignment |
| zdania kontrolne | control sentences |
| domknięcie warg | lip closure |
| domknięcia M/B/P | M/B/P closures |
| żuchwa | jaw |
| otwarcie żuchwy | jaw open / jaw drop |
| ściśnięcie warg | lip press |
| usta okrągłe / tunikowe | rounded lips / rounding |
| zęby / język / pucker (smaczki wizem) | teeth / tongue / pucker (viseme nuances) |
| samogłoska / spółgłoska | vowel / consonant |
| zaokrąglenie / zaokrąglony | rounding / rounded (lips) |
| uśmiech | smile |
| kąciki (ust) | mouth corners |
| otwór (ust) | mouth opening (aperture) |
| dzióbek | pucker ("beak": small protruded lip opening) |
| wysunięcie (warg) | lip protrusion |
| tuba (warg) / tubę | lip tube (funnel shape) |
| zębodołowe | alveolar |
| tylnojęzykowe | velar / dorsal (back of tongue) |
| półotwarte | half-open (mid vowel) |
| zamknięta / wąsko | closed / narrow |
| wygładzanie | smoothing |
| tłumienie / damping λ | damping (λ) |
| grupy mięśni | muscle groups (closure, jaw, round, smile) |
| wygaszanie do zera | decay to zero |
| reguła fundamentu | foundation rule (uncontributed keys → 0) |
| wyprzedzenie/odstęp audio (AV sync) | AV sync offset / audio lead |
| fallback akustyczny | acoustic fallback |
| energia RMS | RMS energy |
| wizemy LIVE | LIVE visemes |
| ramki (A2F) | frames |
| blendshape'y | blendshapes |
| rig / zrigowany | rig / rigged |
| mesze mowy (sub-mesh sync) | speech meshes (sub-mesh sync) |
| mapowanie znak→wizema | char→viseme mapping |

## Realism & animation runtime

| PL | EN |
|---|---|
| ożywienie | aliveness (procedural idle motion) |
| mruganie (proceduralne) | (procedural) blinking |
| sakkady | saccades |
| mikroruchy głowy | head micro-movements |
| idle sway / oddech | idle sway / breathing |
| emocje bazowe | base emotions |
| warstwa emocji | emotion layer |
| mimika | facial expression / mimic |
| przenikanie skóry / SSS | subsurface scattering (SSS) |
| oświetlenie 3-point | three-point lighting |
| tone mapping ACES | ACES tone mapping |
- State machine terms stay EN as-is: IDLE / SPEAKING / RELAXING.

## UI (dual-persona app)

| PL | EN |
|---|---|
| warstwa user / studio | user layer / studio layer |
| dock rozmowy | conversation dock |
| napisy | captions |
| wskaźnik stanu | status pill |
| segment (źródła algorytmu) | animation-source segment |
| porównywarka | A/B compare |
| tryb blind | blind mode |
| przełącznik A/B | A/B switcher |
| presety sceny | scene presets |
| motyw jasny / ciemny | light / dark theme |
| profil tweakera | tweaker profile |
| blokady ustawień | settings locks |
| zablokowane przez studio | locked by studio |
| eksport/import profilu | profile export / import |
| inspektor | inspector (panel) |
| panel | panel |
| test obciążeniowy PoC | PoC stress test |
| awatar demo | demo avatar |
| ładowanie modelu | loading the model |
- Technical tokens never translated: `morphTargetInfluences`, `mouthClose`, `jawOpen`,
  event names (`audio`, `interruption`, `agent_response_correction`), settings keys.

## Process (GSD)

| PL | EN |
|---|---|
| plan / podsumowanie / weryfikacja | plan / summary / verification |
| wymagania | requirements |
| ryzyka | risks |
| decyzja | decision |
| retrospekcja | retrospective |
| dryf (implementacyjny) | drift |
| blokada / blocker | blocker |
| odroczone | deferred |
