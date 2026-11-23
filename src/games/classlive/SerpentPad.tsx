/**
 * Serpent Chain, the pupil's screen (docs/CLASSLIVE-PLAN.md section 3): their own box as a big sum, a number pad (or the
 * real keyboard), and a gentle reply after each answer. Works at their own pace; never shows anyone else's results.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import { BODY, SERPENT_LEVEL_NAMES, TRIES, type SerpentBox, type SerpentReply } from '../../../shared/classlive/serpent';
import type { ClassLiveLink } from './link';
import './controller.css';

const MAX_LEN = 4;
type Mine = Extract<PlayerView['game'], { kind: 'serpent' }>;
type Say =
  | { n: number; kind: 'right'; value: number; head: boolean }
  | { n: number; kind: 'shown'; value: number; working: string; head: boolean }
  | { n: number; kind: 'again' }
  | { n: number; kind: 'gentle'; text: string };

const opText = (op: SerpentBox['op']) => (op === '-' ? '−' : op);
const opWords = (op: SerpentBox['op']) => (op === '-' ? 'minus' : op === '+' ? 'plus' : op === '×' ? 'times' : 'divided by');
const PAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

function Coil() {
  return (
    <svg className="cl-s-coil" viewBox="0 0 120 120" role="img" aria-label="A little coiled serpent">
      <path d="M60 104 C20 104 14 76 44 72 C84 66 98 50 74 40 C52 32 34 44 46 58" fill="none" stroke="#6fdc7a" strokeWidth="16" strokeLinecap="round" />
      <path d="M60 104 C20 104 14 76 44 72 C84 66 98 50 74 40 C52 32 34 44 46 58" fill="none" stroke="#2e9c4a" strokeWidth="16" strokeLinecap="round" strokeDasharray="2 20" />
      <circle cx="50" cy="60" r="12" fill="#6fdc7a" />
      <circle cx="46" cy="57" r="2.6" fill="#10301a" /><circle cx="55" cy="57" r="2.6" fill="#10301a" />
      <path d="M50 72 l0 8 m0 0 l-3 4 m3 -4 l3 4" stroke="#ff6b7a" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Scales({ at }: { at: number }) {
  return (
    <ol className="cl-s-scales" aria-label={`Progress: ${Math.min(at, BODY)} of ${BODY} scales`}>
      {Array.from({ length: BODY }, (_, i) => (
        <li key={i} className={`cl-s-scale${i < at ? ' is-on' : ''}${i === at - 1 && at <= BODY ? ' is-new' : ''}${i === BODY - 1 ? ' is-head' : ''}`} aria-hidden="true" />
      ))}
    </ol>
  );
}

export function SerpentPad({ link, room, view, me, setMe, setView }: { link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null; setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void }) {
  const [text, setText] = useState('');
  const [say, setSay] = useState<Say | null>(null);
  const [busy, setBusy] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;
  const busyRef = useRef(false);
  const sayN = useRef(0);
  const meRef = useRef(me);
  meRef.current = me;

  const mg: Mine | null = me && me.game.kind === 'serpent' ? me.game : null;
  const box = mg?.box ?? null;
  const boxRef = useRef(box);
  boxRef.current = box;
  const level = view.game.kind === 'serpent' ? SERPENT_LEVEL_NAMES[view.game.level] : '';

  const add = useCallback((k: string) => setText((t) => (t.length >= MAX_LEN ? t : t === '0' ? k : t + k)), []);
  const back = useCallback(() => setText((t) => t.slice(0, -1)), []);
  const clear = useCallback(() => setText(''), []);

  const withBox = (b: SerpentBox | null) => {
    const cur = meRef.current;
    if (!cur || cur.game.kind !== 'serpent') return;
    setMe({ ...cur, game: { ...cur.game, box: b, at: b ? b.box : cur.game.at } });
  };

  const send = useCallback(async () => {
    const b = boxRef.current;
    const t = textRef.current;
    if (!t || !b || busyRef.current || room === null) return;
    busyRef.current = true; setBusy(true);
    const gentle = (text: string) => setSay({ n: ++sayN.current, kind: 'gentle', text });
    try {
      const r = await link.send({ action: 'play', room, box: b.box, value: Number(t) });
      const body = r.body as { reply?: SerpentReply; me?: PlayerView; reason?: string; box?: SerpentBox | null };
      if (r.status === 200 && body.reply) {
        const reply = body.reply;
        if (body.me) setMe(body.me);
        if (reply.result === 'again') {
          setSay({ n: ++sayN.current, kind: 'again' });
        } else {
          const head = !!reply.next && reply.next.box === BODY;
          setSay(reply.result === 'right' ? { n: ++sayN.current, kind: 'right', value: reply.value, head } : { n: ++sayN.current, kind: 'shown', value: reply.value, working: reply.working, head });
        }
        setText('');
      } else if (r.status === 409 && body.reason === 'too_soon') {
        gentle('One at a time!');
      } else if (r.status === 409 && (body.reason === 'stale' || body.reason === 'done')) {
        withBox(body.box ?? null);
        setText('');
        gentle(body.box ? 'Here is your next box.' : '');
      } else if (r.status === 404 || (r.status === 409 && body.reason === 'over')) {
        setView((v) => (v ? { ...v, state: 'over' } : v));
      } else if (r.status === 409 && body.reason === 'lobby') {
        gentle('Wait for the start!');
      } else if (r.status === 503) {
        gentle('The class is busy. Try again!');
      } else {
        gentle("That didn't send. Try again!");
      }
    } catch {
      gentle("That didn't send. Try again!");
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, [link, room, setMe, setView]);

  const live = view.state === 'live' && !!box;
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      let handled = true;
      if (/^[0-9]$/.test(k)) add(k);
      else if (k === 'Backspace') back();
      else if (k === 'Escape') clear();
      else if (k === 'Enter') void send();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, add, back, clear, send]);

  if (view.state === 'over') {
    return (
      <div className="cl-c-center">
        <div className="cl-c-bigstar" aria-hidden="true">🐍</div>
        <h1 className="cl-c-title">Finished! You got {mg?.right ?? 0} right</h1>
        <p className="cl-c-say">You worked through {mg?.at ?? 0} {(mg?.at ?? 0) === 1 ? 'box' : 'boxes'}.</p>
        <p className="cl-c-look">Look at the big screen as the serpent wakes!</p>
      </div>
    );
  }

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center">
        <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
        <Coil />
        <p className="cl-c-say">Work along the chain. Write each answer.</p>
        {level && <p className="cl-s-level">{level}</p>}
      </div>
    );
  }

  if (!box) {
    return (
      <div className="cl-c-center" aria-live="polite">
        <div className="cl-c-bigstar" aria-hidden="true">🎉</div>
        <h1 className="cl-c-title">You've finished the whole serpent!</h1>
        <p className="cl-c-say">{mg?.right ?? 0} right so far.</p>
        <p className="cl-c-look">Look at the big screen.</p>
      </div>
    );
  }

  const sum = `${box.from} ${opText(box.op)} ${box.by} = ?`;
  const at = mg?.at ?? box.box;
  return (
    <>
      <header className="cl-s-top">
        <p className="cl-s-box">{box.tail ? 'Bonus tail box' : `Box ${box.box + 1} of ${BODY}`}</p>
        <Scales at={at} />
      </header>

      <p className="cl-s-sum" aria-label={`${box.from} ${opWords(box.op)} ${box.by} equals what?`}>{sum}</p>

      <div className="cl-c-display" role="status" aria-label="Your answer">
        {text ? <span>{text}</span> : <span className="cl-c-display__hint">?</span>}
        <i className="cl-c-caret" aria-hidden="true" />
      </div>

      <div className="cl-c-fb cl-s-fb" aria-live="polite">
        {say && <SayCard key={say.n} say={say} box={box} />}
        {!say && <p className="cl-s-hint">{box.triesLeft < TRIES ? 'Have another go!' : 'Write the answer, then check it.'}</p>}
      </div>

      <div className="cl-c-keys cl-s-keys" role="group" aria-label="Number pad">
        {PAD.map((k) => <button key={k} type="button" className="cl-c-key" aria-label={k} onClick={() => add(k)}>{k}</button>)}
        <button type="button" className="cl-c-key cl-c-key--fn1" aria-label="Backspace" onClick={back}>⌫</button>
        <button type="button" className="cl-c-key" aria-label="0" onClick={() => add('0')}>0</button>
        <button type="button" className="cl-c-key cl-c-key--fn1 cl-c-key--clear" aria-label="Clear" onClick={clear}>Clear</button>
        <button type="button" className="cl-c-send cl-s-send" disabled={busy || !text} onClick={() => void send()}>Check ✓</button>
      </div>
      {box.triesLeft < TRIES && <p className="cl-s-tries" aria-label={`${box.triesLeft} ${box.triesLeft === 1 ? 'try' : 'tries'} left`}>{box.triesLeft} {box.triesLeft === 1 ? 'try' : 'tries'} left</p>}
    </>
  );
}

function SayCard({ say, box }: { say: Say; box: SerpentBox }) {
  switch (say.kind) {
    case 'right':
      return (
        <div className="cl-s-card cl-s-card--right">
          <p className="cl-s-card__head">✓ {say.value}!</p>
          {say.head && <p className="cl-s-card__text">🐍 You reached the head! Bonus tail unlocked.</p>}
        </div>
      );
    case 'shown':
      return (
        <div className="cl-s-card cl-s-card--shown">
          <p className="cl-s-card__text">The answer was {say.value}: {say.working.replace(/ - /, ' − ')}</p>
          <p className="cl-s-card__head cl-s-card__head--small">Carry on from {say.value}</p>
          {say.head && <p className="cl-s-card__text">🐍 You reached the head! Bonus tail unlocked.</p>}
        </div>
      );
    case 'again':
      return (
        <div className="cl-s-card cl-s-card--again">
          <p className="cl-s-card__text">Not quite, have another go!{box.triesLeft > 0 ? ` (${box.triesLeft} ${box.triesLeft === 1 ? 'try' : 'tries'} left)` : ''}</p>
        </div>
      );
    case 'gentle':
      return say.text ? <div className="cl-s-card"><p className="cl-s-card__text">{say.text}</p></div> : null;
  }
}
