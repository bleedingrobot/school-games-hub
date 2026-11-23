/**
 * Class Showdown's iPad controller (docs/SHOWDOWN-PLAN.md section 3): a full-window layer where a pupil joins, picks a
 * role, and answers one question at a time. The server marks every answer; this screen only shows what it is told.
 * iPads are silent, so there is no sound button. It never shows other pupils' results.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { bossInfo, CHEST_GAMES, type Reward } from '../../../shared/showdown/bosses';
import { SHOWDOWN } from '../../../shared/showdown/config';
import type { PlayerView, RoomView } from '../../../shared/showdown/server';
import type { Role, TeamId } from '../../../shared/showdown/types';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { ShowdownLink } from './link';
import './controller.css';

type Q = { slot: number; parts: string[]; spoken: string; prompt?: string; choices?: number[]; choiceLabels?: string[]; input?: 'whole' | 'decimal'; maxLength?: number; golden: boolean };

const ROLES: { role: Role; name: string; line: string; emoji: string }[] = [
  { role: 'striker', name: 'Striker', line: 'Hit the boss', emoji: '⚔️' },
  { role: 'guard', name: 'Guard', line: 'Hold the shield', emoji: '🛡️' },
  { role: 'healer', name: 'Healer', line: 'Wake up dazed friends', emoji: '💖' },
];
const TEAM_NAME: Record<TeamId, string> = { red: 'Red team', blue: 'Blue team', gold: 'Gold team', green: 'Green team' };

const paintings = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
/** A role's portrait from the art, if it has been painted. */
const portrait = (role: Role) => Object.entries(paintings).find(([path]) => path.toLowerCase().includes(role))?.[1];

/** The whole fact with its answer in place of the blank, for "7 × 8 = 56". */
function factOf(q: Q, answer: number): string {
  const text = String(answer);
  const parts = q.parts.map((p) => p.replace(/\?/g, text));
  return parts.join(' ');
}

/** The painted frame round the controller, if it has been painted. */
const frameArt = Object.entries(paintings).find(([path]) => /controller-frame/i.test(path))?.[1];
const TITLE_BY_ROLE: Record<Role, string> = { striker: 'Hit the boss!', guard: 'Hold the shield!', healer: 'Wake a friend!' };
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const RING = 2 * Math.PI * 28;

