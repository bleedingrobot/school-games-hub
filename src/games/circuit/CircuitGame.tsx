/**
 * Circuit Racer's screens (docs/CIRCUIT-PLAN.md, sections 4 and 5), full window from the first screen: the Motherboard's
 * road picker, the race, the finish (time, medal, stars) and "All done for today" once the day's 5 finishes are used.
 * The server (`backend`) hands out every go and saves every finish; the screens only show what it says.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FINISHES_A_DAY, MEDAL_SECONDS, msToNzMidnight, roadById, roadOpen, ROADS, timeText, type CircuitSave, type Medal } from '../../../shared/circuit/game';
import type { RaceState } from '../../../shared/circuit/physics';
import { useSound } from '../../sound';
import { CircuitError, type CircuitBackend, type FinishReply } from './backend';
import { HubButtons } from './HubButtons';
import { RaceScreen } from './RaceScreen';
import './circuit.css';

type Screen =
  | { kind: 'roads' }
  | { kind: 'race'; road: string; seed: string; stamp: string; go: number }
  | { kind: 'saving'; road: string }
  | { kind: 'finish'; road: string; reply: FinishReply; was: number | null }
  | { kind: 'done' }
  | { kind: 'off' };

const MEDAL_ICON: Record<Medal, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' };
const MEDAL_WORD: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

const leftText = (left: number | null) => (left === null ? 'Unlimited today' : `${left} race${left === 1 ? '' : 's'} left today`);

export function CircuitGame({ backend, extra }: { backend: CircuitBackend; extra?: ReactNode }) {
  const { soundOn } = useSound();
  const [save, setSave] = useState<CircuitSave | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'roads' });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const goCount = useRef(0);

  const fail = useCallback((e: unknown) => {
    if (e instanceof CircuitError && e.code === 'done-today') setScreen({ kind: 'done' });
    else if (e instanceof CircuitError && e.code === 'off') setScreen({ kind: 'off' });
    else setProblem(e instanceof Error ? e.message : 'Something went wrong. Try again.');
  }, []);

  useEffect(() => {
    backend.load().then((s) => {
      setSave(s);
      if (s.left === 0) setScreen({ kind: 'done' });
    }, fail);
  }, [backend, fail]);

  const start = useCallback(async (road: string) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const go = await backend.start(road);
      setSave((s) => (s ? { ...s, left: go.left } : s));
      setScreen({ kind: 'race', road, seed: go.seed, stamp: go.stamp, go: ++goCount.current });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [backend, busy, fail]);

  const finished = useCallback(async (road: string, seed: string, stamp: string, inputs: string, crashes: number, _state: RaceState) => {
    setScreen({ kind: 'saving', road });
    const was = save?.roads[road]?.best ?? null;
    try {
      const reply = await backend.finish({ road, seed, stamp, inputs, crashes });
      setSave((s) => {
        if (!s) return s;
        const had = s.roads[road];
        const rank = { bronze: 1, silver: 2, gold: 3 };
        return {
          ...s,
          today: s.today + 1,
          left: reply.left,
          roads: {
            ...s.roads,
            [road]: {
              best: had ? Math.min(had.best, reply.steps) : reply.steps,
              medal: had && rank[had.medal] >= rank[reply.medal] ? had.medal : reply.medal,
              clean: (had?.clean ?? false) || reply.clean,
              charged: (had?.charged ?? false) || reply.charged,
              finishes: (had?.finishes ?? 0) + 1,
            },
          },
        };
      });
      setScreen({ kind: 'finish', road, reply, was });
    } catch (e) {
      if (e instanceof CircuitError && (e.code === 'done-today' || e.code === 'off')) fail(e);
      else {
        setScreen({ kind: 'roads' });
        setProblem(e instanceof Error ? `${e.message} That finish wasn’t saved.` : 'That finish wasn’t saved.');
      }
    }
  }, [backend, fail, save]);

  let body: ReactNode;
  if (screen.kind === 'race') {
    const road = roadById(screen.road)!;
    body = (
      <RaceScreen
        key={screen.go}
        road={road}
        number={ROADS.findIndex((r) => r.id === screen.road) + 1}
        sound={soundOn}
        onFinish={(inputs, crashes, state) => finished(screen.road, screen.seed, screen.stamp, inputs, crashes, state)}
        onQuit={() => setScreen({ kind: 'roads' })}
      />
    );
  } else if (screen.kind === 'saving') {
    body = <Centre><h2 className="cr-title" tabIndex={-1}>Plugging in…</h2><p className="cr-sub">Checking your run.</p></Centre>;
  } else if (screen.kind === 'finish' && save) {
    body = <FinishScreen save={save} road={screen.road} reply={screen.reply} was={screen.was} onAgain={() => start(screen.road)} onNext={start} onRoads={() => setScreen({ kind: 'roads' })} onDone={() => setScreen({ kind: 'done' })} />;
  } else if (screen.kind === 'done') {
    body = <DoneToday />;
  } else if (screen.kind === 'off') {
    body = <Centre><HubButtons /><h2 className="cr-title" tabIndex={-1}>Circuit Racer is switched off</h2><p className="cr-sub">Your teacher has switched it off for your class for now.</p></Centre>;
  } else {
    body = <RoadPicker save={save} busy={busy} onPick={start} problem={problem} extra={extra} />;
  }

  return <div className="cr-window">{body}</div>;
}

function Centre({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('h2')?.focus();
  }, []);
  return <div className="cr-centre" ref={ref}>{children}</div>;
}

function Stars({ clean, charged }: { clean: boolean; charged: boolean }) {
  return (
    <span className="cr-stars" aria-label={`${Number(clean) + Number(charged)} of 2 stars`}>
      <span className={clean ? 'cr-star cr-star--on' : 'cr-star'} title="No crash">★</span>
      <span className={charged ? 'cr-star cr-star--on' : 'cr-star'} title="Battery over half">★</span>
    </span>
  );
}

function RoadPicker({ save, busy, onPick, problem, extra }: { save: CircuitSave | null; busy: boolean; onPick: (road: string) => void; problem: string | null; extra?: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  // 1 to 6 pick a road.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const road = ROADS[n - 1];
      if (save && road && roadOpen(save.roads, road.id)) onPick(road.id);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [save, onPick]);

  return (
    <div className="cr-picker">
      <div className="cr-picker__bar">
        <HubButtons />
        {save && <span className="cr-chip">{leftText(save.left)}</span>}
      </div>
      <h1 className="cr-picker__title" ref={heading} tabIndex={-1}>Circuit Racer</h1>
      <p className="cr-picker__world">World 1 · The Motherboard</p>
      {problem && <p className="cr-problem" role="alert">{problem}</p>}
      {!save ? (
        !problem && <p className="cr-sub">Powering up…</p>
      ) : (
        <ol className="cr-roads">
          {ROADS.map((r, i) => {
            const p = save.roads[r.id];
            const open = roadOpen(save.roads, r.id);
            return (
              <li key={r.id}>
                <button type="button" className={`cr-road${open ? '' : ' cr-road--locked'}${p ? ' cr-road--done' : ''}`} disabled={!open || busy} onClick={() => onPick(r.id)}>
                  <span className="cr-road__num">{i + 1}</span>
                  <span className="cr-road__name">{r.name}</span>
                  {p ? (
                    <span className="cr-road__best">
                      <span aria-hidden="true">{MEDAL_ICON[p.medal]}</span> {MEDAL_WORD[p.medal]} · {timeText(p.best)} <Stars clean={p.clean} charged={p.charged} />
                    </span>
                  ) : (
                    <span className="cr-road__best">{open ? `Gold under ${MEDAL_SECONDS[r.id]?.gold ?? '?'}s` : '🔒 Finish the road before'}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="cr-keys">Arrows or W A S D: steer and speed · Space: jump · Enter: go · Esc: back</p>
      {extra}
    </div>
  );
}

function FinishScreen({ save, road, reply, was, onAgain, onNext, onRoads, onDone }: {
  save: CircuitSave; road: string; reply: FinishReply; was: number | null;
  onAgain: () => void; onNext: (road: string) => void; onRoads: () => void; onDone: () => void;
}) {
  const i = ROADS.findIndex((r) => r.id === road);
  const next = ROADS[i + 1];
  const nextOpen = next && roadOpen(save.roads, next.id);
  const out = reply.left === 0;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const main = out ? onDone : nextOpen ? () => onNext(next.id) : onAgain;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); main(); }
      else if (e.code === 'KeyR' && !out) onAgain();
      else if (e.code === 'Escape') onRoads();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [main, out, onAgain, onRoads]);
  const best = reply.result === 'best' && was !== null;

  return (
    <div className="cr-finish">
      <div className="cr-finish__card">
        <p className="cr-finish__road">{i + 1}. {ROADS[i].name}</p>
        <h2 className="cr-finish__title" ref={heading} tabIndex={-1}>
          <span aria-hidden="true">{MEDAL_ICON[reply.medal]}</span> {MEDAL_WORD[reply.medal]}!
        </h2>
        <p className="cr-finish__time">{timeText(reply.steps)}{best && <span className="cr-new"> New best!</span>}</p>
        <ul className="cr-finish__stars">
          <li className={reply.clean ? 'cr-on' : ''}><span aria-hidden="true">★</span> No crash{reply.clean ? '' : ' (not this time)'}</li>
          <li className={reply.charged ? 'cr-on' : ''}><span aria-hidden="true">★</span> Battery over half ({Math.round(reply.battery)}%)</li>
        </ul>
        {reply.medal !== 'gold' && MEDAL_SECONDS[road] && (
          <p className="cr-sub">{reply.medal === 'bronze' ? `Silver under ${MEDAL_SECONDS[road].silver}s` : `Gold under ${MEDAL_SECONDS[road].gold}s`}</p>
        )}
        <p className="cr-chip">{out ? `That’s your ${FINISHES_A_DAY} races for today!` : leftText(reply.left)}</p>
        <div className="cr-finish__buttons">
          {out ? (
            <button type="button" className="cr-btn cr-btn--go" onClick={onDone}>All done (Enter)</button>
          ) : (
            <>
              {nextOpen && <button type="button" className="cr-btn cr-btn--go" onClick={() => onNext(next.id)}>Next road (Enter)</button>}
              <button type="button" className={nextOpen ? 'cr-btn' : 'cr-btn cr-btn--go'} onClick={onAgain}>Race again ({nextOpen ? 'R' : 'Enter'})</button>
            </>
          )}
          <button type="button" className="cr-btn cr-btn--ghost" onClick={onRoads}>Roads (Esc)</button>
        </div>
      </div>
    </div>
  );
}

function DoneToday() {
  const [ms, setMs] = useState(() => msToNzMidnight(Date.now()));
  useEffect(() => {
    const t = setInterval(() => setMs(msToNzMidnight(Date.now())), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <Centre>
      <HubButtons />
      <h2 className="cr-title" tabIndex={-1}>All done for today. See you tomorrow!</h2>
      <p className="cr-sub">You’ve finished your {FINISHES_A_DAY} roads for today.</p>
      <p className="cr-countdown" aria-label="Time until new races">
        New races in {h}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
      </p>
    </Centre>
  );
}
