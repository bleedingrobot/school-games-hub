/**
 * Order Up! (docs/ORDERUP-PLAN.md): the level road, the worked example on a level's first open, a set of eight bags, and
 * the set's result. The screens only show what the backend says; the server makes the bags and replays each one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ORDERUP } from '../../../shared/orderup/config';
import type { BagEvent } from '../../../shared/orderup/play';
import type { KeptSet } from '../../../shared/orderup/server';
import { speak, stopSpeaking, useReadAloud } from '../../speech';
import { OrderUpError, type BagReply, type OrderUpBackend, type OrderUpState } from './backend';
import { BagPlay, OrderCard } from './BagPlay';
import { EXAMPLES, exampleLines } from './look';
import { BADGES, LEVEL_NAMES, VOICE_FOLDER, WORDS } from './words';
import './orderup.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'road' }
  | { kind: 'example'; level: number; then: KeptSet | null }
  | { kind: 'bag'; set: KeptSet; slot: number; guided: boolean; sending: boolean }
  | { kind: 'result'; set: KeptSet; reply: BagReply };

interface Props {
  backend: OrderUpBackend;
  /** Back to the Activities page (the preview has none). */
  onExit?: () => void;
  extra?: ReactNode;
}

const levelName = (level: number) => LEVEL_NAMES[level] ?? `Level ${level}`;

export function OrderUpGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<OrderUpState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const read = useReadAloud({ defaultOn: true });
  const fail = useCallback((e: unknown) => setFailed(e instanceof OrderUpError ? e.message : WORDS.wentWrong), []);
  const say = useCallback((text: string) => {
    if (read.on) speak(text, VOICE_FOLDER);
  }, [read.on]);
  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    backend.load().then((s) => {
      setState(s);
      setScreen({ kind: 'road' });
    }, fail);
  }, [backend, fail]);

  const start = (level: number) =>
    backend.start(level).then((set) => {
      const seen = state?.seen.includes(`level-${level}`) ?? true;
      if (!seen && EXAMPLES[level]) setScreen({ kind: 'example', level, then: set });
      else setScreen({ kind: 'bag', set, slot: 0, guided: false, sending: false });
    }, fail);

  const exampleDone = (level: number, then: KeptSet | null) => {
    const kind = `level-${level}`;
    if (!state?.seen.includes(kind)) {
      setState((s) => s && { ...s, seen: [...s.seen, kind] });
      backend.markSeen([kind]).catch(() => undefined);
    }
    setScreen(then ? { kind: 'bag', set: then, slot: 0, guided: true, sending: false } : { kind: 'road' });
  };

  const bagDone = (set: KeptSet, slot: number, events: BagEvent[]) => {
    setScreen({ kind: 'bag', set, slot, guided: false, sending: true });
    backend.bag(set.seed, slot, events).then((reply) => {
      if (reply.done < ORDERUP.setSize) {
        setScreen({ kind: 'bag', set, slot: reply.done, guided: false, sending: false });
        return;
      }
      if (reply.passed !== undefined && reply.open !== undefined) setState((s) => s && { ...s, passed: reply.passed!, open: reply.open! });
      setScreen({ kind: 'result', set, reply });
    }, fail);
  };

  let body: ReactNode;
  if (failed) body = <p className="ou-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="ou-message">…</p>;
  else if (screen.kind === 'road') body = <Road state={state} onStart={start} onShow={(level) => setScreen({ kind: 'example', level, then: null })} />;
  else if (screen.kind === 'example') body = <Example level={screen.level} say={say} onDone={() => exampleDone(screen.level, screen.then)} />;
  else if (screen.kind === 'bag') {
    const { set, slot } = screen;
    body = (
      <div className="ou-set">
        <SetBar set={set} slot={slot} />
        {screen.sending ? (
          <p className="ou-message ou-message--order" role="status">{WORDS.orderUp}</p>
        ) : (
          <BagPlay key={`${set.seed}-${slot}`} text={set.bags[slot].text} help={set.help} guided={screen.guided} say={say} onDone={(events) => bagDone(set, slot, events)} />
        )}
      </div>
    );
  } else body = <Result set={screen.set} reply={screen.reply} state={state} say={say} onAgain={() => start(screen.set.level)} onNext={start} onRoad={() => setScreen({ kind: 'road' })} />;

  return (
    <div className="ou-root">
      <div className="ou-bar">
        {onExit && (
          <button type="button" className="ou-button" onClick={onExit}>
            <span aria-hidden="true">←</span> {WORDS.home}
          </button>
        )}
        <h2 className="ou-title">{WORDS.title}</h2>
        {read.available && (
          <button type="button" className="ou-button" aria-pressed={read.on} onClick={() => read.setOn(!read.on)}>
            {read.on ? WORDS.readOn : WORDS.readOff}
          </button>
        )}
      </div>
      {body}
      {extra}
    </div>
  );
}

