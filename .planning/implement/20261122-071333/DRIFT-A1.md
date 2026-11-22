# Drift A1 — after merge 34a22e1 (11.2-07 audible clock, 11.2-08 bilabial closure)

Checker: haiku, read-only. Verdict: DRIFT (10 SEMANTIC, 9 LINE-SHIFT). Executors of 14/16/17 MUST apply these.

## SEMANTIC
1. **17-03 task 6**: do not pin M/B/P `mouthClose × closeScale >= 0.51` (effective now 0.30 = 0.50 × 0.60). Use 17-02's perceived-closure check: mouthClose <= 0.35, mouthPress >= 0.3, jawOpen <= 0.05.
2. **17-05 §1**: "effective mouthClose badge >= 0.85" is stale → closure criterion = mouthClose <= 0.35 + mouthPress ≈ 0.35 + rollLower/Upper (as 17-02).
3. **17-06 step 4**: docs/3 layering example → 0.50 × 0.60 = 0.30 (close) and 0.58 × 0.60 = 0.348 (press; press is scaled by closeScale too).
4. **17-CONTEXT / 17-DRAFT / 17-VERIFICATION**: any `mouthClose >= 0.85 / 0.51` requirement → same replacement; 17-02 (amended 2026-11-19) is authoritative.
5. **17-02 task 5**: Calibrator M preview currently uses its own literals; delegating to PHONEME_POSES['M'] changes it → accept, record in SUMMARY, drop "visually unchanged" for M.
6. **16-04 census #12 / anim-config viseme block**: jaw gate is now `activeMouthClose > 0.15 || activePress > 0.15`, `closure = min(1, max(closeRatio, pressRatio))`, new `PRESS_REF = 0.35` (viseme-scheduler.ts ~:26) → add `pressRef` key, reuse closeJawThreshold for the press gate; don't freeze the old formula.
7. **16-04 / 16-CONTEXT**: CalibrationProfile now has required `clockVersion: number` and presets 20/30/40 ms (calibration.ts) → keep profile untouched in 16, drop "schema unchanged" assertion.
8. **16-CONTEXT**: FaceController.render nowSec is now `audibleClock()`; blinkProvider still uses ctx.currentTime (intentional). 16-03 amendment already covers it.
9. **14-02 baseline**: new edge face-controller → audio/audible-clock (downward, allowed). Re-measure baseline; do NOT add an EXCEPTIONS entry.
10. **17-01 l.87 (pre-existing)**: no `wordToPhonemesSync` import in face-controller.ts; caller is g2p/phoneme-merge.ts:67. Re-verify.

## LINE-SHIFT
face-controller.ts +9 from ~l.76 (blinkProvider 90, testPhoneme 386, onInterruption 459, clearManualOverrides 695, render nowSec ~549); viseme-scheduler.ts +3/+4/+11; calibration.ts +10 past l.28; phoneme-visemes P/B/M ~l.112-120. Re-locate by symbol, not line. Affected: 16-01..05, 17-01, 17-02, contexts.

# Drift A2 — after merge ff17385 (render track)

Checker: haiku, read-only. Verdict: DRIFT (2 SEMANTIC low, 8 LINE-SHIFT files).

## SEMANTIC
1. **15-02**: `scene-panel.ts:~106` hardcoded EN label 'Skin subsurface scattering' not in copy.ts → add a copy slot in the step-7 retrofit (diacritics check in 8(d) won't catch it).
2. **14-CONTEXT §1.1 / 14-02 baseline**: new edges `ui/studio/panels → scene` (scene-panel → scene/skin-shader) and `app → core` (container → core/adaptive-resolution); src .ts count now 81. Allowed by LAYER_ORDER → record both edges; note SSS toggle reaches module-level state directly (not via AppServices).

## LINE-SHIFT (re-locate by symbol)
container.ts: dispose ~337, unsubLegacyBridge ~349, avatar:loaded ~111, update calls ~304-305, keydown editable ~285, legacy-bridge import :22 / call :78, dt cap ~302. scene-controller.ts: applyToDriver ~135, applyToEyeObjects ~149. Affects 14-03, 14-04, 15-06, 11.2-09, 16-02, 16-03, 16-04, 14-CONTEXT. Pre-existing: meta-person-loader.ts:53 is :59 (14-01).

## Notes
- 14-04 unused sweep: `EnvironmentManager.setupRoomEnvironment` (environment.ts:17) has no production caller now (only test mock) → decide delete/keep.
- 12-06: new Polish comment in src/scene/materials.ts covered by the translation task.

# Drift B1 — after merge a8c8dc1 (12-01 language gate + docs renames)
Checker: orchestrator inline grep. Verdict: DRIFT (LINE-SHIFT class — path renames).
Docs renamed (git mv, history kept). Plans 16-01, 16-02, 16-07, 17-01, 17-02, 17-03 still cite OLD names → executors use the NEW path:
docs/1-architektura-i-modele-3d.md → docs/1-architecture-and-3d-models.md · docs/2-integracja-elevenlabs-wss.md → docs/2-elevenlabs-wss-integration.md · docs/3-lip-sync-i-koartykulacja.md → docs/3-lip-sync-and-coarticulation.md · docs/4-audio-i-obsluga-przerwan.md → docs/4-audio-and-barge-in.md · docs/5-shadery-i-realizm.md → docs/5-shaders-and-realism.md · docs/6-analiza-opensource-i-rozwoj.md → docs/6-opensource-analysis-and-future.md · docs/A2F-LOCAL.md → docs/a2f-local-setup.md · docs/EN-visemes.md → docs/en-visemes.md
12-04 references old names intentionally (Gate B skip-list must be emptied there). 12-01 added allowlist entry viseme-mappings.ts:320 (flag for 12-06).
