/**
 * The season monster (docs/CLANS-SEASON-GOALS-PLAN.md section 5): the screen for monster week, the calm heads-up before it, and
 * the words after a try. Display only. The rules (siege, fight, tired monster, supplies) are in shared/clans/monster.ts and the
 * server does them; this shows them in gentle words. Without a server (the test page) it is Practice.
 */
import { useState } from 'react';
import type { MonsterOutcome, ShownFight } from '../../../shared/clans/actions';
import { monsterSeed } from '../../../shared/clans/actions';
import { nzDayNumber } from '../../../shared/clans/clock';
import { CONFIG } from '../../../shared/clans/config';
import { BUILDING_NAMES, empireOf } from '../../../shared/clans/empire';
import { MONSTER_LOOKS, SUPPLY_KINDS, SUPPLY_NAMES, monsterOf, monsterSave, siegeQuestion, siegeShare, tiredShare, type Siege } from '../../../shared/clans/monster';
import type { SeasonClock } from '../../../shared/clans/season';
import type { PracticalQuestion } from '../../../shared/maths/practical';
import { PracticalAsk } from '../../maths/PracticalAsk';
import { MonsterArt } from './MonsterArt';
import type { Session } from './session';

const pct = (share: number) => Math.round(share * 100);
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** What a monster try's start gave back (the server's answer, or the practice sums on the test page). */
export type MonsterTry =
  | { ok: true; resumed: boolean; right: boolean | null; answer: number | null; siege: Siege | null; open: ShownFight }
  | { ok: false; say: string };

/** The calm heads-up on the clan page in the weeks before the monster comes: its name, how long, and a sign. */
export function MonsterWarning({ clock }: { clock: SeasonClock }) {
  const look = MONSTER_LOOKS[monsterOf(clock.number)];
  const S = CONFIG.season;
  const left = Math.max(1, S.monsterFrom - clock.day);
  const sign = look.signs[Math.max(0, clock.day - S.warnFrom) % look.signs.length];
  return (
    <div className="cq-panel cq-monster-warning" role="group" aria-label="The monster is coming">
      <p><strong>{look.name} arrives in {days(left)}.</strong></p>
      <p className="cq-soft">{sign}</p>
      <p className="cq-soft">Build your village and your army, and look in the Market for monster supplies.</p>
    </div>
  );
}

/** The village's helpers for the siege and the fight, in words. */
function Helpers({ session }: { session: Session }) {
  const levels = empireOf(session.clan).levels;
  const line = (b: keyof typeof levels) => `${BUILDING_NAMES[b]} ${levels[b]}`;
  return (
    <ul className="cq-monster-helpers" aria-label="Which buildings help">
      <li><strong>In the siege:</strong> your army (the Barracks keep the troops) hits it, the Forge makes the troops hit harder, the Tower and any fire arrows fire at it. ({line('barracks')}, {line('forge')}, {line('tower')})</li>
      <li><strong>Walls</strong> cut every hit the monster does. ({line('walls')})</li>
      <li><strong>In the fight:</strong> the Training Hall, the Smithy and the Church help your members. ({line('trainingHall')}, {line('smithy')}, {line('church')})</li>
    </ul>
  );
}

type Phase = { t: 'info' } | { t: 'ask'; question: PracticalQuestion } | { t: 'working' } | { t: 'siege'; go: Extract<MonsterTry, { ok: true }>; at: number; skipped: boolean };

/**
 * The Monster screen. `onTry` starts today's try (it sends monsterStart with the siege answer and gives back how it went);
 * `onFight` carries on into the clan fight. `practice`: no server, so nothing here counts.
 */
