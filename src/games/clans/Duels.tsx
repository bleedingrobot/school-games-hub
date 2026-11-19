/**
 * Live Clan Duels (docs/CLANS-PVP-PLAN.md stage 2): the Duel Arena (classmates' clans here, practice clans, how it works on
 * three painted cards), the challenge that pops up on any screen, waiting for a yes, and the duel itself on the tournament
 * field painting. The server plays every round of a live duel (shared/clans/duelServer.ts); a practice duel is played here
 * with the very same rules and pays nothing. No chat: three cheers at the end. Clans are shown by name, never a pupil.
 *
 * Each new round plays out in two beats: both orders' painted cards slam in from the sides and clash (the winner glows,
 * the loser cracks), then both clans swing and the hits pop. James, 17 Nov 2026: flashy and immersive.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DUEL_MOVES, DUEL_MOVE_INFO, DUEL_ROUNDS, computerDuelPick, duelLine, replayDuel, villageOf,
  type DuelMove, type DuelPick, type DuelSide, type DuelVillage,
} from '../../../shared/clans/duel';
import { duelOpen, type DuelClan, type DuelRow } from '../../../shared/clans/duelServer';
import { BUILDING_NAMES, empireOf } from '../../../shared/clans/empire';
import { LOOKS, isLook, lookOf } from '../../../shared/clans/looks';
import { ClassTag, SchoolPlayerList } from '../../components/SchoolPlayerList';
import type { DuelCheer } from '../../data/clanDuel';
import { bannerArt, duelArt, sceneArt } from './art';
import { LadderAsk, type Asker } from './LadderAsk';
import { BannerRain, Embers } from './RaidStage';
import { Portrait } from './Sprite';
import type { Session } from './session';
import type { Duels } from './useDuels';

export const DUEL_CHEERS: { id: DuelCheer; label: string }[] = [
  { id: 'good-fight', label: '👏 Good fight!' },
  { id: 'well-played', label: '⭐ Well played!' },
  { id: 'again', label: '⚔️ Again sometime?' },
];
const cheerWords = (c: string | null | undefined) => DUEL_CHEERS.find((x) => x.id === c)?.label ?? null;

const CARDS_MS = 1200;
const HITS_MS = 1500;

/** Computer clans for practice duels: a gentle one, a fair one and a tough one. */
const PRACTICE: { name: string; light: string; clan: DuelClan }[] = [
  { name: 'Sleepy Badgers', light: 'Gentle', clan: { heroes: [{ race: 'Halfling', cls: 'Healer' }, { race: 'Human', cls: 'Pirate' }, { race: 'Imp', cls: 'Warrior' }, { race: 'Elf', cls: 'Wizard' }], village: villageOf({}) } },
  { name: 'Stone Bears', light: 'Fair', clan: { heroes: [{ race: 'Dwarf', cls: 'Knight' }, { race: 'Human', cls: 'Healer' }, { race: 'Half-Elf', cls: 'Sorcerer' }, { race: 'Orc', cls: 'Barbarian' }], village: villageOf({ forge: 2, walls: 2, barracks: 2, tower: 1, church: 1 }) } },
  { name: 'Storm Dragons', light: 'Tough', clan: { heroes: [{ race: 'Minotaur', cls: 'Warrior' }, { race: 'Muya', cls: 'Necromancer' }, { race: 'Orc', cls: 'Samurai' }, { race: 'Dwarf', cls: 'Knight' }], village: villageOf({ forge: 5, walls: 4, barracks: 5, tower: 4, church: 3 }) } },
];

/** Seconds until a deadline by the server's clock, ticking. */
function useSecondsTo(deadline: string | null, serverNow: () => number): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((Date.parse(deadline) - serverNow()) / 1000));
}

const myDuelClan = (session: Session): DuelClan => ({
  heroes: session.clan.members.map((m) => ({ race: m.race, cls: m.cls, look: lookOf(m) })),
  village: villageOf(empireOf(session.clan).levels),
});

