# Screenshot Recognition Calibration

The importer is intentionally a lightweight browser-side recognizer rather than OCR or a server-side vision service. It accepts multiple screenshots and automatically analyzes them after selection/drop.

## Current assumptions

- The Survivor.io tech inventory uses a five-column grid.
- Screenshots are cropped around the inventory grid similarly to the calibration images used to build `public/vision/`.
- Card rarity is identified from the large hex/card color field: purple is Excellent, yellow is Epic, red is Legend, and rainbow is Eternal.
- Tech type is identified from the small circular badge at the top-right.
- Upgrade level is identified from the bottom badge; a blank badge is Lv0.
- Legend Twinborn cards are distinguished from normal cards by the red Twinborn emblem at the upper-left.
- After that marker is detected, central Twinborn artwork identifies the owned pair.

## Recognition flow

1. Convert screenshot pixels to HSV.
2. Build a mask for known Excellent/Epic/Legend card hues with adaptive saturation/value thresholds.
3. Apply a small morphological close to reconnect the card shape.
4. Find large connected components.
5. Cluster card-left/card-top positions into the five-column grid and rows using screenshot-size-relative thresholds.
6. Sample each occupied cell using card crops scaled from the detected grid pitch.
7. Confirm that the cell contains a card using general saturated-pixel evidence without choosing a rarity.
8. Use OpenCV.js to isolate the central hex by its dominant rarity hue, suppress the two top overlay badges during alignment, and normalize card translation and scale. Accept the normalized result only when its complete label agrees with the percentage result or it clearly improves a low-confidence result; otherwise retain the percentage crop.
9. Compare the upper-left emblem against Twinborn and normal-part marker templates.
10. When the Twinborn marker wins, compare the center crop against the six Twinborn pair templates.
11. Otherwise compare the top-right badge crop and center artwork crop against 12 tech templates, then let the two signals vote.
12. Compare the bottom badge against level templates pooled across rarities; a blank badge is Lv0.
13. Classify rarity from card-color evidence as the final recognition stage.
14. Return a confidence score, alignment/grid diagnostics, color/template scores, and always expose manual correction in the UI.

Template confidence combines absolute image quality with the separation between the best and second-best classes. A close but visually strong match can therefore be high confidence, while a poor crop remains low confidence even when it narrowly wins its class comparison.

## Calibration fixtures

The three screenshots used to build the current recognizer are stored under `test/fixtures/`. Clean user-supplied card crops are stored under `image_references/`. `scripts/build_vision_templates.py` regenerates the normalized Twinborn/part marker, tech badge, tech artwork, level, and Twinborn pair template crops plus `public/vision/manifest.json`. The matcher supports multiple samples per class so Excellent/Epic/Legend UI variations and equipped overlays can coexist.

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