export function MonsterWeek({ session, practice, onTry, onFight, onBack }: {
  session: Session; practice: boolean; onTry: (answer: number | null) => Promise<MonsterTry>; onFight: (open: ShownFight) => void; onBack: () => void;
}) {
  const { clan } = session;
  const season = session.clock && session.clock.number > 0 ? session.clock.number : (session.season ?? 1);
  const look = MONSTER_LOOKS[monsterOf(season)];
  const save = monsterSave(clan, season);
  const [phase, setPhase] = useState<Phase>({ t: 'info' });
  const [say, setSay] = useState('');
  const won = save.wonDay !== undefined;
  const tired = pct(tiredShare(won ? 0 : save.losses));
  // One try a day: the server decides, but a pupil who has had today's try is told before the question, not after.
  const triedToday = !practice && save.tries > 0 && save.lastDay === nzDayNumber(Date.now());
  const awake = clan.members.some((m) => !m.knockedOut);
  const arrows = save.supplies.arrows;
  const estimate = pct(siegeShare(clan, arrows, false));
  const estimateRight = pct(siegeShare(clan, arrows, true));

  const begin = async (answer: number | null) => {
    setPhase({ t: 'working' });
    setSay('');
    const out = await onTry(answer).catch((): MonsterTry => ({ ok: false, say: "We couldn't reach the server, so the try didn't start. Please try again." }));
    if (!out.ok) {
      setSay(out.say);
      return setPhase({ t: 'info' });
    }
    // Back after a refresh: the siege was shown already, so go straight to the fight.
    if (out.resumed || !out.siege) return onFight(out.open);
    setPhase({ t: 'siege', go: out, at: 0, skipped: answer === null });
  };
  const fight = () => {
    const question = siegeQuestion(monsterSeed(session.baseSeed, season, save.tries), session.settings);
    if (question) setPhase({ t: 'ask', question });
    else void begin(null);
  };

  if (phase.t === 'ask') {
    return (
      <section className="cq-monster" aria-label="The siege question">
        <PracticalAsk question={phase.question} title="The siege!" note={`${look.short} attacks the village. A right answer makes your village hit ${pct(CONFIG.monster.siege.rightAnswer - 1)}% harder. No timer, nothing lost.`} onSubmit={(n) => void begin(n)} onNoThanks={() => void begin(null)} />
      </section>
    );
  }
  if (phase.t === 'working') {
    return <section className="cq-monster" aria-label="The siege"><p role="status">{look.short} is at the gates…</p></section>;
  }
  if (phase.t === 'siege') return <SiegeScene name={look.short} kind={monsterOf(season)} go={phase.go} at={phase.at} skipped={phase.skipped} onNext={() => setPhase({ ...phase, at: phase.at + 1 })} onFight={() => onFight(phase.go.open)} />;

  return (
    <section className="cq-monster" aria-label="The Monster">
      <div className="cq-place__head">
        <h2>The Monster</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      {practice && <p className="cq-note" role="note"><strong>Practice.</strong> Nothing here counts: no fame, no trophy, no Hall. Teachers can try the monster any time.</p>}
      <div className="cq-monster-top">
        <MonsterArt kind={monsterOf(season)} />
        <div>
          <h3>{look.name}</h3>
          <p>{look.blurb}</p>
          <p className="cq-soft">{look.bigHelp}</p>
        </div>
      </div>
      <ul className="cq-monster-facts" aria-label="Your clan and the monster">
        <li>Tries this season: <strong>{save.tries}</strong></li>
        <li>{won ? `You beat ${look.short}! You keep ${look.trophy}.` : `You have not beaten ${look.short} yet.`}</li>
        {!won && tired > 0 && <li>{look.short} is tired from your tries: <strong>{tired}% weaker</strong> for your clan.</li>}
        <li>
          Your supplies: {SUPPLY_KINDS.map((k) => `${save.supplies[k]} ${save.supplies[k] === 1 ? SUPPLY_NAMES[k].one : SUPPLY_NAMES[k].many}`).join(', ')}.
          {' '}<span className="cq-soft">Buy more in the Market.</span>
        </li>
      </ul>
      <div className="cq-panel" role="group" aria-label="What your village will do">
        <h3>What your village will do</h3>
        <p>In the siege, your village should knock about <strong>{estimate}%</strong> off {look.short}'s strength before your clan even arrives{estimateRight > estimate ? ` (about ${estimateRight}% with a right answer)` : ''}.</p>
        <Helpers session={session} />
      </div>
      {say && <p className="cq-note" role="alert">{say}</p>}
      {triedToday && <p className="cq-note" role="status">You have had your try today. Come back tomorrow!</p>}
      {!awake && <p className="cq-note" role="status">Everyone is resting. They wake up tomorrow.</p>}
      <div className="cq-actions">
        <button type="button" className="cq-btn cq-btn--hot" disabled={triedToday || !awake} onClick={fight}>Fight!</button>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
    </section>
  );
}