/** What each village level does in a duel, as short lines (only the ones this clan has). */
function bonusLines(v: DuelVillage): string[] {
  const lines: string[] = [];
  if (v.forge) lines.push(`${BUILDING_NAMES.forge} ${v.forge}: hits ${v.forge * 4}% harder`);
  if (v.walls) lines.push(`${BUILDING_NAMES.walls} ${v.walls}: takes ${v.walls * 4}% less`);
  if (v.barracks) lines.push(`${BUILDING_NAMES.barracks} ${v.barracks}: +${v.barracks * 2} strength`);
  if (v.tower) lines.push(`${BUILDING_NAMES.tower} ${v.tower}: fires ${v.tower * 2} first`);
  if (v.church) lines.push(`${BUILDING_NAMES.church} ${v.church}: heals ${v.church * 3} once`);
  return lines;
}

/** The circle, on three painted cards. */
export function DuelCards({ onPick, disabled = false, compact = false }: { onPick?: (m: DuelMove) => void; disabled?: boolean; compact?: boolean }) {
  return (
    <div className={`cq-dcards${compact ? ' is-compact' : ''}${onPick ? ' is-pick' : ''}`} role={onPick ? 'group' : undefined} aria-label={onPick ? 'Pick your order' : 'What beats what'}>
      {DUEL_MOVES.map((m, i) => {
        const info = DUEL_MOVE_INFO[m];
        const art = duelArt(m).small;
        const body = (
          <>
            <span className="cq-dcard__pic" style={art ? ({ '--cq-dcard': `url(${art})` } as CSSProperties) : undefined} aria-hidden="true"><b>{info.icon}</b></span>
            <span className="cq-dcard__name">{info.name}</span>
            <small className="cq-dcard__beats">{info.verb} {DUEL_MOVE_INFO[info.beats].name}</small>
          </>
        );
        return onPick ? (
          <button key={m} type="button" className={`cq-dcard cq-dcard--${m}`} disabled={disabled} autoFocus={i === 0} onClick={() => onPick(m)}>{body}</button>
        ) : (
          <div key={m} className={`cq-dcard cq-dcard--${m}`}>{body}</div>
        );
      })}
    </div>
  );
}

export interface DuelEnding {
  title: string;
  line?: string;
  won?: boolean;
}

