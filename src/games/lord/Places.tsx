import { useState, type ReactNode } from 'react';
import {
  ARMOURS, CLASSES, EXP_TO_CHALLENGE, MAX_LEVEL, WEAPONS, expNeeded, friendly, masterFor, tierPower,
} from '../../../shared/lord/data';
import {
  buyGear, canChallengeMaster, canFaceDragon, deposit, heal, healCost, healPrice, heroAttack, heroDefence, kindnessDiscount, shopPrice, withdraw,
} from '../../../shared/lord/engine';
import { NUMBER_GUESS_TRIES, interestFor, numberGuessPrize, priceDiscount } from '../../../shared/lord/maths';
import type { Hero, HeroClass } from '../../../shared/lord/types';
import type { Asked, AskOptions } from './useAsk';
import { ArmourSprite, HeroSprite, Icon, MonsterSprite, WeaponSprite } from './Sprite';
import { ICON_TILES } from './tileMap';
import { BARD_SONGS, VILLAGE_NEWS, dayHash } from './text';
import type { MomentId } from '../../../shared/lord/maths';

export type Ask = (moment: MomentId, options: AskOptions) => Promise<Asked>;

export interface PlaceProps {
  hero: Hero;
  setHero: (hero: Hero) => void;
  ask: Ask;
  say: (note: string) => void;
  addNews: (line: string) => void;
  back: () => void;
  today: string;
}

const discountOf = (asked: Asked) => (asked === 'skipped' ? 0 : priceDiscount(asked));