/**
 * The siege, one round at a time (tap for the next). The "village under attack" scene is a plain panel for now: the painting
 * (docs/CLANS-ART-PLAN.md) takes its place later.
 */
function SiegeScene({ name, kind, go, at, skipped, onNext, onFight }: { name: string; kind: Parameters<typeof MonsterArt>[0]['kind']; go: Extract<MonsterTry, { ok: true }>; at: number; skipped: boolean; onNext: () => void; onFight: () => void }) {
  const siege = go.siege!;
  const shown = siege.rounds.slice(0, at + 1);
  const total = pct(siege.rounds.slice(0, at + 1).reduce((t, r) => t + r.army + r.tower, 0));
  const last = at >= siege.rounds.length - 1;
  const army = (x: number) => (pct(x) >= 1 ? `Your army knocks off ${pct(x)}% of ${name}'s strength` : 'Your army is too small to make a dent yet');
  const tower = (x: number) => (pct(x) >= 1 ? `your tower knocks off ${pct(x)}% more` : 'your tower is too small to reach');
  return (
    <section className="cq-monster" aria-label="The siege">
      <h2>The siege!</h2>
      <div className="cq-siege-scene" role="img" aria-label="The village under attack">
        <span aria-hidden="true">🏘️🔥</span>
        <span aria-hidden="true">{MONSTER_LOOKS[kind].emoji}</span>
        <span aria-hidden="true">🏹⚔️</span>
      </div>
      <ol className="cq-siege-rounds" aria-live="polite" aria-label="The siege, round by round">
        {shown.map((r, i) => (
          <li key={i}>
            <strong>Round {i + 1}.</strong> {army(r.army)}; {tower(r.tower)}.
          </li>
        ))}
      </ol>
      <p>{name} has lost <strong>{total}%</strong> of its strength so far.</p>
      {last && (
        <>
          {go.right === true && <p className="cq-note" role="status">Your answer was right, so the village hit {pct(CONFIG.monster.siege.rightAnswer - 1)}% harder!</p>}
          {go.right === false && !skipped && <p role="status">Not quite{go.answer !== null ? `: the answer was ${go.answer}` : ''}. No harm done.</p>}
          {skipped && go.answer !== null && <p className="cq-soft" role="status">You skipped the question, and that is fine.</p>}
          <p>The siege took <strong>{total}%</strong> off {name}. Now your clan meets it!</p>
        </>
      )}
      <div className="cq-actions">
        {last ? <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onFight}>Into the fight!</button> : <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onNext}>Next round</button>}
      </div>
    </section>
  );
}

/** What the monster did to the results screen: won (and what the clan keeps), or it stomped off (and how tired it will be). */
export function MonsterResult({ outcome, session }: { outcome: MonsterOutcome; session: Session }) {
  const look = MONSTER_LOOKS[outcome.kind];
  const save = monsterSave(session.clan, outcome.season);
  const weaker = pct(tiredShare(save.losses));
  const practice = !session.clock;
  if (outcome.won) {
    return (
      <div className="cq-panel cq-monster-result" role="status">
        <p><strong>{look.beaten}</strong></p>
        {outcome.first
          ? <p>You keep {look.trophy}{practice ? '.' : <>, and the clan earns <strong>+{CONFIG.monster.reward.fame} fame</strong>!</>}</p>
          : <p className="cq-soft">You had beaten {look.short} already, so this one was just for fun.</p>}
      </div>
    );
  }
  return (
    <div className="cq-panel cq-monster-result" role="status">
      <p><strong>{look.stompsOff}</strong></p>
      {save.wonDay === undefined && weaker > 0 && <p>It will be <strong>{weaker}% weaker</strong> tomorrow.</p>}
    </div>
  );
}