/** The duel itself, on the tournament field: fills the screen. Used for live and practice duels alike. */
export function DuelStage({ myName, theirName, clans, seat, rounds, waiting, onPick, prize, note, ending, buttons, onLeave, secondsLeft, tries = 0, theirCheer, problem, computer }: {
  myName: string;
  theirName: string;
  clans: [DuelClan, DuelClan];
  seat: DuelSide;
  rounds: [DuelPick, DuelPick][];
  /** This pupil has picked for the next round and is waiting for the other side. */
  waiting: boolean;
  onPick: (move: DuelMove) => void;
  prize?: { gold: number; banners: number };
  note?: string;
  ending?: DuelEnding | null;
  buttons: ReactNode;
  onLeave: () => void;
  secondsLeft?: number | null;
  tries?: number;
  theirCheer?: string | null;
  problem?: string | null;
  computer?: boolean;
}) {
  const other: DuelSide = seat === 0 ? 1 : 0;
  const villages = useMemo((): [DuelVillage, DuelVillage] => [clans[0].village, clans[1].village], [clans]);
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(still ? rounds.length : 0);
  const [beat, setBeat] = useState<'cards' | 'hits' | null>(null);
  const [picked, setPicked] = useState<DuelMove | null>(null);
  const [opening, setOpening] = useState(!still && rounds.length === 0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!opening) return;
    const t = window.setTimeout(() => setOpening(false), 2200);
    return () => window.clearTimeout(t);
  }, [opening]);

  useEffect(() => {
    if (shown >= rounds.length) return;
    if (still) { setShown(rounds.length); setBeat(null); return; }
    setBeat('cards');
    timers.current = [
      window.setTimeout(() => setBeat('hits'), CARDS_MS),
      window.setTimeout(() => { setBeat(null); setShown((n) => n + 1); }, CARDS_MS + HITS_MS),
    ];
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, [rounds.length, shown, still]);

  useEffect(() => setPicked(null), [rounds.length, tries]);

  const revealing = beat !== null ? rounds[shown] : null;
  const state = useMemo(() => replayDuel(rounds.slice(0, shown + (beat === 'hits' ? 1 : 0)), villages), [rounds, shown, beat, villages]);
  const whole = useMemo(() => replayDuel(rounds, villages), [rounds, villages]);
  const done = !!ending || (whole.over && shown >= rounds.length);
  const won = ending ? !!ending.won : whole.winner === seat;
  const draw = !ending && whole.over && whole.winner === null;
  const round = beat ? shown + 1 : rounds.length + 1;
  const last = beat === 'hits' ? state.rounds[state.rounds.length - 1] : null;
  const clashWin = revealing ? (revealing[seat].move === revealing[other].move ? 'tie' : replayDuel([revealing], villages).rounds[0].clash === seat ? 'me' : 'them') : null;

  function pick(move: DuelMove) {
    if (waiting || picked || beat || done) return;
    setPicked(move);
    onPick(move);
  }

  const title = ending?.title ?? (draw ? 'A draw!' : won ? 'Victory!' : 'Not this time');
  const line = ending?.line ?? (draw ? 'Neither clan could win it. Well fought!' : won ? `Your clan beat the ${theirName}!` : `The ${theirName} won this one. Well fought!`);
  const said = revealing && beat === 'hits' && last
    ? `${duelLine(revealing[seat].move, revealing[other].move)} You hit for ${last.hits[seat]}, the ${theirName} hit for ${last.hits[other]}.`
    : done ? `${title} ${line}` : waiting || picked ? `Waiting for the ${theirName}.` : `Round ${round}. Pick your order.`;
  const field = sceneArt('duel-field').wide;
  const bar = (side: DuelSide) => (
    <span className="cq-dbar" role="img" aria-label={`${state.hp[side]} of ${state.max[side]} strength`}>
      <span className="cq-dbar__fill" style={{ width: `${Math.round((100 * state.hp[side]) / state.max[side])}%` }} />
      <span className="cq-dbar__num">{state.hp[side]}</span>
    </span>
  );
  const team = (side: DuelSide, mine: boolean) => (
    <ul className={`cq-dteam cq-dteam--${mine ? 'me' : 'them'}${last && last.hits[mine ? other : seat] > 0 ? ' is-hit' : ''}${done && (mine ? !won && !draw : won) ? ' is-down' : ''}`} aria-hidden="true">
      {clans[side].heroes.slice(0, 4).map((h, i) => (
        <li key={i} style={{ '--i': i } as CSSProperties}><Portrait race={h.race} cls={h.cls} look={isLook(h.look) ? h.look : LOOKS[i % LOOKS.length]} scale={7} /></li>
      ))}
    </ul>
  );
  const card = (move: DuelMove | null, side: 'me' | 'them') => {
    const art = move ? duelArt(move).small : undefined;
    const result = clashWin === 'tie' ? 'tie' : clashWin === side ? 'win' : 'lose';
    return (
      <div key={`${side}${shown}`} className={`cq-dclash__card cq-dclash__card--${side} is-${result}`} aria-hidden="true">
        <span className="cq-dclash__art" style={art ? ({ '--cq-dcard': `url(${art})` } as CSSProperties) : undefined}>{move ? <b>{DUEL_MOVE_INFO[move].icon}</b> : <b>💤</b>}</span>
        <span className="cq-dclash__name">{move ? DUEL_MOVE_INFO[move].name : 'No order'}</span>
      </div>
    );
  };

  return (
    <section className={`cq-duel${done ? ` is-over is-${won ? 'won' : draw ? 'draw' : 'lost'}` : ''}${beat === 'hits' ? ' is-impact' : ''}`} role="dialog" aria-modal="true" aria-label={`Duel: your clan against the ${theirName}`}
      style={field ? ({ '--cq-duel-back': `url(${field})` } as CSSProperties) : undefined}>
      <Embers />
      <div className="cq-duel__hud">
        <div className="cq-duel__side cq-duel__side--me">
          {bannerArt(myName) && <img className="cq-duel__banner" src={bannerArt(myName)} alt="" />}
          <div><h2 className="cq-duel__name">{myName}</h2>{bar(seat)}</div>
        </div>
        <div className="cq-duel__round" aria-hidden="true">
          {!done && (round <= DUEL_ROUNDS ? `Round ${round} of ${DUEL_ROUNDS}` : 'Extra round!')}
          {!done && secondsLeft != null && !waiting && !picked && !beat && <small className={secondsLeft <= 10 ? 'is-low' : undefined}>{secondsLeft}s</small>}
        </div>
        <div className="cq-duel__side cq-duel__side--them">
          <div><h3 className="cq-duel__name">{theirName}{computer ? ' (practice)' : ''}</h3>{bar(other)}</div>
          {bannerArt(theirName) && <img className="cq-duel__banner" src={bannerArt(theirName)} alt="" />}
        </div>
      </div>

      {opening && (state.opening[0] > 0 || state.opening[1] > 0) && (
        <p className="cq-duel__opening" role="status">🏹 The Towers fire first! {state.opening[seat] > 0 ? `Yours hits for ${state.opening[seat]}. ` : ''}{state.opening[other] > 0 ? `Theirs hits for ${state.opening[other]}.` : ''}</p>
      )}

      <div className="cq-duel__middle">
        {revealing && (
          <div className="cq-dclash">
            {card(revealing[seat].move, 'me')}
            <span className="cq-dclash__flash" aria-hidden="true" />
            {card(revealing[other].move, 'them')}
            <p className={`cq-dclash__line is-${clashWin}`} aria-hidden="true">{duelLine(revealing[seat].move, revealing[other].move)}</p>
          </div>
        )}
        {last && (
          <>
            <span className="cq-dfloat cq-dfloat--them" aria-hidden="true">−{last.hits[seat]}</span>
            <span className="cq-dfloat cq-dfloat--me" aria-hidden="true">−{last.hits[other]}</span>
            {last.heals[seat] > 0 && <span className="cq-dfloat cq-dfloat--heal cq-dfloat--me" aria-hidden="true">⛪ +{last.heals[seat]}</span>}
            {last.heals[other] > 0 && <span className="cq-dfloat cq-dfloat--heal cq-dfloat--them" aria-hidden="true">⛪ +{last.heals[other]}</span>}
          </>
        )}
        {!revealing && !done && (waiting || picked) && <p className="cq-duel__think" aria-hidden="true">{picked ? `${DUEL_MOVE_INFO[picked].icon} Your ${DUEL_MOVE_INFO[picked].name} is ready…` : 'Your order is ready…'}</p>}
        {done && (
          <div className="cq-duel__end">
            {won && <BannerRain clan={myName} count={prize?.banners ?? 3} />}
            <p className="cq-duel__title">{title}</p>
            {line && <p className="cq-duel__line">{line}</p>}
            {prize && (prize.gold > 0 || prize.banners > 0) && (
              <p className="cq-duel__prize">
                {prize.gold > 0 && <span className="cq-vchip cq-vchip--gold">+{prize.gold} gold</span>}
                {prize.banners > 0 && <span className="cq-vchip cq-vchip--banners">+{prize.banners} {prize.banners === 1 ? 'Banner' : 'Banners'}</span>}
              </p>
            )}
            {note && <p className="cq-duel__line cq-soft">{note}</p>}
            {theirCheer && <p className="cq-duel__cheer">The {theirName}: “{theirCheer}”</p>}
          </div>
        )}
      </div>

      <div className="cq-duel__floor">
        {team(seat, true)}
        {team(other, false)}
      </div>

      {problem && !done && <p className="cq-duel__problem" role="alert">{problem}</p>}
      <p className="sr-only" aria-live="polite">{said}</p>

      <div className="cq-duel__bar" role="group" aria-label={done ? 'Next' : 'Pick your order'}>
        {done ? buttons : waiting || picked || beat ? (
          <>
            <p className="cq-duel__wait" role="status">{beat ? '' : `Waiting for the ${theirName}…`}</p>
            {!beat && <button type="button" className="cq-btn" onClick={onLeave}>Give up</button>}
          </>
        ) : (
          <>
            <DuelCards onPick={pick} />
            <button type="button" className="cq-btn cq-duel__leave" onClick={onLeave}>Give up</button>
          </>
        )}
      </div>
    </section>
  );
}

