# Requirements and Game Rules

This file is the human-readable source of truth for the optimizer. Keep it synchronized with `src/game-data.js`, `src/optimizer.js`, and the Copilot instructions.

## Terminology

- Purple = Excellent
- Yellow = Epic
- Red = Legend
- Rainbow = Eternal

## Merge chain

1. Excellent 0 + Excellent 0 -> Excellent 1
2. Excellent 1 + Excellent 1 -> Excellent 2
3. Excellent 2 + Excellent 2 -> Epic 0
4. Epic 0 + Epic 0 -> Epic 1
5. Epic 1 + Epic 1 -> Epic 2
6. Epic 2 + Epic 2 -> Epic 3
7. Epic 3 + Epic 3 -> Legend 0
8. Legend 0 + Legend 0 -> Legend 1
9. Legend 1 + Legend 0 -> Legend 2
10. Legend 2 + Legend 0 -> Legend 3
11. Legend 3 + Legend 0 -> Legend 4
12. Legend 4 + Legend 0 + Legend 0 -> Eternal

All ingredients are consumed.

## Resonance

| Tier | Energy |
|---|---:|
| Epic 0 | 50 |
| Epic 1 | 100 |
| Epic 2 | 150 |
| Epic 3 | 200 |
| Legend 0 | 300 |
| Legend 1 | 400 |
| Legend 2 | 550 |
| Legend 3 | 700 |
| Legend 4 | 850 |
| Eternal | 1000 |

Excellent = 0 direct resonance.

## Screenshot recognition

- Card color maps to rarity: purple = Excellent, yellow = Epic, red = Legend, rainbow = Eternal.
- The number in the bottom badge is the upgrade level.
- A blank bottom badge means level 0.
- Recognition is hierarchical: detect the Twinborn marker first, identify the pair or normal tech, detect level, and classify rarity last.
- A mistaken preliminary color signal must never prevent Twinborn detection.
- Use local OpenCV.js card-body alignment before template comparison, with the percentage result retained when alignment is unreliable or changes an otherwise confident complete label.
- Reference cards under `image_references/` are additional comparison samples; screenshot-derived samples remain available for equipped-card overlays and crop variation.

## Optimizer objective

1. Maximize currently equipable resonance across the configured resonance support slots.
2. Respect exact merge consumption.
3. Allocate every supplied Epic 0 selector chest.
4. If resonance is tied, bank unused-immediate-value chests toward the nearest meaningful future resonance breakpoint.
5. Balanced mode may spend only the configured resonance-loss budget to improve Twinborn progression.
6. Auto Twinborn targeting: missing Legend Twinborn first, then nearest owned Twinborn toward Eternal.
7. A craftable Eternal Twinborn is not automatically recommended. Compare total resonance before and after craft.

## Twinborn pairs

- Rocket + Drill
- Soccer + Durian
- Lightning + Boomerang
- Drone + Forcefield
- Laser + Shield
- Molotov + Brick

Twinborn ownership is independent from normal inventory.
