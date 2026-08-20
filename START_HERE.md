# Start Here

## 1. Open in VS Code

Unzip this project and open the folder in VS Code.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## 2. Put it on GitHub

From the project folder:

```bash
git init
git add .
git commit -m "Initial Survivor.io optimizer project"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

## 3. Continue with GitHub Copilot

The repository already contains `.github/copilot-instructions.md`, so GitHub Copilot Chat should automatically receive the project's persistent domain context in supported VS Code/GitHub environments.

For a new Copilot chat, you can also paste the contents of `COPILOT_PROMPT.md` as the first message. It contains the merge rules, resonance values, Twinborn rules, optimizer priorities, screenshot-import requirements, architecture, regression facts, and near-term backlog.

A useful first Copilot message is:

> Read `.github/copilot-instructions.md`, `docs/REQUIREMENTS.md`, `docs/VISION_CALIBRATION.md`, and the current source/tests before editing anything. Treat those files as the current product specification. Preserve the exact merge-state solver and regression behavior unless I explicitly change a game rule. Then summarize your understanding of the optimizer, screenshot importer, and Twinborn progression logic before making changes.

## 4. Screenshot import workflow

- Select or drag **multiple screenshots** at once.
- Selection/drop automatically starts analysis; the **Analyze & apply screenshots** button can rerun it.
- The app aggregates detected inventory cards across the screenshots.
- Detected Legend Twinborns are marked as owned separately from normal inventory.
- The optimizer recalculates automatically.
- Review the detection table for low-confidence guesses and correct anything wrong.
- Avoid overlapping screenshots where the same physical card appears twice, because identical cards can legitimately exist and the importer does not auto-deduplicate them.

The current recognizer is calibrated to the screenshots used to build this project. Purple, Epic, Legend, all 12 tech types, and all six current Legend Twinborns are covered. Eternal inventory-card recognition still needs a real Eternal screenshot for calibration; the review table supports manual correction in the meantime.

## 5. Tests

```bash
npm test
```

The current regression suite checks the known 18-slot baseline, exact chest allocation, missing/owned Twinborn behavior, Drone Twinborn funding distance, and Epic-to-Legend conversion requirements.
