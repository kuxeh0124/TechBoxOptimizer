# Requirements and Game Rules

This file is the human-readable source of truth for the optimizer. Keep it synchronized with `src/game-data.js`, `src/optimizer.js`, and the Copilot instructions.

## Terminology

- Purple = Purple
- Yellow = Epic
- Red = Legend
- Rainbow = Eternal

## Merge chain

1. Purple 0 + Purple 0 -> Purple 1
2. Purple 1 + Purple 1 -> Purple 2
3. Purple 2 + Purple 2 -> Epic 0
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

Purple = 0 direct resonance.

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
