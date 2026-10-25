import { useState, type ReactNode } from 'react';
import {
  ARMOURS, CLASSES, EXP_TO_CHALLENGE, LOOKS, MAX_LEVEL, WEAPONS, expNeeded, masterFor,
} from '../../../shared/lord/data';
import {
  buyGear, canChallengeMaster, canFaceDragon, healCost, healPrice, heroAttack, heroDefence, kindnessDiscount, shopPrice,
} from '../../../shared/lord/engine';
import { NUMBER_GUESS_TRIES } from '../../../shared/lord/maths';
import type { LordAction, LordReply, LordState, Stats } from '../../../shared/lord/server';
import type { Hero, HeroClass } from '../../../shared/lord/types';
import type { Asked, AskOptions } from './useAsk';
import { ArmourSprite, HeroSprite, Icon, MonsterSprite, WeaponSprite } from './Sprite';
import { ICON_TILES } from './tileMap';
import { BARD_SONGS, dayHash } from './text';
import { Portrait, Stage } from './Stage';
import { lookThumb, type PersonId, type SceneId } from './art';
import type { MomentId } from '../../../shared/lord/maths';

export type Ask = (moment: MomentId, options: AskOptions) => Promise<Asked>;
export type Reply = Extract<LordReply, { ok: true }>;

export interface PlaceProps {
  state: LordState;
  hero: Hero;
  /** Sends one request to the server and waits. Null if it was turned down or could not be sent (the pupil has been told). */
  act: (action: LordAction) => Promise<Reply | null>;
  ask: Ask;
  say: (note: string) => void;
  back: () => void;
  /** A request is on its way: buttons wait. */
  busy: boolean;
}

/**
 * One place in the village: its painting at the top with the person who works there standing in it, the name on a
 * sign, and what you can do there on a parchment panel below.
 */
