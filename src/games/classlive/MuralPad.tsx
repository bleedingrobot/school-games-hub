/**
 * Mystery Mural, the pupil's screen (docs/CLASSLIVE-PLAN.md section 4): answer a maths question (the shared QuestionModal,
 * marked on the server), wait for the ring to fill, and every right answer flips a tile at random; the pupil sees the tiles they
 * flipped on their own little mural. When the time is up, they get one guess, picking from six riddles. Never shows anyone else's results.
 *
 * The server's `nextAt` is in session time (ms since the room started), so the wait is worked out from the `now` the
 * server sent back and the room's `startedAt`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CLUES, COLS, PICTURES, ROWS, TILES, type Picture } from '../../../shared/classlive/mural';
import type { MuralReply, PlayerView, RoomView } from '../../../shared/classlive/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { ClassLiveLink } from './link';
import { MuralPicture } from './muralPictures';
import './controller.css';

type Mine = Extract<PlayerView['game'], { kind: 'mural' }>;
type Pub = Extract<RoomView['game'], { kind: 'mural' }>;
type Pending = { question: PublicQuestion | null; me: PlayerView; view: RoomView; wait: number };
const LETTERS = 'ABCDEF';

const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');

/** The filling ring between answers. */
function WaitRing({ ms, onDone }: { ms: number; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), ms);
    return () => window.clearTimeout(id);
  }, [ms]);
  return (
    <div className="cl-m-wait" role="status" aria-label="Getting your next question">
      <svg viewBox="0 0 64 64" className="cl-m-ring" aria-hidden="true">
        <circle cx="32" cy="32" r="28" className="cl-m-ring__bg" />
        <circle cx="32" cy="32" r="28" className="cl-m-ring__fg" style={{ animationDuration: `${ms}ms` }} transform="rotate(-90 32 32)" />
      </svg>
      <p className="cl-c-say">Get ready…</p>
    </div>
  );
}

/** The pupil's own little mural: the picture shows only through the tiles they flipped (newest one glows). */
function MyMural({ picture, tiles }: { picture: Picture; tiles: number[] }) {
  const mine = new Set(tiles);
  const newest = tiles.length ? tiles[tiles.length - 1] : -1;
  return (
    <div className="cl-m-mine" aria-label={`Your ${tiles.length} ${tiles.length === 1 ? 'tile' : 'tiles'} of the picture`}>
      <MuralPicture id={picture} small />
      <div className="cl-m-mine__grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }} aria-hidden="true">
        {Array.from({ length: TILES }, (_, i) => <i key={i} className={mine.has(i) ? (i === newest ? 'is-mine is-new' : 'is-mine') : ''} />)}
      </div>
    </div>
  );
}

