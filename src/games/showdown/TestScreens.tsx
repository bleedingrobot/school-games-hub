/**
 * Class Showdown stage 2's bare test screens (docs/SHOWDOWN-PLAN.md section 9): a plain projector and a plain controller
 * that show the numbers and list every event the feed carries, enough to prove a round works end to end. The painted,
 * animated screens are stage 3 (docs/prompts/showdown-s3.md); they listen to exactly the same feed.
 */
import { useEffect, useRef, useState } from 'react';
import { SHOWDOWN } from '../../../shared/showdown/config';
import type { FeedEvent, PlayerView, RoomView } from '../../../shared/showdown/server';
import type { Mode, Role } from '../../../shared/showdown/types';
import type { ShowdownLink } from './link';
import './showdown.css';

/** One line of words for a feed event, for the test list. */
export function feedLine(e: FeedEvent): string {
  const n = (id: unknown) => (typeof id === 'string' ? e.names?.[id] ?? 'Someone' : '');
  const s = (ms: number) => `${Math.round(ms / 1000)}s`;
  switch (e.type) {
    case 'join': return `${n(e.pupil)} joined${e.team ? ` (${e.team})` : ''}`;
    case 'hit': return `${n(e.pupil)} ${e.role} +${e.points}${e.times > 1 ? ` x${e.times}` : ''}${e.weakSpot ? ' WEAK SPOT' : ''}${e.golden ? ' GOLDEN' : ''}`;
    case 'streak': return `${n(e.pupil)}: ${e.streak} in a row!`;
    case 'wind_up': return `BOSS IS WINDING UP! until ${s(e.endsAt)}${e.enraged ? ' (enraged)' : ''}`;
    case 'shield_progress': return `shield ${e.group} ${e.got}/${e.needed}`;
    case 'shield_held': return `Shield held (${e.group})`;
    case 'shield_broke': return `Shield broke (${e.group}): ${e.dazed.length} dazed`;
    case 'revive': return `${n(e.pupil)} woke up ${n(e.woke)}`;
    case 'recap': return `RECAP: ${e.recap.result}, ${e.recap.awards.map((a) => `${a.kind} ${n(a.pupil)}`).join(', ')}`;
    default: return `${e.type}${'endsAt' in e ? ` until ${s(e.endsAt as number)}` : ''}`;
  }
}

/** The projector: opens a room, runs it (one tick a second), and lists everything. */
export function TestProjector({ link, classId }: { link: ShowdownLink; classId: string }) {
  const [mode, setMode] = useState<Mode>('class');
  const [length, setLength] = useState(5);
  const [room, setRoom] = useState<number | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const send = async (body: Record<string, unknown>) => {
    const out = await link.send(body);
    if (out.status !== 200) setProblem(String(out.body.error ?? 'That didn’t work.'));
    else {
      setProblem(null);
      if (out.body.view) setView(out.body.view as RoomView);
    }
    return out;
  };

  useEffect(() => {
    if (!room) return;
    const stopRoom = link.watchRoom(room, setView);
    const stopFeed = link.watchFeed(room, (e) => {
      setFeed((list) => [e, ...list].slice(0, 40));
      setCounts((c) => ({ ...c, [e.type]: (c[e.type] ?? 0) + 1 }));
      if (e.names) setNames((m) => ({ ...m, ...e.names }));
    });
    // The projector's tick: once a second, it only asks "is it time yet?".
    const tick = setInterval(() => void link.send({ action: 'tick', room }), 1000);
    return () => {
      stopRoom();
      stopFeed();
      clearInterval(tick);
    };
  }, [link, room]);

  const open = async () => {
    const out = await send({ action: 'open', classId, mode, length });
    if (out.status === 200) {
      setRoom(out.body.room as number);
      setFeed([]);
      setCounts({});
    }
  };
  const live = view?.state === 'live';
  const secsLeft = view ? Math.max(0, Math.round((view.lengthMin * 60000 - view.t) / 1000)) : 0;

  return (
    <section className="sd-test" aria-labelledby="sd-proj">
      <h2 id="sd-proj">Projector (test)</h2>
      <div className="sd-test__bar">
        <label>Mode <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="class">Whole class</option><option value="teams2">2 teams</option><option value="teams4">4 teams</option><option value="solo">Everyone for themselves</option>
        </select></label>
        <label>Minutes <select value={length} onChange={(e) => setLength(Number(e.target.value))}>
          {SHOWDOWN.lengths.map((l) => <option key={l} value={l}>{l}</option>)}
        </select></label>
        <button type="button" className="button button--primary" onClick={() => void open()}>Open</button>
        {room && <button type="button" className="button" disabled={view?.state !== 'lobby'} onClick={() => void send({ action: 'teams', room, reshuffle: true })}>Reshuffle</button>}
        {room && <button type="button" className="button button--play" disabled={view?.state !== 'lobby'} onClick={() => void send({ action: 'start', room })}>Start</button>}
        {room && <button type="button" className="button" disabled={!live} onClick={() => void send({ action: 'enrage', room })}>Enrage</button>}
        {room && <button type="button" className="button" disabled={!live} onClick={() => void send({ action: 'pause', room, resume: view?.pausedAt !== null })}>{view?.pausedAt ? 'Resume' : 'Pause'}</button>}
        {room && <button type="button" className="button button--danger" disabled={view?.state === 'over'} onClick={() => void send({ action: 'end', room })}>End</button>}
      </div>
      {problem && <p role="alert">{problem}</p>}
      {view && (
        <dl className="sd-test__nums">
          <dt>Room</dt><dd>{room} · {view.state}{view.pausedAt ? ' (paused)' : ''} · {view.players} playing · {secsLeft}s left</dd>
          <dt>Boss</dt><dd>{Math.round(view.boss.hp)} / {Math.round(view.boss.max)} · phase {view.boss.phase}{view.result ? ` · ${view.result}` : ''}</dd>
          {view.teams.length > 0 && <><dt>Teams</dt><dd>{view.teams.map((k) => `${k} ${view.teamPoints[k] ?? 0} pts / ${view.teamDamage[k] ?? 0} dmg`).join(' · ')}</dd></>}
          {view.mode === 'teams2' && <><dt>Tug</dt><dd>{view.tug}</dd></>}
          {view.facing && <><dt>Boss faces</dt><dd>{view.facing}</dd></>}
          <dt>Now</dt><dd>{[view.windUp && 'wind-up', view.weakSpotUntil > view.t && 'weak spot', view.goldenUntil > view.t && 'golden', view.enrageUntil > view.t && 'enraged', view.finalStarted && 'final 30s'].filter(Boolean).join(', ') || 'calm'}</dd>
          <dt>Events</dt><dd>{Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}</dd>
        </dl>
      )}
      <ol className="sd-test__feed" aria-label="Feed">
        {feed.map((e, i) => <li key={`${feed.length - i}`}>{feedLine({ ...e, names: { ...names, ...e.names } })}</li>)}
      </ol>
    </section>
  );
}