/** Another clan's challenge, over whatever screen is showing. */
export function DuelAskBanner({ duels, onYes }: { duels: Duels; onYes: (duel: number) => void }) {
  const first = duels.asks[0];
  const left = useSecondsTo(first?.deadline ?? null, duels.serverNow);
  if (!first || left === 0) return null;
  return (
    <div className="cq-dask" role="alertdialog" aria-label={`The ${first.from} clan challenges you`}>
      {bannerArt(first.from) && <img className="cq-dask__banner" src={bannerArt(first.from)} alt="" />}
      <p>⚔️ The <strong>{first.from}</strong> clan challenges you to a duel!<small>Charge, Volley or Shield Wall. {left}s to answer.</small></p>
      <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => onYes(first.duel)}>Duel!</button>
      <button type="button" className="cq-btn" onClick={() => {
        duels.forget(first.duel);
        void duels.send({ action: 'duel-answer', duel: first.duel, accept: false });
      }}>Not now</button>
    </div>
  );
}

function endingOf(d: DuelRow, seat: DuelSide, them: string): DuelEnding | null {
  const other = seat === 0 ? 1 : 0;
  switch (d.ending) {
    case 'left':
      return d.leaver === seat ? { title: 'You gave up', line: `The ${them} win this one. Nothing is lost.` } : { title: 'Victory!', line: `The ${them} gave up. No prizes this time.`, won: true };
    case 'timeouts':
      if (d.leaver === seat) return { title: 'Time ran out', line: 'You missed two rounds, so the duel ended. Nothing is lost.' };
      if (d.leaver === other) return { title: 'Victory!', line: `The ${them} stopped playing. No prizes this time.`, won: true };
      return { title: 'Duel over', line: 'Nobody gave an order for two rounds.' };
    case 'switched-off':
      return { title: 'Duel stopped', line: 'Your teacher has switched live duels off for now.' };
    case 'idle':
      return { title: 'Duel over', line: 'Nobody played for a while.' };
    default:
      return null;
  }
}

