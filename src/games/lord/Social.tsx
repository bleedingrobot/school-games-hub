/**
 * Dragon Maths, the places where other heroes show up: the arena, the Daily News, the Warriors list and the Hall of
 * Heroes. Everything here is words the code wrote and names/avatars from the hub: no student text, no maths scores.
 *
 * Each one stands on its big painting (James, 17 Nov 2026): the name and purse on top, the list on a dark board in the
 * middle of the art, the way back along the bottom. The arena duel plays out on the painting like a forest fight.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CLASSES } from '../../../shared/lord/data';
import type { DuelEvent } from '../../../shared/lord/engine';
import type { LordAction } from '../../../shared/lord/server';
import type { Hero, HeroClass } from '../../../shared/lord/types';
import { AvatarImage } from '../../avatar/AvatarImage';
import type { HallRow, LordBackend, NewsItem, WarriorRow } from '../../data/lord';
import type { Ask, Reply } from './Places';
import { COMPUTER_HEROES } from '../../../shared/lord/computer';
import { MOVE_INFO, PAID_PRACTICE_PER_DAY, type ClashMove, type ClashPick } from '../../../shared/lord/clash';
import { ClashCircle, ClashScreen, type ClashEnding } from './Clash';
import { ChallengeWait, ClassmatesPanel, LiveClash } from './LiveArena';
import type { Clashes } from './useClashes';
import { HeroSprite } from './Sprite';
import { dayLabel, narrateDuel } from './text';
import type { SceneId } from './art';
import { Bar, BigStage, FloatNum, type Float } from './Fight';
import { Purse } from './Purse';
import { UNLIMITED_LABEL } from '../../../shared/unlimited';

function Page({ title, back, children, scene, pinned = false }: { title: string; back: () => void; children: ReactNode; scene: SceneId; pinned?: boolean }) {
  return (
    <BigStage scene={scene} label={title} className="lord-board-stage">
      <div className="lord-big__top">
        <h2 className="lord-big__heading">{title}</h2>
        <Purse />
      </div>
      <div className={`lord-board-card${pinned ? ' lord-board-card--pinned' : ''}`}>{children}</div>
      <div className="lord-big__bar">
        <button type="button" className="lord-btn lord-btn--glass lord-btn--big" autoFocus onClick={back}><kbd>Esc</kbd> Back to the village</button>
      </div>
    </BigStage>
  );
}

/** Loads one of the lists when the page opens, and offers to try again if it can't. */
function useList<T>(fetcher: () => Promise<T[] | null>) {
  const [rows, setRows] = useState<T[] | null | 'failed'>(null);
  const load = useCallback(() => {
    setRows(null);
    let current = true;
    fetcher().then((r) => current && setRows(r ?? 'failed'), () => current && setRows('failed'));
    return () => {
      current = false;
    };
  }, [fetcher]);
  useEffect(() => load(), [load]);
  return { rows, retry: load };
}

function Failed({ retry }: { retry: () => void }) {
  return (
    <p className="lord-note" role="status">
      We couldn’t fetch that just now.{' '}
      <button type="button" className="lord-btn" onClick={retry}>Try again</button>
    </p>
  );
}

// ---------------------------------------------------------------- the arena

export interface DuelResult {
  outcome: 'won' | 'lost';
  rounds: number;
  exp: number;
  log: DuelEvent[];
  you: { name: string; heroClass: HeroClass; look?: string; level: number; maxHp: number };
  opponent: { name: string; heroClass: HeroClass; look?: string; level: number; maxHp: number; computer: boolean };
}

/**
 * A practice clash against a computer hero, as many as you like. The server plays each round (it picks the computer's
 * attack and marks the maths) and pays a little gold for the first few a day (James, 17 Nov 2026).
 */