type Q = { slot: number; parts: string[]; prompt?: string; choices?: number[]; choiceLabels?: string[]; golden: boolean };

/** The controller: join, pick a role, answer one question at a time (the server marks it). */
export function TestController({ link, me }: { link: ShowdownLink; me: string }) {
  const [room, setRoom] = useState<number | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [mine, setMine] = useState<PlayerView | null>(null);
  const [question, setQuestion] = useState<Q | null>(null);
  const [typed, setTyped] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const offset = useRef(0);
  const [, tick] = useState(0);

  useEffect(() => {
    void link.clockOffset().then((ms) => (offset.current = ms));
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [link]);

  useEffect(() => {
    if (!room) return;
    const a = link.watchRoom(room, setView);
    const b = link.watchMe(room, me, setMine);
    return () => {
      a();
      b();
    };
  }, [link, room, me]);

  // Once the round is live and there's no question, ask for one (also after a dropped connection).
  useEffect(() => {
    if (!room || view?.state !== 'live' || question) return;
    void link.send({ action: 'ask', room }).then((out) => out.body.question && setQuestion(out.body.question as Q));
  }, [link, room, view?.state, question]);

  const join = async () => {
    const out = await link.send({ action: 'join' });
    if (out.status !== 200) return setSaid(String(out.body.error));
    setRoom(out.body.room as number);
    setView(out.body.view as RoomView);
    setMine(out.body.me as PlayerView);
    if (out.body.question) setQuestion(out.body.question as Q);
  };
  const choose = async (role: Role) => {
    const out = await link.send({ action: 'choose', room, role });
    setSaid(out.status === 200 ? `You're a ${role}.` : String(out.body.error));
    if (out.body.me) setMine(out.body.me as PlayerView);
  };
  const answer = async (value: number) => {
    if (!question) return;
    const out = await link.send({ action: 'answer', room, slot: question.slot, answer: value, ms: 3000 });
    if (out.status !== 200) return setSaid(String(out.body.error));
    setSaid(out.body.right ? 'Hit!' : `Not quite: it's ${out.body.answer as number}.`);
    if (out.body.me) setMine(out.body.me as PlayerView);
    setTyped('');
    setQuestion((out.body.question as Q) ?? null);
  };

  const t = view?.startedAt ? (view.pausedAt ?? Date.now() + offset.current) - view.startedAt : 0;
  const waitMs = mine ? Math.max(mine.nextAt, mine.dazedUntil) - t : 0;

  return (
    <section className="sd-test" aria-labelledby="sd-ctrl">
      <h2 id="sd-ctrl">Controller (test)</h2>
      {!room && <button type="button" className="button button--play" onClick={() => void join()}>Join the showdown</button>}
      {room && view && (
        <>
          <p>{view.state === 'lobby' ? 'Waiting for the start…' : view.state === 'over' ? 'Finished!' : `Boss ${Math.round(view.boss.hp)} / ${Math.round(view.boss.max)}`}</p>
          {view.mode !== 'solo' && view.state !== 'over' && (
            <div className="sd-test__bar">
              {(['striker', 'guard', 'healer'] as Role[]).map((r) => (
                <button key={r} type="button" className={`button${mine?.role === r ? ' button--primary' : ''}`} onClick={() => void choose(r)}>{r}</button>
              ))}
            </div>
          )}
          {mine && <p>Score {mine.score} · streak {mine.streak} · {mine.correct} right{mine.team ? ` · team ${mine.team}` : ''}{mine.dazedUntil > t ? ' · DAZED' : ''}</p>}
          {question && view.state === 'live' && (
            <form onSubmit={(e) => { e.preventDefault(); if (typed !== '') void answer(Number(typed)); }}>
              <p className="sd-test__q">{question.golden ? '⭐ ' : ''}{question.prompt ? `${question.prompt} ` : ''}{question.parts.join(' ')}</p>
              {question.choices ? (
                <div className="sd-test__bar">
                  {question.choices.map((c, i) => <button key={c} type="button" className="button" disabled={waitMs > 0} onClick={() => void answer(c)}>{question.choiceLabels?.[i] ?? c}</button>)}
                </div>
              ) : (
                <>
                  <input inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Your answer" />
                  <button type="submit" className="button button--primary" disabled={waitMs > 0}>{waitMs > 0 ? `${Math.ceil(waitMs / 1000)}s` : 'Go'}</button>
                </>
              )}
            </form>
          )}
        </>
      )}
      {said && <p role="status">{said}</p>}
    </section>
  );
}