/** A live duel with another clan. The order is sent after the round's maths question (the server marks it). */
function LiveDuel({ duel: d, duels, ask, onBack }: { duel: DuelRow; duels: Duels; ask?: Asker; onBack: () => void }) {
  const seat: DuelSide = d.seat_a === duels.me ? 0 : 1;
  const other: DuelSide = seat === 0 ? 1 : 0;
  const myName = seat === 0 ? d.name_a : d.name_b;
  const themName = seat === 0 ? d.name_b : d.name_a;
  const round = d.rounds.length;
  const [sentFor, setSentFor] = useState<number | null>(null);
  const [asking, setAsking] = useState<DuelMove | null>(null);
  const [tries, setTries] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const left = useSecondsTo(d.status === 'playing' ? d.deadline : null, duels.serverNow);
  const ended = d.status !== 'playing';

  const send = async (move: DuelMove) => {
    setAsking(null);
    setSentFor(round);
    const r = await duels.send({ action: 'duel-pick', duel: d.id, round, move });
    if (!r.ok && r.code !== 'round' && r.code !== 'over') {
      setSentFor(null);
      setTries((n) => n + 1);
      setProblem(r.message);
    }
  };
  const onPick = (move: DuelMove) => {
    setProblem(null);
    if (ask) setAsking(move);
    else void send(move);
  };

  const myCheer = d.cheers[seat];
  const paidNothing = d.ending === 'finished' && d.gold[seat] === 0;
  return (
    <>
      <DuelStage
        key={d.id}
        myName={myName} theirName={themName} clans={d.clans} seat={seat} rounds={d.rounds}
        waiting={!ended && (sentFor === round || asking !== null)} onPick={onPick}
        prize={{ gold: d.gold[seat], banners: d.banners[seat] }}
        note={paidNothing ? 'No prizes this time: you’ve had your prize duels for today.' : undefined}
        ending={ended ? endingOf(d, seat, themName) : null}
        secondsLeft={left} tries={tries} problem={problem} theirCheer={cheerWords(d.cheers[other])}
        onLeave={() => void duels.send({ action: 'duel-leave', duel: d.id })}
        buttons={<>
          {myCheer ? <p className="cq-duel__said">You said: {cheerWords(myCheer)}</p> : (
            <div className="cq-duel__cheers" role="group" aria-label="Cheer">
              {DUEL_CHEERS.map((x) => <button key={x.id} type="button" className="cq-btn" onClick={() => void duels.cheer(x.id)}>{x.label}</button>)}
            </div>
          )}
          <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => { duels.forget(d.id); onBack(); }}>Back to the Duel Arena</button>
        </>}
      />
      {asking && ask && (
        <div className="cq-duel__ask">
          <LadderAsk kind="duel" ask={ask} title={`Power up your ${DUEL_MOVE_INFO[asking].name}!`} note="A right answer is a full hit. A wrong one is only a graze. No timer on the question."
            onDone={() => void send(asking)} onSkip={() => void send(asking)} />
        </div>
      )}
    </>
  );
}

