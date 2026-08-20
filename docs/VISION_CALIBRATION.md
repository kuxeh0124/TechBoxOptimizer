# Screenshot Recognition Calibration

The importer is intentionally a lightweight browser-side recognizer rather than OCR or a server-side vision service. It accepts multiple screenshots and automatically analyzes them after selection/drop.

## Current assumptions

- The Survivor.io tech inventory uses a five-column grid.
- Screenshots are cropped around the inventory grid similarly to the calibration images used to build `public/vision/`.
- Card rarity is identified from the large hex/card color field.
- Tech type is identified from the small circular badge at the top-right.
- Upgrade level is identified from the bottom badge.
- Legend Twinborn ownership is identified from the central Twinborn artwork.

## Recognition flow

1. Convert screenshot pixels to HSV.
2. Build a mask for known Purple/Epic/Legend card hues.
3. Apply a small morphological close to reconnect the card shape.
4. Find large connected components.
5. Cluster card-left/card-top positions into the five-column grid and rows.
6. Sample each occupied cell.
7. Classify rarity by colored-pixel counts.
8. For Legend cells, compare the center crop against six Twinborn templates.
9. Otherwise compare the top-right badge crop against 12 tech templates.
10. Compare the bottom badge crop against level templates for the detected rarity.
11. Return a confidence score and always expose manual correction in the UI.

## Calibration fixtures

The three screenshots used to build the current recognizer are stored under `test/fixtures/`. `scripts/build_vision_templates.py` regenerates the normalized tech, level, and Twinborn template crops plus `public/vision/manifest.json`. The matcher supports multiple samples per class so Purple/Epic/Legend UI variations can coexist.

## Adding a new calibration example

When the game UI changes or Eternal cards need recognition:

1. Add a representative screenshot locally. Avoid committing personal/unnecessary full screenshots if only small crops are needed.
2. Identify the card grid left/top coordinates.
3. Add the known card positions/labels to `scripts/build_vision_templates.py` (or add equivalent calibrated crops manually).
4. Run `python scripts/build_vision_templates.py`.
5. Add/update the browser fixture in `test/vision-browser.html` when practical.
6. Keep old templates if the old UI may still appear; nearest-template matching supports multiple samples per class.

## Known limitation

Eternal card artwork/color classification has not yet been calibrated from a real Eternal inventory screenshot. Users can manually correct a detected row to Eternal in the review table.