export function Controller({ link, me, room: roomProp }: { link: ShowdownLink; me: string; room?: number }) {
  const [room, setRoom] = useState<number | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [mine, setMine] = useState<PlayerView | null>(null);
  const [question, setQuestion] = useState<Q | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [joinTries, setJoinTries] = useState(0);
  const [askTries, setAskTries] = useState(0);
  const [burst, setBurst] = useState(0);
  const [rolesOpen, setRolesOpen] = useState(true);
  const state = view?.state;
  const [, tick] = useState(0);
  const offset = useRef(0);
  const pending = useRef<{ question: Q | null; me?: PlayerView; view?: RoomView } | null>(null);
  const joining = useRef(false);

  useEffect(() => {
    void link.clockOffset().then((ms) => (offset.current = ms)).catch(() => undefined);
    const t = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [link]);

  useEffect(() => {
    if (room === null) return;
    const a = link.watchRoom(room, setView);
    const b = link.watchMe(room, me, setMine);
    return () => {
      a();
      b();
    };
  }, [link, room, me]);

  const join = useCallback(async () => {
    if (joining.current) return;
    joining.current = true;
    try {
      const out = await link.send({ action: 'join', ...(roomProp ? { room: roomProp } : {}) });
      if (out.status !== 200) {
        setSaid(String(out.body.error ?? 'We couldn’t join just now.'));
        if (out.status >= 500 || out.body.code === 'none') window.setTimeout(() => setJoinTries((n) => n + 1), Math.min(8000, 1000 * 2 ** joinTries));
        return;
      }
      setSaid(null);
      setRoom(out.body.room as number);
      setView(out.body.view as RoomView);
      setMine(out.body.me as PlayerView);
      if (out.body.question) setQuestion(out.body.question as Q);
    } catch {
      setSaid('We lost the connection. Trying again…');
      window.setTimeout(() => setJoinTries((n) => n + 1), Math.min(8000, 1000 * 2 ** joinTries));
    } finally {
      joining.current = false;
    }
  }, [link, roomProp, joinTries]);

  // Join on its own when the hub sent a room, and again after an error.
  const [wantsJoin, setWantsJoin] = useState(roomProp !== undefined);
  useEffect(() => {
    if (wantsJoin && room === null) void join();
  }, [wantsJoin, room, joinTries]); // eslint-disable-line react-hooks/exhaustive-deps

  // The teacher pressed "Again?": the room is a lobby again, so the old question goes and a new one is asked once it is live.
  useEffect(() => {
    if (state !== 'lobby') return;
    pending.current = null;
    setQuestion(null);
    setAskTries(0);
    setRolesOpen(true);
    setSaid(null);
  }, [state]);

  // Live and no question (first time, or after a dropped connection): ask, with backoff.
  useEffect(() => {
    if (room === null || state !== 'live' || question) return;
    let stop = false;
    const wait = askTries === 0 ? 0 : Math.min(8000, 500 * 2 ** askTries);
    const timer = window.setTimeout(() => {
      link.send({ action: 'ask', room }).then(
        (out) => {
          if (stop) return;
          if (out.body.question) setQuestion(out.body.question as Q);
          else setAskTries((n) => n + 1);
        },
        () => !stop && setAskTries((n) => n + 1),
      );
    }, wait);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [link, room, state, question, askTries]);

  const choose = async (role: Role) => {
    const out = await link.send({ action: 'choose', room, role });
    if (out.body.me) setMine(out.body.me as PlayerView);
    setSaid(out.status === 200 ? null : String(out.body.error ?? 'That didn’t work.'));
    if (out.status === 200) setRolesOpen(false);
  };

  const t = view?.startedAt ? (view.pausedAt ?? Date.now() + offset.current) - view.startedAt : 0;
  const dazed = !!mine && mine.dazedUntil > t;
  const team = mine?.team ?? null;
  const live = view?.state === 'live';

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const q = question as Q;
    let out;
    try {
      out = await link.send({ action: 'answer', room, slot: q.slot, answer: value, ms });
    } catch {
      throw new Error('We lost the connection. Try again.');
    }
    if (out.status !== 200) {
      if (out.body.me) setMine(out.body.me as PlayerView);
      const code = out.body.code;
      if (code === 'answered' || code === 'not_live' || out.status === 404) {
        pending.current = { question: null };
        setQuestion(null);
      }
      throw new Error(code === 'too_soon' ? 'Wait for the ring to fill!' : code === 'dazed' ? 'You’re dazed! A Healer can wake you.' : String(out.body.error ?? 'Try again.'));
    }
    const right = out.body.right === true;
    const answer = out.body.answer as number;
    pending.current = { question: (out.body.question as Q | undefined) ?? null, me: out.body.me as PlayerView, view: out.body.view as RoomView };
    if (right) setBurst((n) => n + 1);
    return { correct: right, fact: factOf(q, answer), boxBefore: 0, boxAfter: 0, answer };
  };
  const onDone = () => {
    const next = pending.current;
    pending.current = null;
    if (next?.me) setMine(next.me);
    if (next?.view) setView(next.view);
    setAskTries(0);
    setQuestion(next?.question ?? null);
  };

  // The filling ring: from the last answer until the pupil's next one is allowed.
  const waitLeft = mine ? Math.max(0, mine.nextAt - t) : 0;
  const fill = live ? 1 - Math.min(1, waitLeft / SHOWDOWN.paceMs) : 1;
  const dazeLeft = mine ? Math.max(0, mine.dazedUntil - t) : 0;
  const windUp = !!view?.windUp && live;
  const golden = !!question?.golden;
  const streak = mine?.streak ?? 0;
  const myRole = ROLES.find((r) => r.role === mine?.role);
  const canSwap = !!view && !!mine && view.mode !== 'solo' && view.state !== 'over' && (view.state === 'lobby' || view.roleSwapUntil > t);

  useEffect(() => {
    if (!canSwap) setRolesOpen(false);
  }, [canSwap]);
  const bossPct = view ? Math.max(0, Math.min(100, (view.boss.hp / Math.max(1, view.boss.max)) * 100)) : 100;
  const left = view ? Math.max(0, view.lengthMin * 60000 - (live || view.state === 'over' ? t : 0)) : 0;
  const questionTitle = golden ? 'Golden question!' : TITLE_BY_ROLE[mine?.role ?? 'striker'];

  let body;
  if (room === null || !view || !mine) {
    body = (
      <div className="sd-c-center">
        <h1 className="sd-c-title">Class Showdown</h1>
        <button type="button" className="sd-c-big" onClick={() => { setWantsJoin(true); void join(); }}>Join the showdown!</button>
        {said && <p className="sd-c-say" role="alert">{said}</p>}
      </div>
    );
  } else if (view.state === 'over') {
    body = (
      <div className="sd-c-center">
        <h1 className="sd-c-title">Well played, {mine.name}!</h1>
        <dl className="sd-c-results" aria-label="Your results">
          <div><dt>Right answers</dt><dd>{mine.correct}</dd></div>
          <div><dt>Best streak</dt><dd>{mine.bestStreak}</dd></div>
          <div><dt>Your score</dt><dd>{mine.score}</dd></div>
        </dl>
        {view.mode === 'solo' && mine.topTen && <p className="sd-c-topten">🏆 You finished in the top 10!</p>}
<<<<<<< HEAD
        {mine.reward && <ChestReveal key={`${mine.reward.chest.game}${mine.reward.chest.amount}${mine.reward.points}`} reward={mine.reward} />}
=======
>>>>>>> 4ac40a7bf41a269a04ba336f3ba5379fb374d58c
        <p className="sd-c-look">Look at the big screen!</p>
      </div>
    );
  } else {
    body = (
      <>
<<<<<<< HEAD
        {view.state === 'lobby' && <><h1 className="sd-c-title">Get ready!</h1><p className="sd-c-roar">{bossInfo(view.bossId).roar}</p></>}
=======
        {view.state === 'lobby' && <h1 className="sd-c-title">Get ready!</h1>}
>>>>>>> 4ac40a7bf41a269a04ba336f3ba5379fb374d58c
        {view.mode === 'solo' && view.state === 'live' && mine.topTen && <p className="sd-c-topten" role="status">🏆 You're in the top 10!</p>}
        {myRole && !(canSwap && rolesOpen) && (
          canSwap ? (
            <button type="button" className="sd-c-rolechip" onClick={() => setRolesOpen(true)}>Role: {myRole.emoji} {myRole.name} <u>(change)</u></button>
          ) : (
            <p className="sd-c-rolechip sd-c-rolechip--fixed">Role: {myRole.emoji} {myRole.name}</p>
          )
        )}
        {canSwap && rolesOpen && (
          <div className={`sd-c-roles${live ? ' sd-c-roles--compact' : ''}`} role="group" aria-label={live ? 'Change your role now' : 'Pick your role'}>
            {ROLES.map((r) => {
              const img = portrait(r.role);
              return (
                <button key={r.role} type="button" className="sd-c-role" aria-pressed={mine.role === r.role} onClick={() => void choose(r.role)}>
                  {img ? <img src={img} alt="" className="sd-c-role__img" /> : <span className="sd-c-role__emoji" aria-hidden="true">{r.emoji}</span>}
                  <strong>{r.name}</strong>
                  <span>{r.line}</span>
                </button>
              );
            })}
          </div>
        )}
        {live && (
          <div className={`sd-c-play${golden ? ' sd-c-play--gold' : ''}`}>
            {windUp && <p className="sd-c-alert" role="alert">Shield up! Answer fast!</p>}
            {streak >= 3 && <p className="sd-c-streak">{streak} in a row!</p>}
            {dazed ? (
              <div className="sd-c-dazed" role="status">
                <div className="sd-c-stars" aria-hidden="true"><span>⭐</span><span>⭐</span><span>⭐</span></div>
                <p>You’re dazed! A Healer can wake you</p>
                <p className="sd-c-small">{Math.ceil(Math.min(5000, dazeLeft) / 1000)}s</p>
              </div>
            ) : question ? (
              <div className="sd-c-qrow">
                <svg className="sd-c-ring" viewBox="0 0 64 64" role="img" aria-label={fill >= 1 ? 'Ready' : 'Getting ready'}>
                  <circle cx="32" cy="32" r="28" className="sd-c-ring__bg" />
                  <circle cx="32" cy="32" r="28" className="sd-c-ring__fg" strokeDasharray={RING} strokeDashoffset={RING * (1 - fill)} transform="rotate(-90 32 32)" />
                  <text x="32" y="38" textAnchor="middle" className="sd-c-ring__txt">{fill >= 1 ? 'GO' : ''}</text>
                </svg>
                <div className="sd-c-q">
                  <QuestionModal
                    key={question.slot}
                    question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
                    title={questionTitle} spot="Class Showdown" inline scribble={false} choiceKeys onSubmit={onSubmit} onDone={onDone}
                  />
                </div>
              </div>
            ) : <p className="sd-c-say" role="status">Getting your question…</p>}
            {said && <p className="sd-c-say" role="alert">{said}</p>}
          </div>
        )}
        {view.state === 'lobby' && <p className="sd-c-say" role="status">Waiting for the teacher to start…</p>}
        {view.pausedAt && <p className="sd-c-alert" role="status">Paused. Look at the teacher.</p>}
        {burst > 0 && <div key={burst} className={`sd-c-flash${team ? ` sd-c-flash--${team}` : ''}`} aria-hidden="true"><span className="sd-c-burst">✨</span></div>}
      </>
    );
  }

  const bossName = bossInfo(view?.bossId).name;
  return (
    <div className={`sd-c${windUp ? ' sd-c--windup' : ''}${golden && live && !dazed ? ' sd-c--golden' : ''}${team ? ` sd-c--team-${team}` : ''}`} role="region" aria-label="Class Showdown controller">
      {frameArt && <img className="sd-c-frame" src={frameArt} alt="" aria-hidden="true" />}
      <div className="sd-c-top">
        <a className="sd-c-hub" href="#/"><span aria-hidden="true">⌂</span><span className="sd-c-hub__word"> Hub</span></a>
        {view && view.state !== 'over' ? (
          <>
            <div className="sd-c-boss" role="progressbar" aria-label={`${bossName} health`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bossPct)}>
              <span className="sd-c-boss__name">{bossName}</span>
              <span className="sd-c-boss__bar"><i style={{ transform: `scaleX(${bossPct / 100})` }} /></span>
            </div>
            {team && <span className="sd-c-teamtag">{TEAM_NAME[team]}</span>}
            <span className="sd-c-clock" aria-label="Time left">{mmss(left)}</span>
          </>
        ) : <span className="sd-c-boss__name sd-c-top__title">Class Showdown</span>}
      </div>
      <div className="sd-c-body">{body}</div>
    </div>
  );
}

/** The end-of-round chest: it shakes, bursts open, coins fly out, then says what is in it. */
function ChestReveal({ reward }: { reward: Reward }) {
  const calm = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [step, setStep] = useState<0 | 1 | 2>(calm ? 2 : 0);
  useEffect(() => {
    if (calm) return;
    const a = setTimeout(() => setStep(1), 1500);
    const b = setTimeout(() => setStep(2), 2300);
    return () => [a, b].forEach(clearTimeout);
  }, [calm]);
  const game = CHEST_GAMES[reward.chest.game];
  const open = step >= 1;
  return (
    <div className={`sd-c-chest sd-c-chest--${step}`} aria-label="Your chest">
      <button type="button" className="sd-c-chest__box" onClick={() => setStep((n) => (n === 0 ? 1 : n))} aria-label={open ? 'Chest open' : 'Open the chest'}>
        <svg viewBox="0 0 120 100" aria-hidden="true">
          <g className="sd-c-chest__glow"><circle cx="60" cy="52" r="46" /></g>
          <rect x="12" y="48" width="96" height="46" rx="8" fill="#9a5a1c" stroke="#4a2808" strokeWidth="4" />
          <rect x="12" y="62" width="96" height="8" fill="#ffc83d" />
          <g className="sd-c-chest__lid">
            <path d="M10 50 Q10 14 60 14 Q110 14 110 50 Z" fill="#b8721f" stroke="#4a2808" strokeWidth="4" />
            <rect x="10" y="40" width="100" height="10" fill="#ffc83d" />
          </g>
          <rect x="52" y="52" width="16" height="20" rx="4" fill="#ffd95a" stroke="#4a2808" strokeWidth="3" />
        </svg>
        {open && <span className="sd-c-chest__coins" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--a': `${(i / 14) * 360}deg`, '--r': `${90 + (i % 4) * 26}px`, '--d': `${(i % 5) * 0.05}s` } as React.CSSProperties}>🪙</i>)}</span>}
      </button>
      {step === 2 && (
        <div className="sd-c-chest__prize" role="status">
          <strong>+{reward.chest.amount} {game.coin} for {game.name}</strong>
          <span>+{reward.points} hub {reward.points === 1 ? 'point' : 'points'}</span>
        </div>
      )}
    </div>
  );
}