/** The level road: seven bags, passed, open, locked or still to come. */
function Road({ state, onStart, onShow }: { state: OrderUpState; onStart: (level: number) => void; onShow: (level: number) => void }) {
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="ou-road-wrap">
      <p className="ou-lead" tabIndex={-1} ref={heading}>{WORDS.road}</p>
      <ol className="ou-road">
        {Array.from({ length: ORDERUP.levels }, (_, i) => i + 1).map((level) => {
          const passed = level <= state.passed;
          const built = level <= state.live;
          const open = built && level <= state.open;
          const status = passed ? WORDS.passedMark : !built ? WORDS.soon : !open ? WORDS.locked : '';
          return (
            <li key={level} className={`ou-stop${passed ? ' ou-stop--passed' : ''}${open ? ' ou-stop--open' : ''}`}>
              <span className="ou-stop__bag" aria-hidden="true">{passed ? '✓' : level}</span>
              <span className="ou-stop__text">
                <strong>Level {level}: {levelName(level)}</strong>
                {status && <span className="ou-stop__status">{status}</span>}
              </span>
              {open && (
                <span className="ou-stop__buttons">
                  <button type="button" className="ou-button ou-button--go" onClick={() => onStart(level)}>{passed ? WORDS.again : WORDS.start}</button>
                  {EXAMPLES[level] && <button type="button" className="ou-button ou-button--quiet" onClick={() => onShow(level)}>{WORDS.showMe}</button>}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The bar of eight bags in a set. */
function SetBar({ set, slot }: { set: KeptSet; slot: number }) {
  return (
    <div className="ou-setbar">
      <span>Level {set.level}: {levelName(set.level)}</span>
      <span className="ou-setbar__bags" aria-label={WORDS.bagOf(slot + 1, set.bags.length)}>
        {set.bags.map((_, i) => <span key={i} className={`ou-setbar__bag${i < slot ? ' ou-setbar__bag--done' : i === slot ? ' ou-setbar__bag--now' : ''}`} />)}
      </span>
    </div>
  );
}

/** The worked example, one line at a time: each line does one step, marked in its rule's colour, with one sentence why. */
function Example({ level, say, onDone }: { level: number; say: (t: string) => void; onDone: () => void }) {
  const lines = useMemo(() => exampleLines(EXAMPLES[level]), [level]);
  const [shown, setShown] = useState(1);
  const line = lines[shown - 1];
  useEffect(() => {
    say(line.step ? `${line.why} ${line.step}.` : line.why);
  }, [line, say]);
  return (
    <div className="ou-layout">
      <OrderCard lit={line.rule} />
      <section className="ou-bag" aria-label={WORDS.workedTitle(levelName(level))}>
        <h3 className="ou-example__title">{WORDS.workedTitle(levelName(level))}</h3>
        <ol className="ou-example">
          {lines.slice(0, shown).map((l, i) => (
            <li key={i} className={i === shown - 1 ? 'ou-example__line ou-example__line--now' : 'ou-example__line'}>
              <span className="ou-example__expr">{i === 0 ? l.before : `= ${l.before}`}</span>
              {l.step && <span className={`ou-example__step ou-rule--${l.rule}`}>{l.step}</span>}
              <span className="ou-example__why">{l.why}</span>
            </li>
          ))}
        </ol>
        {shown < lines.length ? (
          <button type="button" className="ou-button ou-button--go" onClick={() => setShown(shown + 1)}>{WORDS.workedNext}</button>
        ) : (
          <button type="button" className="ou-button ou-button--go" onClick={onDone}>{WORDS.workedGo}</button>
        )}
      </section>
    </div>
  );
}

/** How the set went: passed (maybe a new level and its achievement) or not yet. */
function Result({ set, reply, state, say, onAgain, onNext, onRoad }: {
  set: KeptSet;
  reply: BagReply;
  state: OrderUpState;
  say: (t: string) => void;
  onAgain: () => void;
  onNext: (level: number) => void;
  onRoad: () => void;
}) {
  const title = reply.newLevel ? WORDS.passedLevel(levelName(set.level)) : reply.passedSet ? WORDS.passedAgain : WORDS.setDone(reply.good, set.bags.length);
  const next = set.level + 1;
  const canNext = reply.newLevel && next <= state.open;
  useEffect(() => {
    say(reply.passedSet ? title : `${title}. ${WORDS.notYet}`);
  }, [say, title, reply.passedSet]);
  return (
    <div className="ou-result">
      <h3>{title}</h3>
      <p>{WORDS.setDone(reply.good, set.bags.length)}</p>
      {reply.newLevel && <p className="ou-badge">{WORDS.newBadge(BADGES[set.level])}</p>}
      {!reply.passedSet && <p>{WORDS.notYet}</p>}
      <p className="ou-result__buttons">
        {canNext && <button type="button" className="ou-button ou-button--go" onClick={() => onNext(next)}>{WORDS.nextLevel}</button>}
        <button type="button" className={canNext ? 'ou-button' : 'ou-button ou-button--go'} onClick={onAgain}>{WORDS.again}</button>
        <button type="button" className="ou-button ou-button--quiet" onClick={onRoad}>{WORDS.backToRoad}</button>
      </p>
    </div>
  );
}
