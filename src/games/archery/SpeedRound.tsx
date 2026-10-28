/**
 * A question set, the only way to earn coins (docs/ARCHERY-PLAN.md, section 5, and docs/ARCHERY-QUESTIONS-PLAN.md):
 *
 * - the speed round (Home or the Armory): 10 questions, the first has 10 seconds, the next 9 … down to 5;
 * - the loot chest after a fight: 3 questions, 10 seconds each, more coins for a win;
 * - a restock between rounds of a bot fight: 3 questions, 10 seconds each.
 *
 * The server sends one question at a time from the pupil's maths focus and marks it. Each right answer in time earns
 * coins (plus a streak bonus from the third in a row). A wrong answer moves straight on; so does running out of time.
 * Every question is shown with the hub's own question box (QuestionModal).
 */
import { useEffect, useRef, useState } from 'react';
import {
  CHEST_LOSS_COINS, CHEST_WIN_COINS, COINS_PER_RIGHT, DAILY_COINS, FIRST_SECONDS, LAST_SECONDS, POINT_AT, ROUND_QUESTIONS, SHORT_QUESTIONS,
  SHORT_SECONDS, STREAK_AT, STREAK_BONUS, limitMs, setSize,
} from '../../../shared/archery/speed';
import type { ArcheryApi, RoundQuestion, SetRequest } from '../../data/archery';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { CoinCount } from './CoinCount';
import { factText } from './factText';
import { LootChest, RestockQuiver } from './LootArt';

/** The question box's feedback pause, shortened: a speed round keeps moving (×0.6 of the usual). */
const FEEDBACK_SCALE = 0.6;
/** How long "Time's up!" shows before the next question (ms). */
const TIMEOUT_PAUSE = 1400;

type Phase =
  | { kind: 'intro' }
  | { kind: 'starting' }
  | { kind: 'question'; seed: string; earns: boolean; total: number; perRight: number; q: RoundQuestion }
  | { kind: 'timed-out'; seed: string; earns: boolean; total: number; fact: string; next: RoundQuestion | null }
  | { kind: 'done'; earns: boolean; right: number; total: number; point: boolean }
  | { kind: 'problem'; message: string };

