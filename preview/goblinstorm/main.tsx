/**
 * The Goblin Storm preview: the whole game with no sign-in. It never talks to the school's server: the stand-in
 * backend makes questions from a fixed pretend focus (the times tables) and replays each run in this page.
 * Run it: npx vite --config vite.goblinstorm-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoblinStormGame } from '../../src/games/goblinstorm/GoblinStormGame';
import { HEROES, LEGENDARY, LEGENDARY_IDS, MAPS, SHOP_IDS, STORM_FIRST } from '../../shared/goblinstorm/config';
import { shopTop } from '../../shared/goblinstorm/shop';
import { emptySave, standInBackend } from '../../src/games/goblinstorm/backend';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';

const params = new URLSearchParams(location.search);
const multipleChoice = params.get('mc') === '1';
// ?open=all: every hero and map open, to try them all (the pretend save is otherwise fresh and lives in this page).
const openAll = params.get('open') === 'all';
// ?gold=2000: start with that much gold, to try the shop.
const gold = Math.max(0, Math.floor(Number(params.get('gold')) || 0));
// ?runs=5: that many of today's 5 runs already used, to see "All done for today".
const today = Math.max(0, Math.floor(Number(params.get('runs')) || 0));
// ?storm=1: show the Storm Lands (not live yet), with the Storm Gate open: the whole shop bought and the Fire Dragon beaten.
// Add ?legend=2 to have every Legendary upgrade at that level (each stops at its own top).
const storm = params.get('storm') === '1';
const legend = Math.max(0, Math.floor(Number(params.get('legend')) || 0));
const stormShop = Object.fromEntries([
  ...SHOP_IDS.map((id) => [id, shopTop(id)] as const),
  ...LEGENDARY_IDS.map((id) => [id, Math.min(legend, LEGENDARY[id].costs.length)] as const),
]);
const firstFive = MAPS.slice(0, STORM_FIRST).map((_, i) => i);
const base = openAll ? { ...emptySave(), heroes: HEROES.map((h) => h.id), bosses: (storm ? MAPS : MAPS.slice(0, STORM_FIRST)).map((_, i) => i) } : emptySave();
const start = { ...base, ...(storm ? { shop: stormShop, bosses: openAll ? base.bosses : firstFive } : {}), gold, today };
const backend = standInBackend(undefined, multipleChoice, start);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <GoblinStormGame
        backend={backend}
        stormLands={storm}
        extra={<p className="gs-menu__sub" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>Preview only: nothing is saved to the school. Pretend focus: times tables. Add ?mc=1 for pick-an-answer questions, ?open=all to open every hero and map, ?gold=2000 to try the shop, ?runs=4 to start with one run left today, ?storm=1 for the Storm Lands (add &legend=2 for Legendary upgrades).</p>}
      />
    </SoundProvider>
  </StrictMode>,
);
