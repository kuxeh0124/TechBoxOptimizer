# Survivor.io Tech Resonance Optimizer — Copilot Instructions

You are working on a browser-based Survivor.io Tech Part optimizer. Treat the rules below as the source of truth unless the user explicitly changes them. Do not silently reinterpret merge rules, resonance values, Twinborn pairings, or optimization priorities.

## Product goal

The app helps the player decide where to spend a chosen number of Epic Lv0 selector chests. It must optimize the player's current resonance strength while also making intelligent progress toward Legend and Eternal Twinborn goals.

The app also imports multiple inventory screenshots, recognizes tech parts/Twinborns, aggregates them into inventory, and immediately recalculates the optimizer.

## Terminology

Use these user-facing terms everywhere:

- Yellow = **Epic**
- Red = **Legend**
- Rainbow = **Eternal**
- Purple remains **Purple**
- “Reso” means resonance.

Internal legacy field names may remain for compatibility:

- `Y0..Y3` = Epic Lv0..Lv3
- `R0..R4` = Legend Lv0..Lv4
- `Rainbow` = Eternal

Do not expose “Yellow”, “Red”, or “Rainbow” in new UI copy unless explaining legacy internal code.

## Tech parts

There are 12 base tech types:

1. Rocket
2. Drill
3. Soccer
4. Durian
5. Lightning
6. Boomerang
7. Drone
8. Forcefield
9. Laser
10. Shield
11. Molotov
12. Brick

## Twinborn pairs

The six Twinborn pairings are fixed:

- Rocket Twinborn = Rocket + Drill
- Soccer Twinborn = Soccer + Durian
- Lightning Twinborn = Lightning + Boomerang
- Drone Twinborn = Drone + Forcefield
- Laser Twinborn = Laser + Shield
- Molotov Twinborn = Molotov + Brick

Twinborn ownership is a separate state from the normal tech-part inventory. Clearing normal inventory must never clear Twinborn ownership.

If a Twinborn is missing, Auto mode should prioritize building the missing **Legend Twinborn** before pushing owned Twinborns toward Eternal.

## Merge rules

These are exact and one-way. Ingredients are consumed.

- Purple Lv0 + Purple Lv0 -> Purple Lv1
- Purple Lv1 + Purple Lv1 -> Purple Lv2
- Purple Lv2 + Purple Lv2 -> Epic Lv0
- Epic Lv0 + Epic Lv0 -> Epic Lv1
- Epic Lv1 + Epic Lv1 -> Epic Lv2
- Epic Lv2 + Epic Lv2 -> Epic Lv3
- Epic Lv3 + Epic Lv3 -> Legend Lv0
- Legend Lv0 + Legend Lv0 -> Legend Lv1
- Legend Lv1 + Legend Lv0 -> Legend Lv2
- Legend Lv2 + Legend Lv0 -> Legend Lv3
- Legend Lv3 + Legend Lv0 -> Legend Lv4
- Legend Lv4 + Legend Lv0 + Legend Lv0 -> Eternal

Do not treat tiers as freely convertible numeric currency. The optimizer must respect the exact reachable merge states.

## Resonance energy

Only these tiers contribute resonance energy:

- Epic Lv0 = 50
- Epic Lv1 = 100
- Epic Lv2 = 150
- Epic Lv3 = 200
- Legend Lv0 = 300
- Legend Lv1 = 400
- Legend Lv2 = 550
- Legend Lv3 = 700
- Legend Lv4 = 850
- Eternal = 1000

Purple contributes zero resonance directly but can merge upward.

Important: merging can reduce the raw sum of resonance energy because ingredients are consumed. Example: 2 x Legend Lv0 = 600 raw energy, while the resulting Legend Lv1 is 400. A merge can still be beneficial because it compresses energy into fewer resonance slots and frees slots for other pieces.

Therefore every optimization must calculate the final post-merge inventory and then select the best pieces for the available resonance slots.

## Optimization objectives

### Primary objective

**Maximize total equipped resonance energy.**

Do not prioritize Eternal count over resonance.

### Chest allocation

The user enters an exact number of Epic Lv0 choice chests. Every supplied chest must be allocated to a tech type.

If a chest does not improve resonance immediately, it is still future capital. Bank it into the best future progression route rather than leaving it unallocated.

### Future-aware tie breaking

When several chest allocations produce the same resonance now, prefer the allocation that reaches the next meaningful resonance breakpoint in fewer future Epic Lv0 chests. Continue looking beyond one breakpoint when needed.

### Balanced Twinborn mode

Balanced mode works like this:

1. Find the absolute maximum resonance achievable with the given chest count.
2. Read the user's allowed resonance-loss budget.
3. Keep the final plan at or above `absoluteMaxResonance - lossBudget`.
4. Within that permitted loss, maximize useful Twinborn progression.
5. Missing Legend Twinborns come first in Auto mode.
6. Owned Twinborns progress toward Eternal afterward.
7. Never force the final Eternal Twinborn craft solely because it is craftable.
8. Compare resonance before and after the Eternal Twinborn craft and recommend it only if its loss is within the user's allowed budget.

### Pure Resonance mode

Ignore Twinborn progression as an objective and maximize resonance/future resonance progression only.

### Twinborn Rush mode

Prioritize Twinborn funding more aggressively, even when it costs resonance. Still show the resonance cost clearly.

## Twinborn Eternal planning assumption

