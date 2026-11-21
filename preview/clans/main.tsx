/**
 * A stand-alone copy of Clan Quest's screens, for trying them without signing in. Nothing is saved.
 * Build: npm run clans:preview. Or run it: npx vite --config vite.clans-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClanQuest } from '../../src/games/clans';
import type { ClanSeasonSummary } from '../../src/data/clans';
import { clanFromChoices, startingDrafts } from '../../shared/clans/create';
import { newSession } from '../../src/games/clans/session';

// ?repick=1 opens on the new-season screen (pick names, looks, races and classes again).
function repickStart() {
  if (!new URLSearchParams(window.location.search).get('repick')) return null;
  const made = clanFromChoices(42, 'Bold Foxes', startingDrafts(42));
  if (!made.ok) return null;
  return newSession({ ...made.clan, season: 2, repick: 2 }, 42);
}

// ?ceremony=1 pretends Season 1 has just ended, to try the new-season ceremony (it opens until it is watched; the Hall can show it again).
let ceremonySeen = false;
const pretendPast: ClanSeasonSummary = {
  season: 1, seen: false, place: 3, clans: 44, monsterWins: 1,
  mine: {
    clanName: 'Bold Foxes', fame: 133, gold: 2400, followers: 36, bestLevel: 7,
    members: [
      { slot: 0, name: 'Aria', race: 'Elf', cls: 'Wizard', level: 7, look: 'female-1' },
      { slot: 1, name: 'Bram', race: 'Dwarf', cls: 'Warrior', level: 6, look: 'male-1' },
      { slot: 2, name: 'Cole', race: 'Human', cls: 'Knight', level: 5, look: 'male-2' },
      { slot: 3, name: 'Dot', race: 'Halfling', cls: 'Healer', level: 5, look: 'female-2' },
    ],
    buildings: { trainingHall: 3, smithy: 2, church: 1, barracks: 2, walls: 1, tower: 0, forge: 0, strongroom: 0 },
    monsterBeaten: false, villageDone: false, monsterTries: 1,
  },
  trophies: ['clan-veteran'],
  top: [
    { name: '', avatar: null, clanName: 'Swift Falcons', fame: 321, monster: false, village: false, isMe: false },
    { name: '', avatar: null, clanName: 'Clever Rangers', fame: 210, monster: false, village: false, isMe: false },
    { name: '', avatar: null, clanName: 'Bold Foxes', fame: 133, monster: false, village: false, isMe: true },
    { name: '', avatar: null, clanName: 'Brave Wolves', fame: 98, monster: true, village: true, isMe: false },
    { name: '', avatar: null, clanName: 'Mighty Bears', fame: 74, monster: false, village: false, isMe: false },
    { name: '', avatar: null, clanName: 'Happy Hawks', fame: 51, monster: false, village: false, isMe: false },
  ],
};
const pastSeason = new URLSearchParams(window.location.search).get('ceremony')
  ? { load: async () => ({ ...pretendPast, seen: ceremonySeen }), seen: async () => { ceremonySeen = true; } }
  : undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClanQuest typedNames pastSeason={pastSeason} initial={repickStart()} />
  </StrictMode>,
);
