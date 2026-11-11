# 7. Testing and checking the screens

## Tests

- **How many:** [docs/TESTING.md](../TESTING.md) "How many" is the rule (older and junior games differ). The database test file and the "index.ts is up to date" check don't count.
- **While you work:** `npx vitest run shared/<id> src/games/<id> supabase/functions/<id>`.
- **Before the PR:** `npm run typecheck`, `npm run test:changed` and `npm run build`. Don't run `test:all` locally: the PR's Site checks run every test, split across 4 machines. A busy-machine timeout that passes alone with `--testTimeout=30000`: say so in the PR.
- **Date or time tests** ("Today", weekends, midnight) pin the clock.
- **Server function:** logic in `handler.ts` with the database passed in, so `handler.test.ts` runs without Deno or a database. Rebuild only your `index.ts` (`npm run build:functions -- <id>`) and keep its "index.ts is up to date" test.
- **Database:** `supabase/tests/database/<id>.test.sql` (pgTAP; copy `supabase/tests/database/weka.test.sql` or `toonflap.test.sql`). Check: pupils can't read the server-only tables (42501), can't call the server-only functions, see only their school, and a save sent twice counts once. Run it on a throw-away copy: `scripts/scratch-db.sh <id>`, then `scripts/scratch-test.sh <id> supabase/tests/database/<id>.test.sql`, then drop the copy. The PR's Database checks run every file on a fresh copy.

## Trying it

- **Locally in the real site:** code switch on only on your computer: `const ON = false; export const myGameOn = () => ON || import.meta.env.VITE_<ID>_ON === 'true'` (copy `src/games/weka/switch.ts`), and `VITE_<ID>_ON=true` in `.env.local`. It talks to the **live** project, so save no test data there.
- **Preview without sign-in:** `preview/<id>/main.tsx` with a fake pupil and a trial backend that runs your `shared/` rules in the browser (copy `preview/toonflap/`), built with `npx vite build --config vite.<id>-preview.config.ts`. It must never call the live server: give it a fixed fake focus and facts. Publishing it as a private Artifact works well for James to try on his phone.
- **Simulator** (balance games): `scripts/<id>-sim.mjs` plays thousands of games with the shared rules.

## Screen checks: phone, iPad and laptop

Screenshot every screen of the game (home, a go, right, wrong and show-why, help, guide, finish) at these sizes, look at each one yourself, and fix anything cut off, overlapping, too small to tap or off screen:

| Device | Size |
|---|---|
| Classroom Chromebook / laptop | 1366 × 640 |
| iPad landscape / portrait | 1024 × 768, 820 × 1180 |
| Phone landscape / portrait | 844 × 390, 390 × 844 |

```js
// node shots.cjs  (the preview or dev server running on localhost:5173)
const { chromium } = require('playwright');
const sizes = [[1366, 640], [1024, 768], [820, 1180], [844, 390], [390, 844]];
(async () => {
  const browser = await chromium.launch();
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto('http://localhost:5173/#/<id>');
    await page.screenshot({ path: `/mnt/project-files/<id>/${width}x${height}-home.png` });
    await page.close();
  }
  await browser.close();
})();
```

James doesn't need to approve screenshots. Keep them in `/mnt/project-files/<id>/` so a later thread can compare.