export function SpeedRound({ api, coins, coinsLeft, set = { kind: 'speed' }, won, onCoins, onCoinsLeft, onExit, exitLabel = 'Back', timeScale = 1 }: {
  api: ArcheryApi;
  coins: number;
  /** Coins maths can still earn today. */
  coinsLeft: number;
  /** Which set: a speed round (the default), a loot chest or a restock. */
  set?: SetRequest;
  /** A loot chest: was the fight won (for the words before it starts)? */
  won?: boolean;
  /** The pupil's coins changed (the server's total). */
  onCoins: (total: number) => void;
  onCoinsLeft: (left: number) => void;
  onExit: () => void;
  exitLabel?: string;
  /** Tests set 0 to skip the pauses. */
  timeScale?: number;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [earned, setEarned] = useState(0);
  const [right, setRight] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(FIRST_SECONDS);
  const kind = set.kind;
  const speed = kind === 'speed';
  const title = kind === 'chest' ? 'Loot chest' : kind === 'restock' ? 'Restock' : 'Speed round';
  const { soundOn } = useSound();
  const heading = useRef<HTMLHeadingElement>(null);
  const shownAt = useRef(0);
  const answered = useRef(false);
  const gone = useRef(false);
  useEffect(() => () => {
    gone.current = true;
  }, []);

  useEffect(() => {
    if (phase.kind === 'intro' || phase.kind === 'done' || phase.kind === 'problem') heading.current?.focus();
  }, [phase.kind]);

  async function start() {
    setPhase({ kind: 'starting' });
    setEarned(0);
    setRight(0);
    const r = await api.roundStart(set);
    if (gone.current) return;
    if (!r.ok) {
      setPhase({ kind: 'problem', message: r.message });
      return;
    }
    onCoinsLeft(r.value.coinsLeft);
    ask(r.value.seed, r.value.earns, r.value.questions, r.value.perRight, { question: r.value.question, limitMs: r.value.limitMs });
  }

  function ask(seed: string, earns: boolean, total: number, perRight: number, q: RoundQuestion) {
    answered.current = false;
    shownAt.current = performance.now();
    setSecondsLeft(Math.ceil(q.limitMs / 1000));
    setPhase({ kind: 'question', seed, earns, total, perRight, q });
  }

  // The countdown. When it runs out, the server is told and the next question comes.
  useEffect(() => {
    if (phase.kind !== 'question') return;
    const { seed, earns, total, perRight, q } = phase;
    const tick = window.setInterval(() => {
      const left = q.limitMs - (performance.now() - shownAt.current);
      setSecondsLeft(Math.max(0, Math.ceil(left / 1000)));
      if (left > 0 || answered.current) return;
      answered.current = true;
      window.clearInterval(tick);
      void (async () => {
        const r = await api.roundAnswer(seed, q.question.slot, null, q.limitMs);
        if (gone.current) return;
        if (!r.ok) {
          setPhase({ kind: 'problem', message: r.message });
          return;
        }
        if (soundOn) playSound('end');
        setPhase({ kind: 'timed-out', seed, earns, total, fact: factText(q.question, r.value.answer), next: r.value.next });
        window.setTimeout(() => {
          if (gone.current) return;
          if (r.value.next) ask(seed, earns, total, perRight, r.value.next);
          else finish(earns, r.value.right, total, !!r.value.point);
        }, TIMEOUT_PAUSE * timeScale);
      })();
    }, 100);
    return () => window.clearInterval(tick);
    // A new question restarts the clock; nothing else should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind === 'question' ? phase.q.question.slot : -1, phase.kind === 'question' ? phase.seed : '']);

  function finish(earns: boolean, rightCount: number, total: number, point: boolean) {
    setPhase({ kind: 'done', earns, right: rightCount, total, point });
  }

  // The next step after an answer, kept until the question box has shown its feedback.
  const after = useRef<{ next: RoundQuestion | null; right: number; point: boolean } | null>(null);

  async function submit(value: number, ms: number): Promise<MarkedAnswer> {
    if (phase.kind !== 'question') throw new Error('No question');
    if (answered.current) throw new Error('Too late: the time ran out.');
    answered.current = true;
    const { seed, q } = phase;
    const r = await api.roundAnswer(seed, q.question.slot, value, ms);
    if (!r.ok) {
      // Let them press again (the question box says why).
      answered.current = false;
      throw new Error(r.message);
    }
    const v = r.value;
    after.current = { next: v.next, right: v.right, point: !!v.point };
    setRight(v.right);
    if (v.coins > 0) {
      setEarned((e) => e + v.coins);
      if (v.total !== undefined) onCoins(v.total);
    }
    const reward = v.coins > 0 ? `+${v.coins} coins` : v.correct && phase.earns ? 'Right, but just too slow for coins' : undefined;
    return { correct: v.correct, fact: factText(q.question, v.answer), boxBefore: 0, boxAfter: 0, answer: v.answer, ...(reward ? { reward } : {}) };
  }

  function done() {
    if (phase.kind !== 'question') return;
    const a = after.current;
    after.current = null;
    if (!a) return;
    if (a.next) ask(phase.seed, phase.earns, phase.total, phase.perRight, a.next);
    else finish(phase.earns, a.right, phase.total, a.point);
  }

  const slot = phase.kind === 'question' ? phase.q.question.slot : 0;
  const total = phase.kind === 'question' || phase.kind === 'timed-out' ? phase.total : setSize(kind);
  const earns = phase.kind === 'question' || phase.kind === 'timed-out' ? phase.earns : coinsLeft > 0;
  const perRight = phase.kind === 'question' ? phase.perRight : kind === 'chest' ? (won ? CHEST_WIN_COINS : CHEST_LOSS_COINS) : COINS_PER_RIGHT;
  const leftToday = coinsLeft > 0
    ? `Coins from maths left today: ${coinsLeft} of ${DAILY_COINS}.`
    : `You've earned today's ${DAILY_COINS} coins from maths. You can still practise (no coins), and your maths still counts.`;

  return (
    <section className="ar-speed" aria-labelledby="ar-speed-title">
      <div className="ar-speed__card">
        <div className="ar-speed__head">
          <h2 id="ar-speed-title" ref={heading} tabIndex={-1}>{title}</h2>
          <CoinCount coins={coins} />
        </div>
        {!speed && (kind === 'chest'
          ? <LootChest filled={phase.kind === 'done' ? phase.right : right} of={total} />
          : <RestockQuiver filled={phase.kind === 'done' ? phase.right : right} of={total} />)}
        {phase.kind === 'intro' && speed && (
          <>
            <p className="ar-speed__big">{ROUND_QUESTIONS} questions. The first has {FIRST_SECONDS} seconds, the next 9, then 8 … down to {LAST_SECONDS}!</p>
            <p>Each right answer in time earns <strong>{COINS_PER_RIGHT} coins</strong>, and {STREAK_AT} or more in a row earn {STREAK_BONUS} extra each. A wrong answer just moves on to the next one. Get {POINT_AT} or more right for a hub point.</p>
            <p className="ar-speed__note">{leftToday}</p>
            <div className="ar-row">
              <button type="button" className="button button--play ar-btn ar-btn--big" onClick={() => void start()}>Start</button>
              <button type="button" className="button button--light ar-btn" onClick={onExit}>{exitLabel}</button>
            </div>
          </>
        )}
        {phase.kind === 'intro' && !speed && (
          <>
            <p className="ar-speed__big">
              {kind === 'chest'
                ? `${won ? 'You won! ' : ''}Fill your chest: ${SHORT_QUESTIONS} questions, ${perRight} coins for each one right!`
                : `Restock before the next round: ${SHORT_QUESTIONS} quick questions, ${perRight} coins each!`}
            </p>
            <p>{SHORT_SECONDS} seconds for each. Get all {SHORT_QUESTIONS} right for a {STREAK_BONUS}-coin streak bonus.</p>
            {coinsLeft <= 0 && <p className="ar-speed__note">{leftToday}</p>}
            <div className="ar-row">
              <button type="button" className="button button--play ar-btn ar-btn--big" onClick={() => void start()}>{kind === 'chest' ? 'Open the chest' : 'Start'}</button>
              <button type="button" className="button button--light ar-btn ar-btn--small" onClick={onExit}>Skip</button>
            </div>
          </>
        )}
        {phase.kind === 'starting' && <p role="status">Getting your questions…</p>}
        {(phase.kind === 'question' || phase.kind === 'timed-out') && (
          <>
            <ol className="ar-pips" aria-label={`Question ${slot + 1} of ${total}`}>
              {Array.from({ length: total }, (_, i) => (
                <li key={i} data-state={i < slot ? 'done' : i === slot ? 'now' : undefined}>{limitMs(i, kind) / 1000}s</li>
              ))}
            </ol>
            <p className="ar-speed__note">Right so far: {right}. Coins {speed ? 'this round' : 'so far'}: {earned}.{earns ? '' : ' (Practice: no coins.)'}</p>
          </>
        )}
        {phase.kind === 'timed-out' && (
          <p className="ar-speed__timeout" role="status">Time's up! {phase.fact}</p>
        )}
        {phase.kind === 'done' && (
          <>
            <p className="ar-speed__big">You got {phase.right} of {phase.total} right{phase.earns ? ` and earned ${earned} coins` : ''}!</p>
            {phase.point && <p>+1 hub point for {POINT_AT} or more right.</p>}
            {!phase.earns && <p className="ar-speed__note">That was practice: no coins, but your maths still counts.</p>}
            <div className="ar-row">
              {speed && <button type="button" className="button button--play ar-btn" onClick={() => void start()}>Another round</button>}
              <button type="button" className={`button ${speed ? 'button--light' : 'button--play'} ar-btn`} onClick={onExit}>{exitLabel}</button>
            </div>
          </>
        )}
        {phase.kind === 'problem' && (
          <>
            <p role="alert">{phase.message}</p>
            <div className="ar-row">
              <button type="button" className="button button--play ar-btn" onClick={() => setPhase({ kind: 'intro' })}>Try again</button>
              <button type="button" className="button button--light ar-btn" onClick={onExit}>{exitLabel}</button>
            </div>
          </>
        )}
      </div>
      {phase.kind === 'question' && (
        <QuestionModal
          question={{ ...phase.q.question, id: phase.q.question.slot }}
          title={`Question ${slot + 1} of ${total}`}
          spot={title}
          note={earns ? `${phase.perRight} coins if you're quick!` : 'Practice: no coins'}
          secondsLeft={secondsLeft}
          scribble={false}
          timeScale={FEEDBACK_SCALE * timeScale}
          onSubmit={submit}
          onDone={done}
        />
      )}
    </section>
  );
}
