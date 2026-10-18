/**
 * A stand-alone copy of Bond Match, for trying it without signing in. Nothing is sent anywhere;
 * bests are kept in this browser only.
 * Build: npm run bond-match:preview. Or run it: npx vite --config vite.bond-match-preview.config.ts
 *
 * Add ?server=ok|cap|offline|none for the stand-in server, ?bests=1 for some saved stars.
 * Add ?seed=123 to get the same shuffle every game (for screenshots), and ?mismatchMs=60000 to keep
 * a mismatch on show. The page also gives test scripts window.bondMatchPreview.perfectFlips(bond, size),
 * the card numbers to click for a perfect game with that seed, wrongPair and wrongSetPair for the
 * mismatch messages.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { findBondSet } from '../../shared/bond-match/bonds';
import { arePartners, buildDeck, partnersOf, type BoardSize } from '../../shared/bond-match/deck';
import { perfectFlips } from '../../shared/bond-match/perfectPlayer';
import { newGame } from '../../shared/bond-match/engine';
import { replay } from '../../shared/bond-match/save';
import type { BondMatchSaver, ServerBest } from '../../src/data/bondMatch';
import { MuteButton } from '../../src/components/MuteButton';
import { BondMatchPlay } from '../../src/games/bond-match/BondMatchPlay';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import '../space/preview.css';

const params = new URLSearchParams(location.search);
// ?server=ok (default) | cap (saved, no more points today) | offline (cannot be reached) | none (no saving at all).
// ?bests=1 starts with a few saved stars so the picker has something to show.
const server = params.get('server') ?? 'ok';
const seedParam = params.get('seed');
const seed = seedParam === null ? undefined : Number(seedParam);
const mismatchMs = params.has('mismatchMs') ? Number(params.get('mismatchMs')) : undefined;

declare global {
  interface Window {
    bondMatchPreview?: {
      perfectFlips: (bondId: string, size: BoardSize) => number[];
      /** Two cards that do not match, as card numbers from 0. */
      wrongPair: (bondId: string, size: BoardSize) => [number, number];
      /** Two cards that make the target but are in different colour sets (needs a board with both sets), or undefined. */
      wrongSetPair: (bondId: string, size: BoardSize) => [number, number] | undefined;
    };
  }
}

window.bondMatchPreview = {
  perfectFlips(bondId, size) {
    return perfectFlips(newGame(buildDeck(findBondSet(bondId)!, size, seed ?? 0)));
  },
  wrongPair(bondId, size) {
    const deck = buildDeck(findBondSet(bondId)!, size, seed ?? 0);
    const partners = partnersOf(deck);
    const b = partners.findIndex((_, j) => j !== 0 && !partners[0].includes(j));
    return [0, b];
  },
  wrongSetPair(bondId, size) {
    const deck = buildDeck(findBondSet(bondId)!, size, seed ?? 0);
    for (let i = 0; i < deck.cards.length; i++) {
      for (let j = i + 1; j < deck.cards.length; j++) {
        const x = deck.cards[i];
        const y = deck.cards[j];
        if (x.set !== y.set && arePartners(deck.target, x, { ...y, set: x.set })) return [i, j];
      }
    }
    return undefined;
  },
};

/** A stand-in for the server: it replays each game with the real engine and keeps bests in memory. Nothing leaves the page. */
function fakeSaver(): BondMatchSaver | undefined {
  if (server === 'none') return undefined;
  const bests: ServerBest[] = params.get('bests') === '1'
    ? [
        { bondId: 'whole-10', size: 'small', flips: 6, seconds: 30, stars: 3, plays: 2 },
        { bondId: 'whole-10', size: 'medium', flips: 14, seconds: 70, stars: 2, plays: 1 },
        { bondId: 'fraction-quarters', size: 'small', flips: 12, seconds: 50, stars: 1, plays: 1 },
      ]
    : [];
  return {
    async loadBests() {
      return server === 'offline' ? null : bests;
    },
    async save(item) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (server === 'offline') return null;
      // The real replay, without the "too fast for a human" rule, so a quick test game still saves here.
      const played = replay(item);
      if (!played.ok) return { status: 'invalid', problem: played.error };
      const { score } = played;
      const was = bests.find((b) => b.bondId === item.bondId && b.size === item.size);
      const best = {
        flips: Math.min(was?.flips ?? Infinity, score.flips),
        seconds: Math.min(was?.seconds ?? Infinity, score.seconds),
        stars: Math.max(was?.stars ?? 0, score.stars),
      };
      if (was) Object.assign(was, { flips: best.flips, seconds: best.seconds, stars: best.stars, plays: was.plays + 1 });
      else bests.push({ bondId: item.bondId, size: item.size, ...best, plays: 1 });
      return { status: 'saved', points: server === 'cap' ? 0 : 2, stars: score.stars, best };
    },
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <header className="preview-bar">
        <span>
          <strong>Preview</strong> · not the live site, bests are kept in this browser only
        </span>
        <MuteButton />
      </header>
      <main id="main">
        <BondMatchPlay makeSeed={seed === undefined ? undefined : () => seed} mismatchMs={mismatchMs} saver={fakeSaver()} />
      </main>
    </SoundProvider>
  </StrictMode>,
);