For an owned Legend Twinborn, the planner currently assumes the Legend Twinborn remains intact while spare component pieces are built. At the final Eternal Twinborn step, the Legend Twinborn can be dismantled to recover one Legend Lv0 component from each side, and the Eternal Twinborn consumes one Eternal of each component.

If game mechanics change, isolate this assumption behind a dedicated domain function instead of scattering it through UI code.

## Screenshot importer

The screenshot importer is browser-side and currently template-based.

Requirements:

- Accept **multiple screenshots** in one import.
- Treat screenshots as additive pieces of one inventory capture.
- Detect the five-column inventory grid.
- Detect Purple, Epic, and Legend rarity from card colors.
- Detect the 12 tech types using the small circular tech badge at the upper-right of each card.
- Detect upgrade level using the bottom level badge.
- Detect the six known Legend Twinborn artworks.
- Twinborn cards must update Twinborn ownership and must **not** be counted as normal component parts.
- Show confidence and a manual review table after auto-recognition.
- Low-confidence recognition should never silently disappear; import the best guess but highlight it for correction.
- The user must be able to switch a detected row between Part and Twinborn, change tech/pair, rarity, and level, or ignore it.
- Applying reviewed results should immediately update inventory and rerun optimization.
- Do not deduplicate identical-looking cards across screenshots automatically. Two identical cards can be legitimate separate inventory pieces. The user should avoid overlapping screenshots or manually ignore duplicated rows.

Current calibration assets are under `public/vision/` and were derived from the user's supplied game screenshots. The current recognizer is calibrated for Purple/Epic/Legend and the six current Legend Twinborns. Eternal card screenshot recognition is not yet calibrated; manual review must remain available.

Keep image recognition modular under `src/vision.js` or a future `src/vision/` directory. Do not entangle screenshot parsing with optimizer rules.

## Architecture

Current important files:

- `src/game-data.js` — constants, terminology mappings, inventory helpers, preset data.
- `src/optimizer.js` — merge-state solver, resonance optimization, future banking, Twinborn planning.
- `src/vision.js` — screenshot grid detection and template matching.
- `src/app.js` — UI state, rendering, persistence, screenshot workflow.
- `public/vision/manifest.json` — recognition template manifest.
- `public/vision/tech/` — tech badge templates.
- `public/vision/twinborn/` — Twinborn artwork templates.
- `public/vision/levels/` — rarity/level badge templates.
- `test/optimizer.test.js` — domain regression tests.

Prefer domain logic that is pure and testable. UI code should call the domain layer rather than reimplementing merge math.

## Regression facts from the current catalogued inventory

The original screenshot preset contains:

- Legend Lv4: Rocket, Forcefield, Drill, Lightning, Drone, Laser
- Legend Lv3: Shield, Brick, Boomerang, Durian, Soccer, Molotov
- Legend Lv0: Drone x1
- Epic Lv3: Shield, Drill, Drone
- Epic Lv2: Forcefield, Shield, Durian, Soccer, Drone, Molotov
- Epic Lv1: Rocket, Brick, Boomerang, Durian, Lightning, Soccer, Forcefield
- Epic Lv0: Drill, Lightning, Drone, Laser
- Purple Lv2: Rocket, Forcefield, Drill, Drone, Laser
- Purple Lv1: Rocket, Forcefield, Shield, Boomerang, Durian, Drill, Lightning, Soccer, Drone, Laser, Molotov
- Purple Lv0: Forcefield, Drill, Soccer, Drone, Laser
- All six Legend Twinborns owned

With 18 resonance slots and zero Epic selector chests, the current regression baseline is **10,500 resonance**.

The owned Drone Twinborn Eternal funding path from this preset currently calculates:

- Drone side: 0 additional Epic Lv0 chests
- Forcefield side: 10 additional Epic Lv0 chests
- Total: 10

Treat these as regression checks unless the game rules or starting preset are deliberately changed.

## Coding rules

- Add or update tests whenever optimizer behavior changes.
- Do not replace exact merge-state search with a simplistic “equivalent value” formula unless it is formally proven equivalent for that specific subproblem.
- Avoid mutation of caller-owned inventory objects in optimizer functions.
- Make expensive look-ahead logic explicit and bounded.
- Preserve manual inventory editing with +/- controls.
- Preserve localStorage persistence.
- Keep the app deployable as a static Vite site.
- Use relative asset paths so GitHub Pages/subdirectory hosting works.
- Do not add a server or cloud dependency for screenshot parsing unless the user explicitly requests it.

## When the user gives a new game rule

1. Update `docs/REQUIREMENTS.md` first or in the same change.
2. Update the domain constants/logic.
3. Add a regression test reproducing the new rule.
4. Update UI terminology/help text if needed.
5. Never silently migrate existing saved inventory in a way that changes counts.

## Near-term backlog

Good next improvements include:

- Add Eternal-card screenshot calibration once a real Eternal inventory screenshot is available.
- Add screenshot crop/debug overlays so the user can see exactly what each recognizer sampled.
- Add import diagnostics with per-template scores.
- Add a calibration screen for new game UI versions.
- Add export/import of inventory JSON.
- Add optimizer scenario comparison, e.g. 1/5/10/20/50 Epic selector chests.
- Add automated browser tests for the screenshot importer.

When modifying the project, explain optimizer changes in game terms as well as code terms.