function PracticeClash({ hero, ask, act, back }: { hero: Hero; ask: Ask; act: (a: LordAction) => Promise<Reply | null>; back: () => void }) {
  const [foe, setFoe] = useState<string | null>(null);
  const [picks, setPicks] = useState<[ClashPick, ClashPick][]>([]);
  const [waiting, setWaiting] = useState(false);
  const [ending, setEnding] = useState<ClashEnding | null>(null);
  const [gold, setGold] = useState(0);
  const [paidLeft, setPaidLeft] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [tries, setTries] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  // The computer hero for this clash (only its look and name): told to the server on round 1.
  const [stand, setStand] = useState(() => COMPUTER_HEROES[Math.floor(Math.random() * COMPUTER_HEROES.length)]);
  const opponent = COMPUTER_HEROES.find((h) => h.id === foe) ?? stand;

  async function onPick(move: ClashMove) {
    setWaiting(true);
    setProblem(null);
    const asked = await ask('arena', { title: `Power up your ${MOVE_INFO[move].name}!`, note: 'A right answer is a full hit. A wrong one is only a graze.' });
    const reply = await act({ action: 'practice', op: 'round', move, proof: asked?.proof ?? null, fresh: picks.length === 0, foe: stand.id });
    setWaiting(false);
    const r = reply?.result as { foe?: string; picks?: [ClashPick, ClashPick][]; over?: boolean; gold?: number; paidLeft?: number } | undefined;
    if (!r?.picks) {
      setTries((n) => n + 1);
      setProblem('That round couldn’t be played just now. Try again!');
      return;
    }
    if (r.foe) setFoe(r.foe);
    if (r.over) {
      setGold(r.gold ?? 0);
      setPaidLeft(r.paidLeft ?? 0);
    }
    setPicks(r.picks);
  }

  function again() {
    setFoe(null);
    setStand(COMPUTER_HEROES[Math.floor(Math.random() * COMPUTER_HEROES.length)]);
    setPicks([]);
    setEnding(null);
    setGold(0);
    setRound((n) => n + 1);
  }

  const note = paidLeft === null ? undefined : gold > 0
    ? `Practice clash: ${paidLeft === 0 ? 'that was today’s last one with gold.' : `${paidLeft} more with gold today.`}`
    : 'Practice clash: no gold left today, just glory.';
  return (
    <ClashScreen
      key={round}
      me={{ name: 'You', heroClass: hero.heroClass, look: hero.look }}
      them={{ name: opponent.name, heroClass: opponent.heroClass, look: opponent.look, computer: true }}
      seat={0}
      picks={picks}
      waiting={waiting}
      onPick={(m) => void onPick(m)}
      prize={gold}
      note={note}
      ending={ending}
      tries={tries}
      problem={problem}
      onLeave={() => {
        void act({ action: 'practice', op: 'leave' });
        setEnding({ title: 'You stepped out', line: 'Practice is over. Come back any time!' });
      }}
      buttons={<>
        <button type="button" className="lord-btn lord-btn--hot lord-btn--big lord-end__go" data-key="enter" autoFocus onClick={again}>Practise again</button>
        <button type="button" className="lord-btn lord-btn--glass lord-btn--big lord-end__go" onClick={back}>Back to the arena</button>
      </>}
    />
  );
}

