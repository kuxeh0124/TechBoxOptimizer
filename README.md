# Survivor.io Tech Resonance + Twinborn Optimizer

A GitHub/VS Code friendly rewrite of the single-file optimizer, with:

- exact Purple -> Epic -> Legend -> Eternal merge rules
- resonance-slot optimization
- exact Epic Lv0 selector chest allocation
- future-aware chest banking
- Legend/Eternal Twinborn planning
- missing-Twinborn prioritization
- resonance-loss budget for Twinborn progression
- +/- inventory controls
- multiple screenshot upload and automatic inventory recognition
- manual recognition review/correction
- localStorage persistence
- regression tests


## VS Code / GitHub handoff

See [`START_HERE.md`](START_HERE.md) for the fastest setup, GitHub push commands, screenshot-import workflow, and the recommended Copilot starting message.

The repository also contains `.github/copilot-instructions.md`; keep that file updated when game rules or product behavior change so Copilot has persistent project context.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

The generated `dist/` folder is static and can be hosted anywhere. `vite.config.js` uses a relative base path so repository-subfolder hosting is easier.

## Screenshot workflow

1. Open **Screenshot inventory import**.
2. Select or drag multiple inventory screenshots.
3. Selection/drop automatically starts analysis; **Analyze & apply screenshots** remains available as a retry button.
4. The screenshots are treated as additive portions of the same inventory capture.
5. The app replaces the normal inventory by default and marks any detected Legend Twinborns as owned.
6. Review low-confidence rows and correct them if necessary.
7. Click **Apply reviewed detection** after corrections.
8. The optimizer recalculates immediately.

Avoid overlapping screenshots where the same physical inventory cards appear twice. The importer intentionally does not deduplicate visually identical cards because two identical tech parts can legitimately exist.

## Current screenshot recognition scope

The current local recognizer is calibrated from the screenshots used while designing this project:

- all 12 tech types
- Purple levels 0-2
- Epic levels 0-3
- Legend levels 0-4 (Legend 1/2 use synthetic color-calibrated level samples until real screenshots are supplied)
- all six current Legend Twinborn artworks

Eternal-card screenshot recognition still needs a real calibration screenshot. The review UI can manually set a detected part to Eternal meanwhile.

## Important files

- `src/game-data.js` — rules/constants/inventory preset
- `src/optimizer.js` — optimization engine
- `src/vision.js` — screenshot parser
- `src/app.js` — UI and state
- `public/vision/` — local recognition templates
- `.github/copilot-instructions.md` — repository context for GitHub Copilot
- `COPILOT_PROMPT.md` — same context in a copy/paste friendly file
- `docs/REQUIREMENTS.md` — human-readable game rules
- `docs/VISION_CALIBRATION.md` — screenshot recognizer notes
- `test/optimizer.test.js` — optimizer regression tests

## Starting inventory preset

The original three screenshots are encoded as the built-in preset, including the additional Legend Lv0 Drone and all six owned Legend Twinborns.

The current 18-slot baseline regression result is **10,500 resonance**.

## Development principle

Do not replace the exact merge-state solver with a simple “equivalent material value” calculation for resonance decisions. Merges consume pieces and can reduce raw resonance while improving slot efficiency, so the reachable post-merge state matters.