/** A practice duel against a computer clan, played here with the same rules. Pays nothing. */
function PracticeDuel({ session, rival, ask, onBack }: { session: Session; rival: (typeof PRACTICE)[number]; ask?: Asker; onBack: () => void }) {
  const clans = useMemo((): [DuelClan, DuelClan] => [myDuelClan(session), rival.clan], [session, rival]);
  const [rounds, setRounds] = useState<[DuelPick, DuelPick][]>([]);
  const [asking, setAsking] = useState<DuelMove | null>(null);
  const [game, setGame] = useState(0);
  const play = (move: DuelMove, right: boolean) => {
    setAsking(null);
    window.setTimeout(() => setRounds((r) => (replayDuel(r, [clans[0].village, clans[1].village]).over ? r : [...r, [{ move, right }, computerDuelPick(Math.random)]])), 600);
  };
  return (
    <>
      <DuelStage
        key={game}
        myName={session.clan.name} theirName={rival.name} clans={clans} seat={0} rounds={rounds} computer
        waiting={asking !== null} onPick={(m) => (ask ? setAsking(m) : play(m, true))}
        note="Practice duel: no prizes, nothing lost."
        onLeave={onBack}
        buttons={<>
          <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => { setRounds([]); setGame((g) => g + 1); }}>Duel again</button>
          <button type="button" className="cq-btn" onClick={onBack}>Back to the Duel Arena</button>
        </>}
      />
      {asking && ask && (
        <div className="cq-duel__ask">
          <LadderAsk kind="duel" ask={ask} title={`Power up your ${DUEL_MOVE_INFO[asking].name}!`} note="A right answer is a full hit. A wrong one is only a graze."
            onDone={(r) => play(asking, r[0] === true)} onSkip={() => play(asking, false)} />
        </div>
      )}
    </>
  );
}

/** Waiting for the other clan to say yes. */
function DuelWait({ duel: d, duels }: { duel: DuelRow; duels: Duels }) {
  const left = useSecondsTo(d.deadline, duels.serverNow);
  return (
    <div className="cq-panel cq-dwait" role="status">
      {bannerArt(d.name_a) && <img className="cq-dwait__banner" src={bannerArt(d.name_a)} alt="" />}
      <span className="cq-dwait__vs" aria-hidden="true">⚔️</span>
      {bannerArt(d.name_b) && <img className="cq-dwait__banner" src={bannerArt(d.name_b)} alt="" />}
      <p>Waiting for the <strong>{d.name_b}</strong> to say yes… {left ? `${left}s` : ''}</p>
      <button type="button" className="cq-btn" onClick={() => void duels.send({ action: 'duel-leave', duel: d.id })}>Call it off</button>
    </div>
  );
}

