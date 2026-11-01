/**
 * Diamond Drop's smaller screens: the level end, the boost shop, the Gem Book, the Hall of Diamond Finders and How to play. Every number on them is
 * read from shared/diamond/config.ts, so changing a number there changes the page.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ACHIEVEMENTS, BOOSTS, POINTS, EXTRA_TIME_SECONDS, GEMS, LAST_LEVEL, LEVELS, QUESTION_CAP, QUESTION_CAP_LAST, RARITY_PRICE, REPLAY_COIN_SHARE,
  SACK, SPECIAL_SHARE, STAR_TWO_SECONDS, levelSpec, type BoostId,
} from '../../../shared/diamond/config';
import { boostPrice, type Player } from '../../../shared/diamond/progress';
import { itemOf } from '../../../shared/diamond/workshop';
import { drawGem, GEM_LOOK } from './art/draw';
import { drawRig } from './art/items';
import type { DiamondBackend, Ended, HallRow } from './backend';

import { Sprite } from './Sprite';

function Page({ id, title, onBack, backLabel = 'Back to the map', children, coins }: { id: string; title: string; onBack: () => void; backLabel?: string; children: ReactNode; coins?: number }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="dd-page" aria-labelledby={id}>
      <div className="dd-page__top">
        <button type="button" className="button button--light-outline dd-btn" onClick={onBack}>{backLabel}</button>
        <h2 id={id} ref={heading} tabIndex={-1} className="dd-title">{title}</h2>
        {coins !== undefined && <span className="dd-chip"><span aria-hidden="true">🪙</span> {coins} coins</span>}
      </div>
      {children}
    </section>
  );
}

const Stars = ({ n }: { n: number }) => (
  <span className="dd-stars" role="img" aria-label={`${n} of 3 stars`}>
    {[0, 1, 2].map((i) => <span key={i} className={i < n ? 'is-on' : ''} aria-hidden="true">★</span>)}
  </span>
);

const sharePercent = Math.round(REPLAY_COIN_SHARE * 100);

// ————————————————————————————————————— Level end —————————————————————————————————————

export function LevelEnd({ ended, achieved, onShop, onAgain, onMap, againLabel }: {
  ended: Ended;
  /** Hub achievements this level just earned. */
  achieved: readonly (typeof ACHIEVEMENTS)[number][];
  onShop: () => void;
  onAgain: () => void;
  onMap: () => void;
  againLabel: string;
}) {
  const r = ended.result;
  const spec = levelSpec(r.level);
  const caught = GEMS.filter((g) => (r.caught[g.id] ?? 0) > 0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const title = r.level === LAST_LEVEL && r.diamond ? 'You found the Heart Diamond!' : r.passed ? `Level ${r.level} passed!` : 'So close!';
  return (
    <section className="dd-page dd-end" aria-labelledby="dd-end-title">
      <h2 id="dd-end-title" ref={heading} tabIndex={-1} className="dd-title">{title}</h2>
      <p className="dd-soft">Level {r.level} · {spec.place}</p>
      {r.passed ? <Stars n={r.stars} /> : <p>{r.level === LAST_LEVEL ? 'The Heart Diamond is still down there. Try again!' : `You banked ${r.banked} of ${spec.target}. Try again!`}</p>}
      <div className="dd-card">
        <h3 className="dd-h3">Gems caught</h3>
        {caught.length === 0 ? <p>No gems this time.</p> : (
          <ul className="dd-gems">
            {caught.map((g) => (
              <li key={g.id}>
                <Sprite size={40} draw={(c) => drawGem(c, g.id, 50, 50, 38)} />
                <span>{g.name} × {r.caught[g.id]}</span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="dd-h3">Coins</h3>
        {ended.newLevel ? (
          <p>You kept all <strong>{ended.coins}</strong> coins. A new level passed keeps every coin.</p>
        ) : (
          <p>
            Your gems were worth {r.coins} coins. {r.passed ? 'A replay' : 'A try that falls short'} keeps {sharePercent} in every 100 ({sharePercent}%), so you kept <strong>{ended.coins}</strong>.
          </p>
        )}
        {r.questions > 0 && <p>Hold on! questions: you held on {r.held} of {r.questions} times.</p>}
        {r.freeBoost && <p>A mystery sack gave you a free {BOOSTS.find((b) => b.id === r.freeBoost)?.name} for your next level.</p>}
        {ended.newLevel && r.level < LAST_LEVEL && <p>Level {r.level + 1} opens tomorrow. You can replay any level you’ve passed for stars, gems and coins.</p>}
        {achieved.length > 0 && (
          <ul className="dd-achieved" role="status" aria-label="Achievements earned">
            {achieved.map((a) => (
              <li key={a.id}><span aria-hidden="true">{a.emoji}</span> Achievement: <strong>{a.name}</strong> ({a.for.toLowerCase()})</li>
            ))}
          </ul>
        )}
        {ended.points > 0 && <p>+{ended.points} {ended.points === 1 ? 'point' : 'points'} for the hub.</p>}
        {ended.earned.length > 0 && (
          <p className="dd-earned" role="status">New in your Workshop: {ended.earned.map((id) => itemOf(id)?.name ?? id).join(', ')}!</p>
        )}
      </div>
      <div className="dd-row">
        <button type="button" className="button button--play dd-btn" onClick={onShop}>On to the shop</button>
        <button type="button" className="button button--light dd-btn" onClick={onAgain}>{againLabel}</button>
        <button type="button" className="button button--light-outline dd-btn" onClick={onMap}>Level map</button>
      </div>
    </section>
  );
}

// ————————————————————————————————————— Boost shop —————————————————————————————————————

export function Shop({ player, level, basket, onToggle, onStart, canStart, why, advice, onBack }: {
  player: Player;
  level: number;
  basket: BoostId[];
  onToggle: (id: BoostId) => void;
  onStart: () => void;
  canStart: boolean;
  why: string;
  /** Nugget's advice, with the working (null when help is off). */
  advice: string | null;
  onBack: () => void;
}) {
  const cost = basket.reduce((sum, id) => sum + (id === player.freeBoost ? 0 : boostPrice(id, level)), 0);
  const left = player.coins - cost;
  return (
    <Page id="dd-shop-title" title={`Shop for level ${level}`} onBack={onBack} coins={player.coins}>
      <p className="dd-soft">Boosts help on your next level only. One of each at most.</p>
      {advice && <p className="dd-advice"><strong>Nugget says:</strong> {advice}</p>}
      <ul className="dd-list">
        {BOOSTS.map((b) => {
          const inBasket = basket.includes(b.id);
          const free = b.id === player.freeBoost;
          const price = free ? 0 : boostPrice(b.id, level);
          const affordable = inBasket || price <= left;
          return (
            <li key={b.id} className={`dd-item${inBasket ? ' is-chosen' : ''}`}>
              <div className="dd-item__body">
                <h3 className="dd-item__name">{b.name}{free && <span className="dd-chip dd-chip--gold">Free from a sack!</span>}</h3>
                <p>{b.about}</p>
                <p className="dd-item__how">
                  {inBasket ? `In your bag.` : free ? 'Free this time.' : `You have ${left}. ${b.name} ${price}. ${affordable ? `You’ll have ${left - price} left.` : `You need ${price - left} more.`}`}
                </p>
                <button type="button" className={`button ${inBasket ? 'button--light' : 'button--primary'} dd-btn dd-btn--small`} aria-pressed={inBasket} disabled={!affordable} onClick={() => onToggle(b.id)}>
                  {inBasket ? 'Take it out' : free ? 'Take it (free)' : `Buy for ${price}`}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="dd-row">
        <button type="button" className="button button--play dd-btn dd-btn--big" onClick={onStart} disabled={!canStart}>
          Start level {level}{basket.length ? ` with ${basket.length} boost${basket.length > 1 ? 's' : ''}` : ''}
        </button>
      </div>
      {why && <p className="dd-why">{why}</p>}
    </Page>
  );
}

// ————————————————————————————————————— Gem Book —————————————————————————————————————

const prettyDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

export function GemBook({ player, onBack }: { player: Player; onBack: () => void }) {
  const found = GEMS.filter((g) => player.gemBook[g.id]).length;
  return (
    <Page id="dd-book-title" title="Gem Book" onBack={onBack}>
      <p className="dd-soft">{found} of {GEMS.length} gems found this season.</p>
      <ul className="dd-book">
        {GEMS.map((g, i) => {
          const page = player.gemBook[g.id];
          return (
            <li key={g.id} className={`dd-book__page${page ? '' : ' is-unknown'}${g.id === 'heartDiamond' ? ' is-heart' : ''}`}>
              <Sprite size={84} draw={(c) => drawGem(c, g.id, 50, 50, 38, { shadow: !page, halo: !!page })} label={page ? `${g.name}: ${GEM_LOOK[g.id].shape}` : 'A gem not found yet'} />
              <h3 className="dd-item__name">{page ? g.name : '???'}</h3>
              {page ? (
                <p className="dd-small">Caught {page.count} · first on {prettyDate(page.first)}</p>
              ) : (
                <p className="dd-small dd-soft">{g.id === 'heartDiamond' ? `Waits at the bottom of level ${LAST_LEVEL}.` : `First found on level ${i + 1}.`}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Page>
  );
}

// ————————————————————————————————————— Hall of Diamond Finders —————————————————————————————————————

export function Hall({ backend, onBack }: { backend: DiamondBackend; onBack: () => void }) {
  const [rows, setRows] = useState<HallRow[] | null>(null);
  const [trouble, setTrouble] = useState('');
  useEffect(() => {
    let current = true;
    void backend.hall().then((r) => {
      if (!current) return;
      if (r.ok) setRows(r.value); else setTrouble(r.message);
    });
    return () => { current = false; };
  }, [backend]);
  return (
    <Page id="dd-hall-title" title="Hall of Diamond Finders" onBack={onBack}>
      <p className="dd-soft">Everyone at your school who has reached the Heart Diamond, newest first, with the claw they dig with.</p>
      {trouble ? <p className="dd-trouble" role="alert">{trouble}</p> : !rows ? <p role="status">Opening the Hall…</p> : rows.length === 0 ? (
        <p>Nobody has found the Heart Diamond yet. Could you be the first?</p>
      ) : (
        <ul className="dd-hall">
          {rows.map((row, i) => (
            <li key={`${row.name}-${row.found}-${i}`} className={`dd-hall__row${row.me ? ' is-me' : ''}`}>
              <Sprite size={56} box={200} className="dd-hall__claw" draw={(c) => drawRig(c, row.worn, 0.6, true, [], false)} />
              <span className="dd-hall__name">{row.name}{row.me ? ' (you)' : ''}</span>
              <span className="dd-small dd-soft">found it on {prettyDate(row.found)}</span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

// ————————————————————————————————————— How to play —————————————————————————————————————

export function HowToPlay({ onBack }: { onBack: () => void }) {
  const first = LEVELS[0];
  return (
    <Page id="dd-how-title" title="How to play" onBack={onBack}>
      <div className="dd-card dd-how">
        <h3 className="dd-h3">Drop the claw</h3>
        <p>The claw swings from side to side. Press <strong>Drop</strong> (or Space, or tap the ground) and it shoots straight down its line. It grabs the first thing it touches and reels it up.</p>
        <p>Heavy things come up slowly. Rocks are heavy and worth nothing, so aim for the gems!</p>
        <h3 className="dd-h3">Pass the level</h3>
        <p>Each level has a clock and a target. Level 1 gives you {first.seconds} seconds to bank {first.target} gem coins. Reach the target before the clock runs out to pass. On level {LAST_LEVEL}, catch the Heart Diamond.</p>
        <p>After you pass, keep digging for more coins, or press Finish.</p>
        <h3 className="dd-h3">Hold on!</h3>
        <p>Rare gems can slip on the way up. A maths question pops up and the clock stops while you answer. Get it right and the claw holds on. Get it wrong and the gem falls back into the rock, where you can catch it again. At most {QUESTION_CAP} questions a level ({QUESTION_CAP_LAST} on level {LAST_LEVEL}).</p>
        <h3 className="dd-h3">One new level a day</h3>
        <p>You can try today’s new level as many times as you like. Once you pass it, the next level opens tomorrow. Levels you’ve passed are always open to replay.</p>
        <h3 className="dd-h3">Stars and coins</h3>
        <p>1 star for passing, 2 for passing with {STAR_TWO_SECONDS} seconds left, 3 for that and catching every kind of gem on the level.</p>
        <p>Passing a new level keeps all its coins. A replay, or a try that falls short, keeps {sharePercent}% of them.</p>
        <p>Mystery sacks hold coins ({SACK.coinsLow + SACK.coinsPerLevel} or more), {SACK.seconds} extra seconds, or a free boost.</p>
        <h3 className="dd-h3">The shop</h3>
        <ul>
          {BOOSTS.map((b) => <li key={b.id}><strong>{b.name}</strong> ({b.base} + {b.perLevel} × the level number): {b.id === 'extraTime' ? `${EXTRA_TIME_SECONDS} more seconds.` : b.about}</li>)}
        </ul>
        <h3 className="dd-h3">The Claw Workshop</h3>
        <p>Upgrades change how your claw looks, never how it digs: Common {RARITY_PRICE.common}, Cool {RARITY_PRICE.cool}, Epic {RARITY_PRICE.epic}, Legendary {RARITY_PRICE.legendary} coins. The special of the week costs {Math.round(SPECIAL_SHARE * 100)}% of its price. A few can’t be bought: you win them.</p>
        <h3 className="dd-h3">Achievements and points</h3>
        <ul>
          {ACHIEVEMENTS.map((a) => <li key={a.id}><span aria-hidden="true">{a.emoji}</span> <strong>{a.name}</strong>: {a.for}.</li>)}
        </ul>
        <p>Points: {POINTS.firstPass} for passing a level for the first time, {POINTS.newStar} for each new star, {POINTS.diamond} for the Heart Diamond. Everyone who finds it goes in the Hall of Diamond Finders.</p>
      </div>
    </Page>
  );
}