export function Place({ title, children, back, tile, scene = 'village', person }: {
  title: string; children: ReactNode; back: () => void; tile?: keyof typeof ICON_TILES; scene?: SceneId; person?: PersonId;
}) {
  return (
    <section className="lord-place" aria-label={title}>
      <Stage scene={scene} size="short">
        {person && <Portrait who={person} />}
        <header className="lord-place__head">
          <h2 className="lord-sign">
            {tile && <Icon name={tile} scale={2} />} {title}
          </h2>
          <button type="button" className="lord-btn" onClick={back}>
            <kbd>Esc</kbd> Back to the village
          </button>
        </header>
      </Stage>
      <div className="lord-panel">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- the shop

export function Shop({ hero, act, ask, say, back, busy }: PlaceProps) {
  const [slot, setSlot] = useState<'weapon' | 'armour'>('weapon');
  const table = slot === 'weapon' ? WEAPONS : ARMOURS;
  const Sprite_ = slot === 'weapon' ? WeaponSprite : ArmourSprite;
  const stat = slot === 'weapon' ? 'strength' : 'defence';

  async function buy(index: number) {
    const check = buyGear(hero, slot, index);
    if (!check.ok) return say(check.reason);
    const asked = await ask('shop', {
      title: 'The shopkeeper’s question',
      note: `Answer right for 10% off the ${table[index].name}.`,
      closeLabel: 'No thanks, pay full price',
    });
    const reply = await act({ action: 'shop-buy', slot, index, proof: asked?.proof ?? null });
    if (!reply) return;
    const r = reply.result as { item: string; paid: number; refund: number; saved: number };
    say(`You bought the ${r.item} for ${r.paid} gold${r.refund ? ` (and sold your old one for ${r.refund})` : ''}${r.saved > 0 ? `. You saved ${r.saved} gold!` : '.'}`);
  }

  return (
    <Place title="The Blacksmith and Armourer" tile="sword" scene="shop" person="shop" back={back}>
      <p className="lord-lead">
        Your old gear sells back for half price. The best gear needs enough base {stat}: you get that by beating your masters.
        {kindnessDiscount(hero) > 0 && ` Your kindness gives ${Math.round(kindnessDiscount(hero) * 100)}% off.`}
      </p>
      <div className="lord-tabs" role="tablist">
        {(['weapon', 'armour'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={slot === s} className={`lord-btn${slot === s ? ' lord-btn--hot' : ''}`} onClick={() => setSlot(s)}>
            {s === 'weapon' ? 'Weapons' : 'Armour'}
          </button>
        ))}
      </div>
      <ul className="lord-shop">
        {table.map((item, i) => {
          if (i === 0) return null;
          const owned = hero[slot] === i;
          const worse = hero[slot] > i;
          const locked = (slot === 'weapon' ? hero.strength : hero.defence) < item.need;
          return (
            <li key={item.name} className={owned ? 'is-owned' : locked ? 'is-locked' : ''}>
              <Sprite_ index={i} />
              <span className="lord-shop__name">{item.name}</span>
              <span>+{item.power} {slot === 'weapon' ? 'strength' : 'defence'}</span>
              <span><Icon name="gold" scale={1} /> {shopPrice(hero, item.cost)}</span>
              {owned ? (
                <strong>You have this</strong>
              ) : worse ? (
                <span className="lord-soft">Worse than yours</span>
              ) : locked ? (
                <span className="lord-soft">Needs {item.need} {stat}</span>
              ) : (
                <button type="button" className="lord-btn" disabled={busy} onClick={() => void buy(i)}>
                  Buy
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Place>
  );
}

// ---------------------------------------------------------------- the healer

export function Healer({ hero, act, ask, say, back, busy }: PlaceProps) {
  const missing = hero.maxHp - hero.hp;
  const price = healPrice(hero.level);

  async function pay(hp: number) {
    const amount = Math.min(hp, missing);
    if (amount <= 0) return say('You are already in perfect health.');
    if (healCost(hero, 1) > hero.gold) return say('You cannot afford even one point of healing.');
    const asked = await ask('healer', {
      title: 'The healer’s bill',
      note: `${amount} health at ${price} gold each. Answer right for 10% off.`,
      closeLabel: 'No thanks, pay full price',
    });
    const reply = await act({ action: 'heal', hp: amount, proof: asked?.proof ?? null });
    if (!reply) return;
    const r = reply.result as { healed: number; paid: number; discount: number };
    say(`The healer mends ${r.healed} health for ${r.paid} gold${r.discount ? ` (10% off!)` : ''}.`);
  }

  return (
    <Place title="The Healer’s Hut" tile="heart" scene="healer" person="healer" back={back}>
      <p className="lord-lead">
        Health: <strong>{hero.hp} / {hero.maxHp}</strong>. Every point costs <strong>{price}</strong> gold. All your health comes back free tomorrow.
      </p>
      <div className="lord-actions">
        {[10, 25].map((n) => (
          <button key={n} type="button" className="lord-btn" disabled={missing <= 0 || busy} onClick={() => void pay(n)}>
            Heal {Math.min(n, missing) || n} <small>({healCost(hero, Math.min(n, Math.max(missing, 1)))} gold)</small>
          </button>
        ))}
        <button type="button" className="lord-btn lord-btn--hot" disabled={missing <= 0 || busy} onClick={() => void pay(missing)}>
          Heal everything <small>({healCost(hero, missing)} gold)</small>
        </button>
      </div>
      {hero.gold < healCost(hero, missing) && missing > 0 && <p className="lord-soft">You do not have enough for everything. The healer will heal as much as you can pay for.</p>}
    </Place>
  );
}

// ---------------------------------------------------------------- the bank

export function Bank({ hero, state, act, ask, say, back, busy }: PlaceProps) {
  const canAskInterest = hero.level >= 4 && hero.bank > 0 && !state.interestDone;

  async function move(op: 'deposit' | 'withdraw', amount: number) {
    const reply = await act({ action: 'bank', op, amount });
    if (reply) say(op === 'deposit' ? `You put ${(reply.result as { moved: number }).moved} gold in the bank.` : `You take ${(reply.result as { moved: number }).moved} gold out of the bank.`);
  }

  async function interest() {
    const asked = await ask('bank', { title: 'The banker’s question', note: 'Answer right for a little interest on your savings.', closeLabel: 'Not today' });
    if (!asked) return;
    const reply = await act({ action: 'bank', op: 'interest', proof: asked.proof });
    if (!reply) return;
    const extra = (reply.result as { interest: number }).interest;
    say(extra > 0 ? `The banker adds ${extra} gold of interest. Well done!` : 'No interest today, but you can try again tomorrow.');
  }

  return (
    <Place title="The Bank" tile="coin" scene="bank" person="bank" back={back}>
      <p className="lord-lead">Gold in the bank is safe. If you lose a fight, only the gold you are carrying is lost.</p>
      <p className="lord-big">
        <Icon name="gold" /> Carrying <strong>{hero.gold}</strong> · In the bank <strong>{hero.bank}</strong>
      </p>
      <div className="lord-actions">
        <button type="button" className="lord-btn lord-btn--hot" disabled={hero.gold <= 0 || busy} onClick={() => void move('deposit', hero.gold)}>Deposit all</button>
        <button type="button" className="lord-btn" disabled={hero.gold <= 1 || busy} onClick={() => void move('deposit', Math.floor(hero.gold / 2))}>Deposit half</button>
        <button type="button" className="lord-btn" disabled={hero.bank <= 0 || busy} onClick={() => void move('withdraw', hero.bank)}>Withdraw all</button>
        <button type="button" className="lord-btn" disabled={hero.bank <= 1 || busy} onClick={() => void move('withdraw', Math.floor(hero.bank / 2))}>Withdraw half</button>
      </div>
      {hero.level >= 4 && (
        <div className="lord-actions">
          <button type="button" className="lord-btn" disabled={!canAskInterest || busy} onClick={() => void interest()}>
            Ask about interest {state.interestDone ? '(done today)' : hero.bank <= 0 ? '(save some gold first)' : ''}
          </button>
        </div>
      )}
    </Place>
  );
}

// ---------------------------------------------------------------- the inn

export function Inn({ state, act, ask, say, back, busy, today }: PlaceProps & { today: string }) {
  const song = BARD_SONGS[dayHash(today) % BARD_SONGS.length];
  const [typed, setTyped] = useState('');
  const [guessNote, setGuessNote] = useState('');
  const guess = state.guess;
  const tries = guess?.tries ?? [];
  const playing = !!guess && !guess.done;

  async function riddle() {
    const asked = await ask('riddle', { title: 'The riddle of the day', note: 'A right answer earns gold.', closeLabel: 'Not today' });
    if (!asked) return;
    const reply = await act({ action: 'inn', game: 'riddle', proof: asked.proof });
    if (!reply) return;
    const r = reply.result as { gold: number; right: boolean };
    say(r.right ? `Right! The innkeeper hands you ${r.gold} gold.` : `Not quite, but the innkeeper gives you ${r.gold} gold for trying.`);
  }

  async function start() {
    setGuessNote('');
    await act({ action: 'inn', game: 'guess-start' });
  }

  async function makeGuess() {
    const n = Number(typed);
    if (!Number.isInteger(n) || n < 1 || n > 100) return setGuessNote('Pick a whole number from 1 to 100.');
    setTyped('');
    const reply = await act({ action: 'inn', game: 'guess', n });
    if (!reply) return;
    const r = reply.result as { hint: 'low' | 'high' | 'win'; tries: number; over: boolean; prize: number; secret?: number };
    if (r.hint === 'win') setGuessNote(`Got it in ${r.tries}! You win ${r.prize} gold.`);
    else if (r.over) setGuessNote(`Out of guesses. It was ${r.secret}. Here is ${r.prize} gold for trying. Tip: guess the middle each time and you will always get it in 7.`);
    else setGuessNote(r.hint === 'low' ? `${n} is too low.` : `${n} is too high.`);
  }

  return (
    <Place title="The Inn" tile="potion" scene="inn" person="inn" back={back}>
      <blockquote className="lord-song"><Portrait who="bard" /><p>The bard sings:</p>{song.split(' / ').map((l) => <p key={l}>{l}</p>)}</blockquote>
      <div className="lord-actions">
        <button type="button" className="lord-btn lord-btn--hot" disabled={state.riddleDone || busy} onClick={() => void riddle()}>
          Riddle of the day {state.riddleDone && '(done today)'}
        </button>
      </div>
      <div className="lord-card">
        <h3>Number guess</h3>
        {guess?.done ? (
          <>
            <p className="lord-soft">You have played today. Come back tomorrow!</p>
            {guessNote && <p aria-live="polite">{guessNote}</p>}
          </>
        ) : (
          <>
            <p>I am thinking of a number from 1 to 100. You get {NUMBER_GUESS_TRIES} guesses. (Try the middle first!)</p>
            {!guess && (
              <button type="button" className="lord-btn" disabled={busy} onClick={() => void start()}>Play</button>
            )}
            {playing && (
              <form onSubmit={(e) => { e.preventDefault(); void makeGuess(); }} className="lord-guess">
                <label>
                  Guess {tries.length + 1} of {NUMBER_GUESS_TRIES}{' '}
                  <input type="number" inputMode="numeric" min={1} max={100} value={typed} onChange={(e) => setTyped(e.target.value)} />
                </label>
                <button type="submit" className="lord-btn" disabled={busy}>Guess</button>
              </form>
            )}
            {guessNote && <p aria-live="polite">{guessNote}</p>}
            {tries.length > 0 && <p className="lord-soft">Your guesses: {tries.map((t) => `${t.n} (${t.hint === 'win' ? 'got it' : t.hint === 'low' ? 'too low' : 'too high'})`).join(', ')}</p>}
          </>
        )}
      </div>
    </Place>
  );
}

// ---------------------------------------------------------------- training grounds

export function Training({ hero, back, onChallenge, onDragon }: Pick<PlaceProps, 'hero' | 'back'> & { onChallenge: () => void; onDragon: () => void }) {
  const master = masterFor(hero.level);
  const check = canChallengeMaster(hero);
  const need = expNeeded(hero.level);
  const prev = hero.level > 1 ? EXP_TO_CHALLENGE[hero.level - 2] : 0;
  const share = Number.isFinite(need) ? Math.max(0, Math.min(1, (hero.exp - prev) / (need - prev))) : 1;

  return (
    <Place title="The Training Grounds" tile="shield" scene="training" back={back}>
      {master ? (
        <div className="lord-master">
          <MonsterSprite monster={{ id: `master-${master.level}`, name: master.name, level: master.level }} scale={7} />
          <div>
            <h3>{master.name}</h3>
            <p>{master.intro}</p>
            <p className="lord-soft">Beat them to reach level {master.level}. You get stronger, and you are healed. Lose, and you only lose the try for today.</p>
            <div className="lord-bar" role="meter" aria-label="Experience towards your master" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
              <div className="lord-bar__fill" style={{ width: `${share * 100}%`, background: 'var(--lord-cyan)' }} />
              <span className="lord-bar__text">Experience: {hero.exp} / {need}</span>
            </div>
            <div className="lord-actions">
              <button type="button" className="lord-btn lord-btn--hot" disabled={!check.ok} onClick={onChallenge}>
                Challenge {master.name} (3 questions first)
              </button>
            </div>
            {!check.ok && <p className="lord-soft">{check.reason}</p>}
          </div>
        </div>
      ) : (
        <div className="lord-master">
          <p className="lord-lead">You have beaten every master. {canFaceDragon(hero) ? 'The Red Dragon waits in the forest.' : 'Earn a little more experience to face the dragon.'}</p>
          {canFaceDragon(hero) && (
            <button type="button" className="lord-btn lord-btn--hot" onClick={onDragon}>
              Face the Red Dragon
            </button>
          )}
        </div>
      )}
    </Place>
  );
}

// ---------------------------------------------------------------- hero page, news, class pick

export function HeroPage({ hero, stats, back, onLook }: { hero: Hero; stats?: Stats; back: () => void; onLook: () => void }) {
  const need = expNeeded(hero.level);
  return (
    <Place title="Your hero" scene="map" back={back}>
      <div className="lord-hero">
        <div className="lord-hero__look">
          <HeroSprite heroClass={hero.heroClass} look={hero.look} scale={8} />
          <button type="button" className="lord-btn" onClick={onLook}>{hero.look ? 'Change my look' : 'Choose my look'}</button>
        </div>
        <dl className="lord-stats">
          <div><dt>Class</dt><dd>{CLASSES[hero.heroClass].name}</dd></div>
          <div><dt>Level</dt><dd>{hero.level} / {MAX_LEVEL}</dd></div>
          <div><dt>Experience</dt><dd>{hero.exp}{Number.isFinite(need) ? ` (next master at ${need})` : ''}</dd></div>
          <div><dt>Health</dt><dd>{hero.hp} / {hero.maxHp}</dd></div>
          <div><dt>Attack</dt><dd>{heroAttack(hero)} ({hero.strength} + {WEAPONS[hero.weapon].power})</dd></div>
          <div><dt>Defence</dt><dd>{heroDefence(hero)} ({hero.defence} + {ARMOURS[hero.armour].power})</dd></div>
          <div><dt>Weapon</dt><dd><WeaponSprite index={hero.weapon} scale={2} /> {WEAPONS[hero.weapon].name}</dd></div>
          <div><dt>Armour</dt><dd><ArmourSprite index={hero.armour} scale={2} /> {ARMOURS[hero.armour].name}</dd></div>
          <div><dt>Gold</dt><dd>{hero.gold} carried, {hero.bank} banked</dd></div>
          <div><dt>Gems</dt><dd>{hero.gems}</dd></div>
          <div><dt>Kindness</dt><dd>{hero.kindness}</dd></div>
          <div><dt>Dragon stars</dt><dd>{hero.dragonKills > 0 ? '★'.repeat(Math.min(hero.dragonKills, 10)) : 'none yet'}</dd></div>
          <div><dt>Forest wins</dt><dd>{hero.forestWins}</dd></div>
          <div><dt>Masters beaten</dt><dd>{hero.masterWins}</dd></div>
        </dl>
      </div>
      <p className="lord-soft">{CLASSES[hero.heroClass].blurb}</p>
      {stats && (
        <>
          <h3>All your seasons</h3>
          <p className="lord-soft">
            {stats.forestWins} forest fights won, {stats.masterWins} masters beaten, {stats.arenaWins} arena fights won, {stats.riddles} riddles and puzzles solved, {stats.dragons} {stats.dragons === 1 ? 'dragon' : 'dragons'} beaten. Highest level: {stats.bestLevel}.
          </p>
        </>
      )}
    </Place>
  );
}

/** "knight-girl-05-2" → "Knight girl 5, painting 2", for screen readers. */
const lookName = (look: string) => {
  const [cls, kid, n, v] = look.split('-');
  return `${CLASSES[cls as HeroClass].name} ${kid} ${Number(n)}, painting ${v}`;
};

/** Every painted hero of one class, to pick the one you look like. The one you have now is marked. */
export function LookPick({ heroClass, current, onPick, busy }: { heroClass: HeroClass; current?: string; onPick: (look: string) => void; busy?: boolean }) {
  return (
    <div className="lord-looks" role="group" aria-label={`${CLASSES[heroClass].name} looks`}>
      {LOOKS[heroClass].map((look) => (
        <button
          key={look} type="button" className="lord-look" aria-pressed={look === current} aria-label={lookName(look)}
          disabled={busy} onClick={() => onPick(look)}
        >
          <img src={lookThumb(look)} alt="" loading="lazy" decoding="async" draggable={false} />
        </button>
      ))}
    </div>
  );
}

/** Changing your look, any time: from Your hero, or the village's nudge for heroes made before there were looks. */
export function LookPage({ hero, act, back, busy }: Pick<PlaceProps, 'hero' | 'act' | 'back' | 'busy'>) {
  return (
    <Place title="Choose your look" scene="village" back={back}>
      <p className="lord-lead">Pick the {CLASSES[hero.heroClass].name.toLowerCase()} you want to be. You can change it whenever you like. It changes how you look, nothing else.</p>
      <LookPick heroClass={hero.heroClass} current={hero.look} busy={busy} onPick={async (look) => (await act({ action: 'look', look })) && back()} />
    </Place>
  );
}

export function ClassPick({ onPick }: { onPick: (c: HeroClass, look: string) => void }) {
  const [chosen, setChosen] = useState<HeroClass | null>(null);
  if (chosen) {
    return (
      <section className="lord-place" aria-label="Choose your look">
        <Stage scene="village" size="short">
          <header className="lord-place__head">
            <h2 className="lord-sign">Choose your look</h2>
            <button type="button" className="lord-btn" onClick={() => setChosen(null)}>Pick a different class</button>
          </header>
        </Stage>
        <div className="lord-panel">
          <p className="lord-lead">Which {CLASSES[chosen].name.toLowerCase()} are you? You can change your look later, on Your hero.</p>
          <LookPick heroClass={chosen} onPick={(look) => onPick(chosen, look)} />
        </div>
      </section>
    );
  }
  return (
    <section className="lord-place" aria-label="Choose your class">
      <Stage scene="village" size="short">
        <header className="lord-place__head">
          <h2 className="lord-sign">Welcome, hero!</h2>
        </header>
      </Stage>
      <div className="lord-panel">
      <p className="lord-lead">
        The Red Dragon has stolen the village’s treasure, its food and its light. Someone has to get them back. Pick the kind of hero you want to be. You can change next season.
      </p>
      <div className="lord-classes">
        {(Object.keys(CLASSES) as HeroClass[]).map((c) => (
          <button key={c} type="button" className="lord-class" onClick={() => setChosen(c)}>
            <HeroSprite heroClass={c} scale={8} />
            <strong>{CLASSES[c].name}</strong>
            <span>{CLASSES[c].blurb}</span>
          </button>
        ))}
      </div>
      </div>
    </section>
  );
}