/** The Duel Arena screen. */
export function DuelArena({ session, duels, ask, onBack }: { session: Session; duels: Duels; ask?: Asker; onBack: () => void }) {
  const [practice, setPractice] = useState<(typeof PRACTICE)[number] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const d = duels.duel;
  if (practice) return <PracticeDuel session={session} rival={practice} ask={ask} onBack={() => setPractice(null)} />;
  if (d && (d.status === 'playing' || (d.status === 'done' && d.ending))) return <LiveDuel duel={d} duels={duels} ask={ask} onBack={() => void duels.refresh()} />;

  const challenge = async (id: string) => {
    setProblem(null);
    setSending(true);
    const r = await duels.send({ action: 'duel-challenge', other: id });
    setSending(false);
    if (!r.ok) setProblem(r.message);
  };
  const mine = myDuelClan(session).village;
  const bonuses = bonusLines(mine);
  return (
    <section className="cq-place cq-darena" aria-label="Duel Arena">
      <div className="cq-place__head">
        <h2>Duel Arena</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to My Village</button>
      </div>
      <div className="cq-raids">
        <Embers />
        <div className="cq-panel">
          <h3>Live duels with friends</h3>
          {d && d.status === 'asked' && duelOpen(d) && d.seat_a === duels.me ? <DuelWait duel={d} duels={duels} /> : !duels.on ? (
            <p>Live duels are switched off for your class right now. You can still practise below!</p>
          ) : duels.online === null ? <p role="status">Looking for clans…</p> : duels.online.length === 0 ? (
            <p>No other clans are playing right now. Try a practice duel!</p>
          ) : (
            <SchoolPlayerList
              people={duels.online}
              label="Clans in Clan Quest now"
              searchLabel="Find a clan"
              listClassName="cq-rivals"
              itemClassName="cq-rival cq-rival--big cq-rival--close"
              row={(m) => (
                <>
                  {bannerArt(m.name) && <img className="cq-rival__banner" src={bannerArt(m.name)} alt="" />}
                  <span className="cq-rival__name">{m.name}<ClassTag player={m} /></span>
                  {m.busy ? <span className="cq-light cq-light--close">In a duel</span> : (
                    <button type="button" className="cq-btn cq-btn--hot" disabled={sending} onClick={() => void challenge(m.id)} aria-label={`Challenge the ${m.name} clan`}>⚔️ Duel!</button>
                  )}
                </>
              )}
            />
          )}
          {problem && <p className="cq-warn" role="alert">{problem}</p>}
          <h3>Practice against a computer clan</h3>
          <div className="cq-dpractice">
            {PRACTICE.map((p) => (
              <button key={p.name} type="button" className="cq-btn" onClick={() => setPractice(p)}>{p.name} <small>({p.light})</small></button>
            ))}
          </div>
        </div>
        <div className="cq-panel">
          <h3>How a duel works</h3>
          <DuelCards compact />
          <p className="cq-soft">Each round both clans pick an order in secret, then answer a maths question. The order that wins the clash hits twice as hard. A right answer is a full hit; a wrong one is a graze.</p>
          <p className="cq-soft"><strong>Nobody loses anything.</strong> A win earns 40 gold and 3 Banners, a loss still earns 15 gold and 1 Banner, for your first 3 duels a day.</p>
          <h3>Your village helps</h3>
          {bonuses.length ? <ul className="cq-dbonus">{bonuses.map((b) => <li key={b}>{b}</li>)}</ul> : <p className="cq-soft">Build a Forge, Walls, Barracks, Tower or Church in My Village to get duel bonuses. Every clan starts level, so you can win from day one!</p>}
        </div>
      </div>
    </section>
  );
}