export function Arena({ hero, act, say, back, busy, ask, clashes, me, unlimited = false }: {
  unlimited?: boolean; hero: Hero; act: (a: LordAction) => Promise<Reply | null>; say: (n: string) => void; back: () => void; busy: boolean; ask: Ask;
  clashes: Clashes; me: string;
}) {
  const [practice, setPractice] = useState(false);
  const [mateNote, setMateNote] = useState('');
  const [challenging, setChallenging] = useState(false);
  const live = clashes.clash;
  // A challenge of mine that never started: say what happened, then put it away.
  useEffect(() => {
    if (!live || live.seat_a !== me || !['declined', 'expired', 'cancelled'].includes(live.status)) return;
    setMateNote(live.status === 'declined' ? `${live.name_b} said not now.` : live.status === 'expired' ? `${live.name_b} didn’t answer in time.` : '');
    clashes.forget(live.id);
  }, [live, me, clashes]);
  const [duel, setDuel] = useState<DuelResult | null>(null);
  const [shown, setShown] = useState(0);
  const left = hero.arenaLeft;
  const canFight = left > 0 || unlimited;

  async function fight() {
    const reply = await act({ action: 'arena' });
    if (!reply) return;
    setShown(0);
    setDuel(reply.result as unknown as DuelResult);
    say('');
  }

  // Play the duel out one blow at a time (all at once when the device asks for less motion).
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!duel || shown >= duel.log.length) return;
    if (still) { setShown(duel.log.length); return; }
    timer.current = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 700 : 650);
    return () => window.clearTimeout(timer.current);
  }, [duel, shown, still]);

  const leftLabel = unlimited && left <= 0 ? UNLIMITED_LABEL : `${left} left`;
  const fightButton = (
    <button type="button" className={`lord-btn ${duel ? 'lord-btn--hot' : 'lord-btn--glass'} lord-btn--big`} autoFocus={!!duel} disabled={busy || !canFight} onClick={() => void fight()}>
      {!canFight ? 'No quick fights left today' : duel ? `Quick fight again (${leftLabel})` : <>Quick fight ({leftLabel})<small>the computer plays it for you</small></>}
    </button>
  );
  const backButton = <button type="button" className="lord-btn lord-btn--glass lord-btn--big" onClick={back}><kbd>Esc</kbd> Back to the village</button>;

  if (practice) return <PracticeClash hero={hero} ask={ask} act={act} back={() => setPractice(false)} />;
  if (live && live.status === 'asked' && live.seat_a === me) return <ChallengeWait clash={live} hero={hero} clashes={clashes} />;
  if (live && (live.status === 'playing' || live.status === 'done')) {
    return <LiveClash clash={live} me={me} hero={hero} ask={ask} clashes={clashes} onBack={() => setDuel(null)} />;
  }

  async function challenge(other: string) {
    setChallenging(true);
    setMateNote('');
    const r = await clashes.send({ action: 'clash-challenge', other });
    setChallenging(false);
    if (!r.ok) setMateNote(r.message);
  }

  if (!duel) {
    return (
      <BigStage scene="arena" label="The Arena" className={`lord-encounter lord-arena${clashes.on ? ' has-mates' : ''}`}>
        <div className="lord-big__top"><h2 className="lord-big__heading">The Arena</h2><Purse /></div>
        <div className="lord-big__title"><p>Pick <strong>Hammer, Sword or Net</strong>, then answer a question to power it up. <strong>Losing costs you nothing.</strong></p></div>
        <ClashCircle />
        {mateNote && <p className="lord-clash__wait lord-arena__note" role="status">{mateNote}</p>}
        {clashes.on && <ClassmatesPanel clashes={clashes} busy={challenging} onChallenge={(id) => void challenge(id)} />}
        <div className="lord-big__floor">
          <div className="lord-big__fig lord-big__fig--me"><div className="lord-big__body"><HeroSprite heroClass={hero.heroClass} look={hero.look} scale={8} label="" /></div></div>
          <div className="lord-big__fig lord-big__fig--foe">{!clashes.on && <span className="lord-arena__who" aria-hidden="true">?</span>}</div>
        </div>
        <div className="lord-big__bar">
          <button type="button" className="lord-btn lord-btn--hot lord-btn--big" autoFocus onClick={() => setPractice(true)}>⚔️ Practice clash<small>against a computer hero, a little gold for {PAID_PRACTICE_PER_DAY} a day</small></button>
          {fightButton}{backButton}
        </div>
      </BigStage>
    );
  }

  // How the duel stands after the blows shown so far.
  const log = duel.log.slice(0, shown);
  let hpA = duel.you.maxHp;
  let hpB = duel.opponent.maxHp;
  const floats: Float[] = [];
  log.forEach((e, i) => {
    const side = e.who === 'a' ? 'foe' : 'me';
    if (e.type === 'hit') {
      if (e.who === 'a') hpB = Math.max(0, hpB - e.damage);
      else hpA = Math.max(0, hpA - e.damage);
      const big = e.move === 'power-strike';
      floats.push({ id: i, side, text: big ? `${e.damage}!` : `${e.damage}`, tone: big ? 'crit' : 'hit', delay: 0 });
    } else floats.push({ id: i, side, text: 'Missed!', tone: 'miss', delay: 0 });
  });
  const last = log[log.length - 1];
  const done = shown >= duel.log.length;
  const won = duel.outcome === 'won';
  if (done) {
    if (won) hpB = 0;
    else hpA = 0;
  }
  const them = duel.opponent;
  const meMove = !last ? '' : last.who === 'a' ? ' lord-lunge-r' : last.type === 'hit' ? ' lord-hit' : '';
  const themMove = !last ? ' lord-enter' : last.who === 'b' ? ' lord-lunge-l' : last.type === 'hit' ? ' lord-hit' : '';

  return (
    <BigStage scene="arena" label="The Arena" className={`lord-fight lord-arena${done ? ` is-over is-${won ? 'won' : 'lost'}` : ''}`}>
      <div className="lord-big__hud">
        <div className="lord-big__side lord-big__side--me">
          <h2 className="lord-big__name">You</h2>
          <Bar value={hpA} max={duel.you.maxHp} label="Your health" side="me" />
        </div>
        <div className="lord-big__side lord-big__side--foe">
          <h3 className="lord-big__name">{them.name}</h3>
          <Bar value={hpB} max={them.maxHp} label={`${them.name}’s health`} side="foe" />
          <div className="lord-big__chips">
            <span className="lord-chip">{CLASSES[them.heroClass].name}, level {them.level}</span>
            {them.computer && <span className="lord-chip">computer hero</span>}
          </div>
        </div>
      </div>
      <div className="lord-big__floor">
        <div className={`lord-big__fig lord-big__fig--me${done && !won ? ' is-down' : ''}`}>
          <div key={`me${shown}`} className={`lord-big__body${meMove}`}>
            <HeroSprite heroClass={duel.you.heroClass} look={duel.you.look} scale={8} label="" />
          </div>
          {floats.filter((f) => f.side === 'me').slice(-2).map((f) => <FloatNum key={f.id} f={f} />)}
        </div>
        <div className={`lord-big__fig lord-big__fig--foe lord-arena__them${done && won ? ' is-down' : ''}`}>
          <div key={`foe${shown}`} className={`lord-big__body${themMove}`}>
            <HeroSprite heroClass={them.heroClass} look={them.look} scale={8} label={them.name} />
          </div>
          {floats.filter((f) => f.side === 'foe').slice(-2).map((f) => <FloatNum key={f.id} f={f} />)}
        </div>
      </div>

      {done && (
        <div className="lord-end">
          {won && <div className="lord-end__rays" aria-hidden="true" />}
          <p className="lord-end__title">{won ? 'Victory!' : 'Not this time'}</p>
          {!won && <p className="lord-end__line">It costs you nothing. Try again!</p>}
          {won && duel.exp > 0 && (
            <p className="lord-end__pops"><span className="lord-pop lord-pop--exp" style={{ '--d': '0.45s' } as CSSProperties}>+{duel.exp} XP</span></p>
          )}
        </div>
      )}
      <p className="lord-sr" aria-live="polite">
        {done ? `${narrateDuel(duel.log, them.name).join(' ')} ${won ? `You won! Plus ${duel.exp} experience.` : 'You lost this one. It costs you nothing.'}` : `You face ${them.name}.`}
      </p>

      <div className="lord-big__bar">
        {done ? <>{fightButton}{backButton}</> : (
          <button type="button" className="lord-btn lord-btn--glass lord-btn--big" autoFocus onClick={() => setShown(duel.log.length)}>Skip to the end</button>
        )}
      </div>
    </BigStage>
  );
}