export function MuralPad({ link, room, view, me, setMe, setView }: { link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null; setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void }) {
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const [trouble, setTrouble] = useState('');
  const [busy, setBusy] = useState(false);
  const [say, setSay] = useState<{ n: number; text: string; good?: boolean } | null>(null);
  const pending = useRef<Pending | null>(null);
  const queued = useRef<PublicQuestion | null>(null);
  const offset = useRef(0);
  const meRef = useRef(me);
  meRef.current = me;
  const viewRef = useRef(view);
  viewRef.current = view;
  const sayN = useRef(0);
  const busyRef = useRef(false);

  const mg: Mine | null = me && me.game.kind === 'mural' ? me.game : null;
  const pub: Pub | null = view.game.kind === 'mural' ? view.game : null;
  const live = view.state === 'live' && !!pub && !pub.revealed;

  const toast = useCallback((text: string, good?: boolean) => setSay({ n: ++sayN.current, text, good }), []);

  /** ms until the pupil's next answer is allowed, from the server's clock. */
  const waitFrom = useCallback((nextAt: number | undefined, serverNow: number | undefined): number => {
    if (typeof serverNow === 'number') offset.current = serverNow - Date.now();
    const started = viewRef.current.startedAt;
    if (typeof nextAt !== 'number' || started === null) return 0;
    return Math.max(0, Math.min(4500, nextAt - (Date.now() + offset.current - started)));
  }, []);

  // Fetch the first question (and again after a hiccup).
  useEffect(() => {
    if (!live || room === null || question || wait !== null || queued.current) return;
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      let r;
      try {
        r = await link.send({ action: 'ask', room });
      } catch {
        if (!dead) { setTrouble('We lost the connection…'); timer = setTimeout(ask, 3000); }
        return;
      }
      if (dead) return;
      const b = r.body as { question?: PublicQuestion; now?: number; reason?: string };
      if (r.status === 200 && b.question) {
        setTrouble('');
        const ms = waitFrom(meRef.current?.game.kind === 'mural' ? meRef.current.game.nextAt : undefined, b.now);
        if (ms > 150) { queued.current = b.question; setWait(ms); } else setQuestion(b.question);
      } else if (r.status === 409 && (b.reason === 'over' || b.reason === 'lobby')) {
        setView((v) => (v ? { ...v, state: b.reason === 'over' ? 'over' : 'lobby' } : v));
      } else {
        setTrouble(r.status === 503 ? 'The class is busy…' : 'Getting your question…');
        timer = setTimeout(ask, 3000);
      }
    };
    void ask();
    return () => { dead = true; if (timer) clearTimeout(timer); };
  }, [live, room, question, wait, link, setView, waitFrom]);

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const q = question as PublicQuestion;
    let out;
    try {
      out = await link.send({ action: 'answer', room, slot: q.slot, answer: value, ms });
    } catch {
      throw new Error('We lost the connection. Try again.');
    }
    const b = out.body as { right?: boolean; answer?: number; me?: PlayerView; view?: RoomView; question?: PublicQuestion; nextAt?: number; now?: number; reason?: string; error?: string };
    if (out.status !== 200) {
      if (b.reason === 'answered') { setQuestion(null); queued.current = null; throw new Error('You already did that one. Here is the next!'); }
      if (b.reason === 'too_soon') {
        const left = waitFrom(b.nextAt, b.now);
        queued.current = q; setQuestion(null); setWait(Math.max(300, left));
      }
      if (b.reason === 'over') setView((v) => (v ? { ...v, state: 'over' } : v));
      throw new Error(b.reason === 'too_soon' ? 'Wait for the ring to fill!' : String(b.error ?? 'Try again.'));
    }
    const right = b.right === true;
    const answer = b.answer as number;
    const next = b.me?.game.kind === 'mural' ? b.me.game.nextAt : undefined;
    pending.current = { question: b.question ?? null, me: b.me as PlayerView, view: b.view as RoomView, wait: waitFrom(next, b.now) };
    return { correct: right, fact: factOf(q, answer), boxBefore: 0, boxAfter: 0, answer };
  };

  const onDone = () => {
    const next = pending.current;
    pending.current = null;
    if (next?.me) setMe(next.me);
    if (next?.view) setView(() => next.view);
    setTrouble('');
    setQuestion(null);
    queued.current = next?.question ?? null;
    if (next?.question) setWait(Math.max(300, next.wait));
    else setWait(null);
    if (next?.me?.game.kind === 'mural' && next.me.game.tiles > (mg?.tiles ?? 0)) toast('You flipped a tile! ✨', true);
    else if (next?.me?.game.kind === 'mural' && next.me.game.right > (mg?.right ?? 0)) toast('Right! Your tile flips soon ✨', true);
  };

  const waitDone = useCallback(() => {
    setWait(null);
    const q = queued.current;
    queued.current = null;
    if (q) setQuestion(q);
  }, []);

  const guess = async (pick: Picture) => {
    if (busyRef.current || room === null) return;
    busyRef.current = true; setBusy(true);
    try {
      const r = await link.send({ action: 'play', room, guess: pick });
      const b = r.body as { reply?: MuralReply; me?: PlayerView; view?: RoomView; error?: string };
      if (b.me) setMe(b.me);
      if (b.view) setView(() => b.view as RoomView);
      if (r.status === 200 && b.reply) toast('Locked in! Watch the big screen for the reveal.', true);
      else toast(String(b.error ?? "That didn't send. Try again!"));
    } catch {
      toast("That didn't send. Try again!");
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center">
        <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
        <div className="cl-m-cloth" aria-hidden="true">🎨</div>
        <p className="cl-c-say">Answer maths to flip tiles. A hidden picture is waiting!</p>
      </div>
    );
  }

  const myTiles = mg?.myTiles ?? [];
  const picture = mg?.picture ?? null;
  const mural = picture ? <MyMural picture={picture} tiles={myTiles} /> : null;

  if (view.state === 'over' || pub?.revealed) {
    const pic = pub?.picture ?? null;
    return (
      <div className="cl-c-center">
        {pic && <div className="cl-m-final"><MuralPicture id={pic} label={PICTURES[pic]} /></div>}
        <h1 className="cl-c-title">{pic ? `It was ${PICTURES[pic].toLowerCase()}!` : 'Finished!'}</h1>
        {mg && (mg.gotIt > 0 ? <p className="cl-m-got">🎉 You guessed it! #{mg.gotIt}</p> : mg.picked ? <p className="cl-c-say">Not this time. Good try!</p> : null)}
        <p className="cl-c-say">You flipped {mg?.tiles ?? 0} {(mg?.tiles ?? 0) === 1 ? 'tile' : 'tiles'} and got {mg?.right ?? 0} right.</p>
        <p className="cl-c-look">Look at the big screen!</p>
      </div>
    );
  }

  if (pub?.phase === 'guess') {
    return (
      <div className="cl-m-guess">
        <h1 className="cl-c-title">{mg?.picked ? 'Locked in!' : 'Time to guess!'}</h1>
        {mural}
        {mg?.picked ? (
          <p className="cl-c-say">Watch the big screen for the reveal.</p>
        ) : (
          <>
            <p className="cl-c-say">Which riddle fits the hidden picture? You get one pick.</p>
            <div className="cl-m-riddles" role="group" aria-label="Pick a riddle">
              {pub.choices.map((c, i) => (
                <button key={c} type="button" className="cl-m-riddle" disabled={busy || !mg?.canGuess} onClick={() => void guess(c)}>
                  <b aria-hidden="true">{LETTERS[i]}</b><span>{CLUES[c]}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="cl-c-fb cl-m-fb" aria-live="polite">
          {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
        </div>
      </div>
    );
  }

  const flipsRow = (
    <p className="cl-m-flips" aria-label={`You flipped ${mg?.tiles ?? 0} tiles`}>
      <b>✨ {mg?.tiles ?? 0} {(mg?.tiles ?? 0) === 1 ? 'tile' : 'tiles'} flipped</b>
    </p>
  );

  return (
    <>
      <header className="cl-m-top">
        {flipsRow}
        <p className="cl-m-prog">{pub?.flipped ?? 0} / {TILES} tiles</p>
      </header>
      {mural}
      <p className="cl-m-hint">Keep answering! You all guess when the time is up.</p>

      <div className="cl-c-fb cl-m-fb" aria-live="polite">
        {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
      </div>

      {question ? (
        <div className="cl-m-q">
          <QuestionModal
            key={question.slot}
            question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
            title="Mystery Mural" note="Each right answer flips a tile" spot="Class Live" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
          />
        </div>
      ) : wait !== null ? (
        <WaitRing key={`${wait}-${mg?.answered ?? 0}`} ms={wait} onDone={waitDone} />
      ) : (
        <p className="cl-c-say cl-m-load" role="status">{trouble || 'Getting your question…'}</p>
      )}
    </>
  );
}