function Place({ title, children, back, tile }: { title: string; children: ReactNode; back: () => void; tile?: keyof typeof ICON_TILES }) {
  return (
    <section className="lord-place" aria-label={title}>
      <header className="lord-place__head">
        <h2>
          {tile && <Icon name={tile} scale={3} />} {title}
        </h2>
        <button type="button" className="lord-btn" onClick={back}>
          <kbd>Esc</kbd> Back to the village
        </button>
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- the shop

export function Shop({ hero, setHero, ask, say, addNews, back }: PlaceProps) {
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
    const result = buyGear(hero, slot, index, discountOf(asked));
    if (!result.ok) return say(result.reason);
    setHero(result.hero);
    const saved = check.paid - result.paid;
    say(`You bought the ${table[index].name} for ${result.paid} gold${result.refund ? ` (and sold your old one for ${result.refund})` : ''}${saved > 0 ? `. You saved ${saved} gold!` : '.'}`);
    addNews(`You bought the ${table[index].name}.`);
  }

  return (
    <Place title="The Blacksmith and Armourer" tile="sword" back={back}>
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
                <button type="button" className="lord-btn" onClick={() => void buy(i)}>
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

export function Healer({ hero, setHero, ask, say, back }: PlaceProps) {
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
    const discount = discountOf(asked);
    const after = heal(hero, amount, discount);
    setHero(after);
    say(`The healer mends ${after.hp - hero.hp} health for ${hero.gold - after.gold} gold${discount ? ` (10% off!)` : ''}.`);
  }

  return (
    <Place title="The Healer’s Hut" tile="heart" back={back}>
      <p className="lord-lead">
        Health: <strong>{hero.hp} / {hero.maxHp}</strong>. Every point costs <strong>{price}</strong> gold. All your health comes back free tomorrow.
      </p>
      <div className="lord-actions">
        {[10, 25].map((n) => (
          <button key={n} type="button" className="lord-btn" disabled={missing <= 0} onClick={() => void pay(n)}>
            Heal {Math.min(n, missing) || n} <small>({healCost(hero, Math.min(n, Math.max(missing, 1)))} gold)</small>
          </button>
        ))}
        <button type="button" className="lord-btn lord-btn--hot" disabled={missing <= 0} onClick={() => void pay(missing)}>
          Heal everything <small>({healCost(hero, missing)} gold)</small>
        </button>
      </div>
      {hero.gold < healCost(hero, missing) && missing > 0 && <p className="lord-soft">You do not have enough for everything. The healer will heal as much as you can pay for.</p>}
    </Place>
  );
}

// ---------------------------------------------------------------- the bank

export function Bank({ hero, setHero, ask, say, back, today, interestDay, setInterestDay }: PlaceProps & { interestDay: string; setInterestDay: (d: string) => void }) {
  const canAskInterest = hero.level >= 4 && hero.bank > 0 && interestDay !== today;

  async function interest() {
    const asked = await ask('bank', { title: 'The banker’s question', note: 'Answer right for a little interest on your savings.', closeLabel: 'Not today' });
    if (asked === 'skipped') return;
    setInterestDay(today);
    const extra = interestFor(hero.bank, asked);
    setHero({ ...hero, bank: hero.bank + extra });
    say(extra > 0 ? `The banker adds ${extra} gold of interest. Well done!` : 'No interest today, but you can try again tomorrow.');
  }

  return (
    <Place title="The Bank" tile="coin" back={back}>
      <p className="lord-lead">Gold in the bank is safe. If you lose a fight, only the gold you are carrying is lost.</p>
      <p className="lord-big">
        <Icon name="gold" /> Carrying <strong>{hero.gold}</strong> · In the bank <strong>{hero.bank}</strong>
      </p>
      <div className="lord-actions">
        <button type="button" className="lord-btn lord-btn--hot" disabled={hero.gold <= 0} onClick={() => setHero(deposit(hero, hero.gold))}>Deposit all</button>
        <button type="button" className="lord-btn" disabled={hero.gold <= 1} onClick={() => setHero(deposit(hero, Math.floor(hero.gold / 2)))}>Deposit half</button>
        <button type="button" className="lord-btn" disabled={hero.bank <= 0} onClick={() => setHero(withdraw(hero, hero.bank))}>Withdraw all</button>
        <button type="button" className="lord-btn" disabled={hero.bank <= 1} onClick={() => setHero(withdraw(hero, Math.floor(hero.bank / 2)))}>Withdraw half</button>
      </div>
      {hero.level >= 4 && (
        <div className="lord-actions">
          <button type="button" className="lord-btn" disabled={!canAskInterest} onClick={() => void interest()}>
            Ask about interest {interestDay === today ? '(done today)' : hero.bank <= 0 ? '(save some gold first)' : ''}
          </button>
        </div>
      )}
    </Place>
  );
}

// ---------------------------------------------------------------- the inn

export function Inn({ hero, setHero, ask, say, back, today, riddleDay, setRiddleDay, guessDay, setGuessDay }: PlaceProps & {
  riddleDay: string; setRiddleDay: (d: string) => void; guessDay: string; setGuessDay: (d: string) => void;
}) {
  const song = BARD_SONGS[dayHash(today) % BARD_SONGS.length];
  const [secret] = useState(() => 1 + Math.floor(Math.random() * 100));
  const [guesses, setGuesses] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const [guessNote, setGuessNote] = useState('');
  const won = guesses.includes(secret);
  const playing = guessDay !== today && !won && guesses.length < NUMBER_GUESS_TRIES;

  async function riddle() {
    const asked = await ask('riddle', { title: 'The riddle of the day', note: 'A right answer earns gold.', closeLabel: 'Not today' });
    if (asked === 'skipped') return;
    setRiddleDay(today);
    const gold = asked === 'right' ? friendly(tierPower(hero.level) * 1.5) : friendly(tierPower(hero.level) * 0.3);
    setHero({ ...hero, gold: hero.gold + gold });
    say(asked === 'right' ? `Right! The innkeeper hands you ${gold} gold.` : `Not quite, but the innkeeper gives you ${gold} gold for trying.`);
  }

  function guess() {
    const n = Number(typed);
    if (!Number.isInteger(n) || n < 1 || n > 100) return setGuessNote('Pick a whole number from 1 to 100.');
    const next = [...guesses, n];
    setGuesses(next);
    setTyped('');
    if (n === secret || next.length >= NUMBER_GUESS_TRIES) {
      const win = n === secret;
      const gold = numberGuessPrize(hero.level, win);
      setGuessDay(today);
      setHero({ ...hero, gold: hero.gold + gold });
      setGuessNote(win ? `Got it in ${next.length}! You win ${gold} gold.` : `Out of guesses. It was ${secret}. Here is ${gold} gold for trying. Tip: guess the middle each time and you will always get it in 7.`);
    } else setGuessNote(n < secret ? `${n} is too low.` : `${n} is too high.`);
  }

  return (
    <Place title="The Inn" tile="potion" back={back}>
      <blockquote className="lord-song"><p>The bard sings:</p>{song.split(' / ').map((l) => <p key={l}>{l}</p>)}</blockquote>
      <div className="lord-actions">
        <button type="button" className="lord-btn lord-btn--hot" disabled={riddleDay === today} onClick={() => void riddle()}>
          Riddle of the day {riddleDay === today && '(done today)'}
        </button>
      </div>
      <div className="lord-card">
        <h3>Number guess</h3>
        {guessDay === today && guesses.length === 0 ? (
          <p className="lord-soft">You have played today. Come back tomorrow!</p>
        ) : (
          <>
            <p>I am thinking of a number from 1 to 100. You get {NUMBER_GUESS_TRIES} guesses. (Try the middle first!)</p>
            {playing && (
              <form onSubmit={(e) => { e.preventDefault(); guess(); }} className="lord-guess">
                <label>
                  Guess {guesses.length + 1} of {NUMBER_GUESS_TRIES}{' '}
                  <input type="number" inputMode="numeric" min={1} max={100} value={typed} onChange={(e) => setTyped(e.target.value)} />
                </label>
                <button type="submit" className="lord-btn">Guess</button>
              </form>
            )}
            {guessNote && <p aria-live="polite">{guessNote}</p>}
            {guesses.length > 0 && <p className="lord-soft">Your guesses: {guesses.join(', ')}</p>}
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
    <Place title="The Training Grounds" tile="shield" back={back}>
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

export function HeroPage({ hero, back }: { hero: Hero; back: () => void }) {
  const need = expNeeded(hero.level);
  return (
    <Place title="Your hero" back={back}>
      <div className="lord-hero">
        <HeroSprite heroClass={hero.heroClass} scale={8} />
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
    </Place>
  );
}

export function NewsPage({ news, back, today }: { news: string[]; back: () => void; today: string }) {
  return (
    <Place title="The Daily News" tile="scroll" back={back}>
      <p className="lord-lead">{VILLAGE_NEWS[dayHash(today) % VILLAGE_NEWS.length]}</p>
      <h3>Your deeds</h3>
      {news.length === 0 ? <p className="lord-soft">Nothing yet. Go and do something newsworthy!</p> : <ul className="lord-news">{news.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      <p className="lord-soft">Other heroes and the warriors list arrive in a later stage.</p>
    </Place>
  );
}

export function ClassPick({ onPick }: { onPick: (c: HeroClass) => void }) {
  return (
    <section className="lord-place" aria-label="Choose your class">
      <h2>Welcome, hero!</h2>
      <p className="lord-lead">
        The Red Dragon has stolen the village’s treasure, its food and its light. Someone has to get them back. Pick the kind of hero you want to be. You can change next season.
      </p>
      <div className="lord-classes">
        {(Object.keys(CLASSES) as HeroClass[]).map((c) => (
          <button key={c} type="button" className="lord-class" onClick={() => onPick(c)}>
            <HeroSprite heroClass={c} scale={8} />
            <strong>{CLASSES[c].name}</strong>
            <span>{CLASSES[c].blurb}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