// ---------------------------------------------------------------- the news

export function NewsPage({ backend, today, deeds, back }: { backend: LordBackend; today: string; deeds: string[]; back: () => void }) {
  const fetcher = useCallback(() => backend.fetchNews(), [backend]);
  const { rows, retry } = useList<NewsItem>(fetcher);
  const news = Array.isArray(rows) ? rows : [];
  // Each piece of news is a paper pinned on the village notice board (the painting), newest first; your own deeds too.
  const tilt = (i: number) => `${((i * 37) % 7) - 3}deg`;
  return (
    <Page title="The Daily News" scene="news" back={back} pinned>
      {rows === null && <p className="lord-board-card__empty" role="status">Fetching the news…</p>}
      {rows === 'failed' && <Failed retry={retry} />}
      <ul className="lord-pins" aria-label="The news">
        {deeds.map((n, i) => (
          <li key={`d${i}`} className="lord-pin lord-pin--mine" style={{ '--r': tilt(i + 3) } as CSSProperties}><small>You, this visit</small>{n}</li>
        ))}
        {news.map((n, i) => (
          <li key={i} className={`lord-pin lord-pin--${n.kind}`} style={{ '--r': tilt(i) } as CSSProperties}><small>{dayLabel(n.day, today)}</small>{n.line}</li>
        ))}
      </ul>
      {Array.isArray(rows) && rows.length === 0 && deeds.length === 0 && <p className="lord-board-card__empty">No news yet today. Go and do something newsworthy!</p>}
    </Page>
  );
}

// ---------------------------------------------------------------- the Warriors list

export function Warriors({ backend, back }: { backend: LordBackend; back: () => void }) {
  const fetcher = useCallback(() => backend.fetchWarriors(), [backend]);
  const { rows, retry } = useList<WarriorRow>(fetcher);
  return (
    <Page title="The Warriors list" scene="warriors" back={back}>
      {rows === null && <p className="lord-soft" role="status">Fetching the list…</p>}
      {rows === 'failed' && <Failed retry={retry} />}
      {Array.isArray(rows) && rows.length === 0 && <p className="lord-board-card__empty">Nobody has set out yet this season. It could be you!</p>}
      {Array.isArray(rows) && rows.length > 0 && (
        <ol className="lord-board" aria-label="Warriors this season">
          {rows.map((r, i) => (
            <li key={`${r.place}-${r.display_name}`} className={r.is_me ? 'is-me' : undefined} value={r.place}>
              {i > 0 && r.place > rows[i - 1].place + 1 && r.place > 10 && <span className="lord-board__gap" aria-hidden="true">⋯</span>}
              <span className={`lord-board__place${r.place <= 3 ? ` is-top is-${r.place}` : ''}`} aria-label={`Place ${r.place}`}>{r.place}</span>
              <AvatarImage avatar={r.avatar} size={36} />
              <span className="lord-board__name">{r.display_name}{r.is_me && <span className="lord-soft"> (you)</span>}</span>
              <span>Level {r.level}</span>
              <span aria-label={`${r.stars} dragon stars`}>{r.stars > 0 ? '★'.repeat(Math.min(r.stars, 5)) + (r.stars > 5 ? `+${r.stars - 5}` : '') : ''}</span>
            </li>
          ))}
        </ol>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- the Hall of Heroes

export function HallOfHeroes({ backend, back, ceremony }: {
  backend: LordBackend;
  back: () => void;
  /** My last finished season, to watch its ceremony again. */
  ceremony?: { season: number; watch: () => void };
}) {
  const fetcher = useCallback(() => backend.fetchHall(), [backend]);
  const { rows, retry } = useList<HallRow>(fetcher);
  const seasons = new Map<number, HallRow[]>();
  if (Array.isArray(rows)) for (const r of rows) seasons.set(r.season, [...(seasons.get(r.season) ?? []), r]);
  return (
    <Page title="The Hall of Heroes" scene="hall" back={back}>
      {ceremony && <button type="button" className="lord-btn lord-btn--glass lord-hall__ceremony" onClick={ceremony.watch}>🎺 Watch the Season {ceremony.season} ceremony</button>}
      {rows === null && <p className="lord-soft" role="status">Opening the Hall…</p>}
      {rows === 'failed' && <Failed retry={retry} />}
      {Array.isArray(rows) && rows.length === 0 && <p className="lord-board-card__empty">The Hall is empty. Will you be the first to beat the Red Dragon?</p>}
      {[...seasons.entries()].map(([season, list]) => (
        <div key={season}>
          <h3>Season {season}</h3>
          <ul className="lord-board">
            {list.map((r) => (
              <li key={`${season}-${r.display_name}`} className={r.is_me ? 'is-me' : undefined}>
                <AvatarImage avatar={r.avatar} size={36} />
                <span className="lord-board__name">{r.kills >= 2 && <span title="Ultimate Dragon Slayer" aria-label="Ultimate Dragon Slayer">👑 </span>}{r.display_name}{r.is_me && <span className="lord-soft"> (you)</span>}</span>
                <span>{r.kills === 1 ? 'beat the dragon' : `beat the dragon ${r.kills} times`}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Page>
  );
}

