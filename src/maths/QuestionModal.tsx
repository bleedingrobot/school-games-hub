/**
 * One maths question in a box over the game. The fact is shown big and clear; the student
 * types the answer (number pad or keyboard) or, in multiple-choice mode, taps one of four (or presses 1 to 4).
 * The keyboard works as soon as the box opens, wherever the focus is (questionKeys.ts).
 *
 * Right: a sparkle and "Correct!", then it closes. Wrong: no buzzer, nothing taken away,
 * just the whole fact ("7 × 8 = 56") for 2 seconds, then it closes. The game decides what a
 * right answer earns. Reusable by any hub game: it only knows about a `Question`.
 *
 * Parts like '3/4' are drawn as fractions ('?/8' has the blank on top), parts with words are
 * drawn smaller, and decimal questions get a point key.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { spokenLabel } from '../../shared/maths/banded';
import { fractionSteps, helpKind, hintFor, unitSteps } from '../../shared/maths/hint';
import { helpCardsFor } from '../../shared/maths/help';
import { pictureFor } from '../../shared/maths/pictures';
import { QuestionPicture } from './QuestionPicture';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { AngleNames, Figure } from './Figure';
import { isFigure } from '../../shared/maths/figure';
import { NumberPad } from './NumberPad';
import { choiceForKey, useQuestionKeys } from './questionKeys';
import { countAnswer, helpCancelled, helpKnownFacts, helpOpened, noteQuestion, questionOpened, spendSkip, spotFromTitle, STREAK_FROM, useSkipRule } from './questionLog';
import { ScribblePad } from './ScribblePad';
import { FeedbackPanel } from './FeedbackPanel';
import { useFeedbackSink } from './questionFeedback';
import './maths.css';

/** How long the feedback shows, in milliseconds. */
export const FEEDBACK_MS = { right: 800, wrong: 2000 };
const MAX_DIGITS = 3;

const PAD_KEY = 'sgh-scribble-open';
const FEEDBACK_KEY = 'sgh-feedback-open';
const readOpen = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const readPadOpen = () => readOpen(PAD_KEY);

const FRACTION = /^(?:(\d+|\?) )?(\d+|\?)\/(\d+|\?)$/;

/** Small letters, numbers and signs, with no word of two letters and no unit after a number (6.1 L, 4 h): 3x + 2, a², t. */
const ALGEBRA = /^(?=.*[a-z])(?!.*[a-z]{2})(?!.*\d\s+[a-z])[a-z\d\s+−×÷=.²³()]+$/;

/** Numbers each followed by a short unit: 9.1 km, 1/3 h, 4 h 15 min, 2 cm², 6.1 L. */
const QUANTITY = /^[\d.,/½]+ (?:[a-z]{4,12}|[a-zA-Z]{1,3})[²³]?( [\d.,/½]+ (?:[a-z]{4,12}|[a-zA-Z]{1,3})[²³]?)*$/;

/** Units written as words (one, many). Squared and cubed units (cm², m³) keep their short form. */
const UNIT_WORDS: Record<string, [string, string]> = {
  h: ['hour', 'hours'],
  min: ['minute', 'minutes'],
  km: ['kilometre', 'kilometres'],
  m: ['metre', 'metres'],
  cm: ['centimetre', 'centimetres'],
  mm: ['millimetre', 'millimetres'],
  kg: ['kilogram', 'kilograms'],
  g: ['gram', 'grams'],
  L: ['litre', 'litres'],
  mL: ['millilitre', 'millilitres'],
};

/**
 * Units as words (James, 26 Nov 2026: "3 h = ? min" should read "3 hours = ? minutes", "8 km = ? m" "8 kilometres = ?
 * metres"): a unit after a number becomes its word, and a lone unit right after the blank becomes the plural.
 */
export function unitWords(text: string, unit?: boolean): string {
  if (unit && UNIT_WORDS[text]) return UNIT_WORDS[text][1];
  return text.replace(/(^|\s)([\d.,/½]+) (h|min|km|m|cm|mm|kg|g|L|mL)(?=\s|$)/g, (_m, pre: string, n: string, u: string) => {
    const one = n === '1' || n === '½' || /^\d+\/\d+$/.test(n);
    return `${pre}${n} ${UNIT_WORDS[u][one ? 0 : 1]}`;
  });
}

/** One part of the question: a fraction, a word, algebra, or a plain number or sign. `blank` stands in for '?'. */
function Part({ text: raw, blank, unit }: { text: string; blank: ReactNode; unit?: boolean }) {
  const text = unitWords(raw, unit);
  const fill = (piece: string) => (piece === '?' ? blank : piece);
  const f = FRACTION.exec(text);
  if (f) {
    return (
      <span className="qfrac">
        {f[1] !== undefined && <span className="qfrac__whole">{fill(f[1])}</span>}
        <span className="qfrac__stack">
          <span className="qfrac__top">{fill(f[2])}</span>
          <span className="qfrac__bottom">{fill(f[3])}</span>
        </span>
      </span>
    );
  }
  // A gap in a list ('?,' in 6, 8, ?, 12) keeps its comma after the blank, and an angle ('?°') its degree sign.
  // A letter after it is algebra: '?a' in 3a + a + a = ?a.
  const gap = /^\?([,;]|°C?|[a-z])?$/.exec(text);
  if (gap) return <span className="question__gap question__algebra">{blank}{gap[1] && /[a-z]/.test(gap[1]) ? <i>{gap[1]}</i> : (gap[1] ?? '')}</span>;
  // Algebra (7y + 3, s², 4x + 3x, t) is maths, shown as big as the numbers with its letters in italics. A lone letter right
  // after the blank is a unit (? m, ? a), shown small like a word.
  if (ALGEBRA.test(text) && !unit) return <span className="question__algebra">{[...text].map((c, k) => (/[a-z]/i.test(c) ? <i key={k}>{c}</i> : c))}</span>;
  // A measure (9.1 km, 4 h 15 min, 3 m²): numbers as big as the sum, units small like words.
  if (QUANTITY.test(text))
    return (
      <span className="question__quantity">
        {text.split(' ').map((t, k) => (/\d/.test(t) ? <span key={k}>{t}</span> : <span key={k} className="question__unit">{t}</span>))}
      </span>
    );
  if (/[a-z]/i.test(text)) return <span className="question__word">{text}</span>;
  return <span>{text}</span>;
}

/**
 * What the "r" in a division means, with a worked example and dots in groups. The example is never the question itself.
 */
export function RemainderHelp({ parts }: { parts: string[] }) {
  const [n, d] = parts[0] === '14' && parts[2] === '4' ? [9, 4] : [14, 4];
  const q = Math.floor(n / d);
  const r = n % d;
  const groups = [...Array.from({ length: q }, () => d), r];
  return (
    <div className="remainder-help">
      <p>
        <strong>r</strong> means <strong>remainder</strong>: what is left over when you share into equal groups.
      </p>
      <p className="remainder-help__sum">
        {n} ÷ {d} = {q} r {r}
      </p>
      <p className="remainder-help__dots" aria-hidden="true">
        {groups.map((size, i) => (
          <span key={i} className={i === q ? 'remainder-help__left' : 'remainder-help__group'}>
            {'●'.repeat(size)}
          </span>
        ))}
      </p>
      <p>
        {d} goes into {n} {q} times ({q} × {d} = {q * d}), and {r} is left over.
      </p>
    </div>
  );
}

/** A small grid for "which point is on the x-axis" questions: the first number goes across, the second goes up. */
export function AxisHelp() {
  const step = 18;
  const o = { x: 26, y: 112 };
  const at = (x: number, y: number) => ({ cx: o.x + x * step, cy: o.y - y * step });
  return (
    <div className="remainder-help axis-help">
      <svg viewBox="0 0 150 132" className="axis-help__pic" aria-hidden="true" focusable="false">
        {Array.from({ length: 7 }, (_, i) => (
          <g key={i} className="axis-help__grid">
            <line x1={o.x + i * step} y1={o.y} x2={o.x + i * step} y2={o.y - 5 * step} />
            {i < 6 && <line x1={o.x} y1={o.y - i * step} x2={o.x + 6 * step} y2={o.y - i * step} />}
          </g>
        ))}
        <line x1={o.x} y1={o.y} x2={o.x + 6 * step + 8} y2={o.y} className="axis-help__axis axis-help__axis--x" />
        <line x1={o.x} y1={o.y} x2={o.x} y2={o.y - 5 * step - 8} className="axis-help__axis axis-help__axis--y" />
        <text x={o.x + 6 * step + 4} y={o.y + 14} className="axis-help__name">x</text>
        <text x={o.x - 14} y={o.y - 5 * step - 2} className="axis-help__name">y</text>
        <circle {...at(4, 0)} r={5} className="axis-help__dot axis-help__dot--x" />
        <text x={at(4, 0).cx - 12} y={o.y + 16} className="axis-help__label">(4, 0)</text>
        <circle {...at(0, 3)} r={5} className="axis-help__dot axis-help__dot--y" />
        <text x={o.x + 8} y={at(0, 3).cy + 4} className="axis-help__label">(0, 3)</text>
      </svg>
      <p>
        A point is (<strong>across</strong>, <strong>up</strong>).
      </p>
      <p>
        On the <strong className="axis-help__x">x-axis</strong> (the line going across) the <strong>second</strong> number is 0, like (4, 0).
      </p>
      <p>
        On the <strong className="axis-help__y">y-axis</strong> (the line going up) the <strong>first</strong> number is 0, like (0, 3).
      </p>
    </div>
  );
}

/**
 * Adding or taking away fractions with different bottoms: which fraction to change into an equivalent one and how, worked
 * from this question's own numbers. It stops before the final answer ("1/8 + 6/8 = ?/8").
 */
const PARTS_NAMES: Record<number, string> = { 2: 'halves', 3: 'thirds', 4: 'quarters', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths', 9: 'ninths', 10: 'tenths', 12: 'twelfths', 15: 'fifteenths', 16: 'sixteenths', 20: 'twentieths', 24: 'twenty-fourths', 100: 'hundredths' };

export function FractionHelp({ parts }: { parts: string[] }) {
  const steps = fractionSteps(parts);
  if (!steps) return null;
  const { a, b, sign, bottom, changes } = steps;
  const after = ([n, d]: [number, number]) => (d === bottom ? [n, d] : [n * (bottom / d), bottom]);
  const [a2, b2] = [after(a), after(b)];
  const f = (n: number, d: number) => <Part text={`${n}/${d}`} blank={null} />;
  const one = changes.length === 1;
  const word = sign === '+' ? 'add' : 'take away';
  const named = PARTS_NAMES[bottom] ?? `${bottom}ths`;
  return (
    <div className="remainder-help fraction-help">
      <p>
        <strong>Make the bottoms the same</strong> before you {word}.
      </p>
      <p>
        {one
          ? `${bottom} is a multiple of ${changes[0].d}, so change ${changes[0].n}/${changes[0].d} into ${named}.`
          : `${a[1]} and ${b[1]} both go into ${bottom}, so change both fractions into ${named}.`}
      </p>
      {changes.map((c) => (
        <p key={`${c.n}/${c.d}`} className="fraction-help__step">
          {f(c.n, c.d)} <span>× {c.by} top and bottom</span> = {f(c.n * c.by, bottom)}
        </p>
      ))}
      <p className="fraction-help__step">
        {f(a2[0], a2[1])} {sign} {f(b2[0], b2[1])} = <Part text={`?/${bottom}`} blank="?" />
      </p>
      <p>Now {word} the tops. The bottom stays {bottom}.</p>
    </div>
  );
}

/** Hours into minutes: 1 hour is 60 minutes, so use the 6 times table. The worked example is never the question itself. */
export function HoursHelp({ parts }: { parts: string[] }) {
  const asked = /^(\d+) h$/.exec(parts[0] ?? '');
  const ex = asked && Number(asked[1]) === 4 ? 5 : 4;
  return (
    <div className="remainder-help">
      <p>
        <strong>1 hour = 60 minutes.</strong> Use your <strong>6 times table</strong>, then put a 0 on the end.
      </p>
      <p className="remainder-help__sum">
        {ex} × 6 = {ex * 6}, so {ex} × 60 = {ex * 60}
      </p>
      <p>
        {ex} hours = {ex * 60} minutes. Half an hour is 30 minutes.
      </p>
    </div>
  );
}

/** Changing a metric unit: the fact, multiply or divide, and a worked example that is never the question itself. */
export function UnitHelp({ parts }: { parts: string[] }) {
  const steps = unitSteps(parts);
  if (!steps) return null;
  const { from, to, big, small, factor, times, n } = steps;
  const word = (u: string, many = true) => unitWords(`${many ? 2 : 1} ${u}`).split(' ')[1];
  const sign = times ? '×' : '÷';
  // A tidy example: whole numbers of the big unit going down, whole lots of the big unit going up.
  const exBig = n === 3 || n === 3 * factor ? 5 : 3;
  const [exFrom, exTo] = times ? [exBig, exBig * factor] : [exBig * factor, exBig];
  return (
    <div className="remainder-help">
      <p>
        <strong>
          1 {word(big, false)} = {factor} {word(small)}.
        </strong>
      </p>
      <p>
        {word(from).replace(/^./, (c) => c.toUpperCase())} to {word(to)}: there are {times ? 'more' : 'fewer'} of them, so <strong>{times ? 'multiply' : 'divide'} by {factor}</strong>.
      </p>
      <p className="remainder-help__sum">
        {unitWords(`${exFrom} ${from}`)} = {exFrom} {sign} {factor} = {unitWords(`${exTo} ${to}`)}
      </p>
    </div>
  );
}

const DIRECTIONS = ['north', 'east', 'south', 'west'];

/** Turning on a compass: clockwise order, how many steps each turn is, and a worked example that is never the question. */
export function TurnHelp({ parts }: { parts: string[] }) {
  const m = /^Face (north|east|south|west)/i.exec(parts[0] ?? '');
  const start = m ? DIRECTIONS.indexOf(m[1].toLowerCase()) : 0;
  const ex = (start + 1) % 4;
  return (
    <div className="remainder-help">
      <p>
        <strong>Clockwise</strong> goes north → east → south → west, the way a clock&rsquo;s hands go. <strong>Anticlockwise</strong> goes back the other way.
      </p>
      <p>A quarter turn moves 1 step, a half turn 2 steps, a three-quarter turn 3 steps.</p>
      <p className="remainder-help__sum">
        Face {DIRECTIONS[ex]}, quarter turn clockwise → {DIRECTIONS[(ex + 1) % 4]}
      </p>
    </div>
  );
}

/** What a screen reader says for the digits typed so far: "4.15" is "4 point 1 5", "4." is "4 point". */
function spokenTyped(typed: string): string {
  const [whole, fraction] = typed.split('.');
  return typed.includes('.') ? `${whole} point ${fraction.split('').join(' ')}`.trim() : whole;
}

/** A choice button's text: fractions drawn as fractions. */
const choiceText = (label: string) => (FRACTION.test(label) ? <Part text={label} blank={null} /> : label);


/** Under the skip button when the class has 3 skips per game. */
export function SkipsLeft({ left }: { left: number }) {
  return <p className="question__skips">{left > 0 ? `Skips left: ${left}` : 'No skips left in this game'}</p>;
}

/** What the box needs of a question. `answer` is missing when the game's server keeps it secret until marked. */
/**
 * Smaller text for long choice labels ("parallelogram", "5:50 pm", "even chance"), so a word fits its button beside the key
 * number instead of running under it or out of the box.
 */
function choicesSize(labels: readonly string[] | undefined): string {
  const longest = Math.max(0, ...(labels ?? []).map((l) => l.length));
  return longest >= 12 ? ' question__choices--xlong' : longest >= 10 ? ' question__choices--long' : longest >= 6 ? ' question__choices--mid' : '';
}

/** What the comparison signs mean, with the "or equal to" signs spelled out (James, 26 Nov 2026). */
function SymbolHelp() {
  return (
    <ul className="symbol-help" aria-label="What the signs mean">
      <li><b>&lt;</b> means <strong>less than</strong>: 3 &lt; 8</li>
      <li><b>&gt;</b> means <strong>greater than</strong>: 8 &gt; 3</li>
      <li>
        <b>≤</b> means <strong>less than OR equal to</strong>. True if the left side is smaller, and also true if both sides are the same.
        <span className="symbol-help__eg">4 ≤ 5 ✓ · 5 ≤ 5 ✓ · 6 ≤ 5 ✗</span>
      </li>
      <li>
        <b>≥</b> means <strong>greater than OR equal to</strong>. True if the left side is bigger, and also true if both sides are the same.
        <span className="symbol-help__eg">6 ≥ 5 ✓ · 5 ≥ 5 ✓ · 4 ≥ 5 ✗</span>
      </li>
      <li><b>=</b> means <strong>the same as</strong>: 4 + 1 = 5</li>
      <li><b>≠</b> means <strong>not equal to</strong>: 5 ≠ 7</li>
      <li>The open mouth of &lt; and &gt; always faces the bigger number.</li>
    </ul>
  );
}

export type ShownQuestion = Pick<Question, 'id' | 'parts' | 'spoken' | 'prompt' | 'choices' | 'choiceLabels' | 'maxLength' | 'input' | 'figure'> & { answer?: number };

/**
 * A marked answer, plus what it earned, e.g. "+15 mana" (shown under "Correct!"). `answer` is
 * the right answer, for when the game's server marked it (so the box didn't know it before).
 */
export type MarkedAnswer = AnswerResult & { reward?: string; answer?: number };

export function QuestionModal({
  question,
  title,
  note,
  onSubmit,
  onDone,
  onClose,
  closeLabel = 'Close',
  timeScale = 1,
  inline = false,
  secondsLeft = null,
  onHint,
  scribble = true,
  spot,
  closeIsSkip = true,
}: {
  question: ShownQuestion;
  /** What the question is for, e.g. "Mana Well". */
  title: string;
  /** A line under the title, e.g. "Correct answers give mana". */
  note?: string;
  /** Marks the answer (the game records it). May take a moment, if the game's server does the marking. */
  onSubmit: (answer: number, ms: number) => MarkedAnswer | Promise<MarkedAnswer>;
  /** Called after the feedback has been shown. */
  onDone: (result: MarkedAnswer) => void;
  /** If given, the student may stop (a button, and Escape) before answering. The class's skip switch can take it away. */
  onClose?: () => void;
  closeLabel?: string;
  /** Tests set 0 to skip the feedback pause. */
  timeScale?: number;
  /** A card in the page, not a pop-up over it: no dimmed backdrop, no focus grab. */
  inline?: boolean;
  /** A countdown to show, when the game gives the question a time limit. */
  secondsLeft?: number | null;
  /**
   * Adds a "Hint" button, once per question (off unless given). Called the first time it is pressed; the game decides what
   * a right answer after a hint earns. The box only knows the answer if the game gave it (`question.answer`).
   */
  onHint?: () => void;
  /** A scribble pad beside the box, for working out. On by default; never shown for an inline card. */
  scribble?: boolean;
  /** The kind of question, for the teacher's skip counts (questionLog.ts). Taken from the title if not given. */
  spot?: string;
  /**
   * False when the close button isn't a way past a question (Gem Keep's "Well done", Maths Monsters' "Back"): the class's
   * "Skip button" switch then leaves it alone.
   */
  closeIsSkip?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<MarkedAnswer | null>(null);
  const [checking, setChecking] = useState(false);
  const [trouble, setTrouble] = useState('');
  const [hint, setHint] = useState<ReturnType<typeof hintFor> | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const help = helpKind(question);
  // A picture of the numbers (ten-frames, a number line, fraction bars...) when the question has no figure of its own (H8).
  const picture = useMemo(() => pictureFor(question), [question]);
  // The pupil's secure facts, so a card can start from one they know ("You know 6 × 7"). Loaded the first time help opens.
  const [known, setKnown] = useState<Set<string> | null>(null);
  // Every kind of help, best first (James, 26 Nov 2026): the one that matches the picture, then other strategies (a fact
  // they know, doubling or halving), and counting in lots last.
  const cards = useMemo(
    () => helpCardsFor(question, known ? { known: (key) => known.has(key) } : {}),
    [question, known],
  );
  const card = cards[0] ?? null;
  // Help me was opened on this question (H1): the answer then doesn't count. Holds the call telling the database, so the
  // answer waits for it.
  const helped = useRef<{ id: ShownQuestion['id']; sent: Promise<void> } | null>(null);
  const openHelp = () => {
    setHelpOpen((o) => !o);
    if (!known) void helpKnownFacts().then(setKnown);
    if (helped.current?.id !== question.id && !result) helped.current = { id: question.id, sent: helpOpened(card?.kind ?? help ?? 'help') };
  };
  const [streak, setStreak] = useState(0);
  const [padOpen, setPadOpen] = useState(readPadOpen);
  const shownAt = useRef(performance.now());
  const box = useRef<HTMLDivElement>(null);
  const titleId = `question-${question.id}-title`;
  // The class's "Skip button" switch (questionLog.ts): off, or no skips left, means no close button and no Escape.
  const skips = useSkipRule();
  const canClose = !!onClose && (!closeIsSkip || skips.canSkip);
  const close = () => {
    if (!onClose || (closeIsSkip && !spendSkip())) return;
    onClose();
  };

  // A new question: clear the answer and start the clock. A layout effect, so it runs before the box can be pressed:
  // a plain effect could run just after a quick first tap and wipe it, leaving the box waiting on "?".
  useLayoutEffect(() => {
    setTyped('');
    setResult(null);
    setChecking(false);
    setTrouble('');
    setHint(null);
    setHelpOpen(false);
    shownAt.current = performance.now();
    if (!inline) box.current?.focus({ preventScroll: true });
  }, [question.id, inline]);

  // Every question stays on one line (James, 26 Nov 2026): if it is too wide for the box ("(12 + 8) × 3 − 4 = ?",
  // "9 ÷ 4 = ? r 1"), the text shrinks to fit instead of wrapping onto a second line. Words are drawn at 0.42em, so a
  // question with words stops shrinking while they can still be read, and only then wraps. Re-fitted when the answer
  // typed in the blank grows, and when the window resizes.
  const fact = useRef<HTMLParagraphElement>(null);
  const hasWords = question.parts.some((part) => /[a-z]/i.test(part));
  const shownAnswer = result ? 'done' : typed;
  useLayoutEffect(() => {
    const el = fact.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      delete el.dataset.wrap;
      const holder = el.parentElement;
      if (!holder) return;
      // The room the box gives the sum, measured while it may wrap, so the one long line can't stretch the box first.
      el.dataset.wrap = '';
      const pad = getComputedStyle(holder);
      const room = holder.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      delete el.dataset.wrap;
      const floor = hasWords ? 22 : 16;
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > room + 1 && size > floor) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      // Still too wide at the smallest readable size (a long sentence): back to full size, on two lines.
      if (el.scrollWidth > room + 1) {
        el.style.fontSize = '';
        el.dataset.wrap = '';
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [question.id, question.parts, hasWords, shownAnswer]);

  // Each question shown is noted once for the teacher: answered at the first try, or skipped if the box closes (or moves on
  // to another question) without one. Escape, a skip button, a timer running out and the game rolling past it all count.
  const answeredId = useRef<ShownQuestion['id'] | null>(null);
  const spotName = useRef('');
  spotName.current = spot ?? spotFromTitle(title);
  useEffect(() => {
    const id = question.id;
    const started = performance.now();
    const close = questionOpened(spotName.current);
    return () => {
      close();
      if (answeredId.current !== id) {
        noteQuestion({ spot: spotName.current, skipped: true, ms: performance.now() - started });
        if (helped.current?.id === id) helpCancelled();
      }
    };
  }, [question.id]);

  // Each answer is reported exactly once, however often the parent re-renders.
  const reportDone = useRef(onDone);
  reportDone.current = onDone;
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => reportDone.current(result), (result.correct ? FEEDBACK_MS.right : FEEDBACK_MS.wrong) * timeScale);
    return () => window.clearTimeout(timer);
  }, [result, timeScale]);

  function submit(answer: number) {
    if (result || checking) return;
    const ms = Math.round(performance.now() - shownAt.current);
    if (answeredId.current !== question.id) {
      answeredId.current = question.id;
      noteQuestion({ spot: spotName.current, skipped: false, ms });
    }
    const wasHelped = helped.current?.id === question.id ? helped.current.sent : null;
    if (wasHelped) {
      // Help me was opened: the database must hear that before the answer is saved, so wait (at most 1.5 s) first.
      setChecking(true);
      void wasHelped.then(() => {
        setChecking(false);
        send(answer, ms, true);
      });
      return;
    }
    send(answer, ms, false);
  }

  function send(answer: number, ms: number, wasHelped: boolean) {
    const marked = onSubmit(answer, ms);
    const show = (done: MarkedAnswer) => {
      setStreak(countAnswer(done.correct));
      setResult(done);
    };
    if (!('then' in marked)) {
      show(marked);
      return;
    }
    // The server is marking it: wait for it, and let the student try again if it didn't answer.
    setChecking(true);
    setTrouble('');
    marked.then(
      (done) => {
        setChecking(false);
        show(done);
        // The server marked and saved it, so any help still waiting is spent.
        if (wasHelped) helpCancelled();
      },
      (error: unknown) => {
        setChecking(false);
        setTrouble(error instanceof Error && error.message ? error.message : 'We couldn’t check that one. Try again.');
      },
    );
  }

  const canHint = !!onHint && question.answer !== undefined && !result;
  function showHint() {
    if (hint || !canHint) return;
    setHint(hintFor({ answer: question.answer ?? 0, choices: question.choices, parts: question.parts }));
    onHint?.();
  }

  const maxLength = question.maxLength ?? MAX_DIGITS;
  const decimal = question.input === 'decimal';
  const addDigit = (d: string) =>
    setTyped((t) => {
      if (t.length >= maxLength) return t;
      if (d === '.') return !decimal || t.includes('.') ? t : t === '' ? '0.' : t + '.';
      return t === '0' ? (d === '0' ? t : d) : t + d;
    });
  const back = () => setTyped((t) => t.slice(0, -1));
  const enter = () => typed !== '' && submit(Number(typed));

  // The keys work wherever the keyboard focus is (questionKeys.ts), so nobody has to click the box before typing.
  const outer = useRef<HTMLDivElement>(null);
  useQuestionKeys(outer, (e) => {
    if (e.key === 'Escape') {
      if (!canClose || result || checking) return false;
      close();
      return true;
    }
    if (result || checking) return false;
    if (question.choices) {
      if (e.repeat) return false;
      const choice = choiceForKey(e.key, question.choices);
      if (choice === undefined || hint?.remove.includes(choice)) return false;
      submit(choice);
      return true;
    }
    if (/^[0-9.]$/.test(e.key)) addDigit(e.key);
    else if (e.key === 'Backspace') back();
    else if (e.key === 'Enter') enter();
    else return false;
    return true;
  });

  const showPad = scribble && !inline;
  // "Feedback on this question" (questionFeedback.ts): teachers only, on the left, the mirror of the scribble pad.
  const feedbackSink = useFeedbackSink();
  const showFeedback = !!feedbackSink && !inline;
  const [feedbackOpen, setFeedbackOpen] = useState(() => readOpen(FEEDBACK_KEY));
  const setFeedback = (open: boolean) => {
    setFeedbackOpen(open);
    try {
      localStorage.setItem(FEEDBACK_KEY, open ? '1' : '0');
    } catch {
      // Storage blocked: the panel just won't be remembered.
    }
  };
  const feedbackItem = () => {
    const extra = question as ShownQuestion & { factKey?: string; skill?: string };
    return {
      game: `${typeof window === 'undefined' ? '' : window.location.hash} · ${spotName.current}`.slice(0, 80),
      key: extra.factKey ?? '',
      question: {
        title,
        parts: question.parts,
        prompt: question.prompt,
        spoken: question.spoken,
        choices: question.choices,
        choiceLabels: question.choiceLabels,
        figure: question.figure,
        answer: question.answer,
        helpBox: help ?? undefined,
        skill: extra.skill,
      },
      picture: isFigure(question.figure) ? null : picture,
      help: cards,
    };
  };
  const beside = (showPad && padOpen ? 1 : 0) + (showFeedback && feedbackOpen ? 1 : 0);
  const setPad = (open: boolean) => {
    setPadOpen(open);
    try {
      localStorage.setItem(PAD_KEY, open ? '1' : '0');
    } catch {
      // Storage blocked: the pad just won't be remembered.
    }
  };

  const blank = typed === '' ? '?' : typed;

  // Money answers are shown with cents: 4.1 → 4.10.
  const rightAnswer = result?.answer ?? question.answer ?? 0;
  // A pick-one question's answer is the number of the choice: show the choice itself in the blank.
  const pickedLabel = question.choiceLabels?.[rightAnswer];
  const answerText = pickedLabel ?? (question.parts.includes('$') ? rightAnswer.toFixed(2) : String(rightAnswer));
  const blankBox = (
    <span className="question__blank" data-empty={typed === '' || undefined}>
      {result ? (result.correct && !pickedLabel ? blank : pickedLabel ? choiceText(answerText) : answerText) : blank}
    </span>
  );
  return (
    <div ref={outer} className={inline ? undefined : 'question-backdrop'}>
      <div
        className={showPad || showFeedback ? 'question-wrap' : 'question-wrap question-wrap--single'}
        data-pad={showPad && padOpen ? 'open' : undefined}
        data-feedback={showFeedback && feedbackOpen ? 'open' : undefined}
        data-beside={beside || undefined}
      >
      {showFeedback &&
        (feedbackOpen ? (
          <FeedbackPanel key={question.id} sink={feedbackSink} item={feedbackItem} onCollapse={() => setFeedback(false)} />
        ) : (
          <button type="button" className="feedback-tab" onPointerDown={(e) => e.preventDefault()} onClick={() => setFeedback(true)}>
            <span aria-hidden="true">💬</span> Feedback
          </button>
        ))}
      <div
        ref={box}
        className={inline ? 'question question--inline' : 'question'}
        role={inline ? 'group' : 'dialog'}
        aria-modal={inline ? undefined : true}
        aria-labelledby={titleId}
        tabIndex={-1}
        data-result={result ? (result.correct ? 'right' : 'wrong') : undefined}
        data-side={!inline && (isFigure(question.figure) || picture || (helpOpen && (card || help))) ? true : undefined}
      >
        <h2 id={titleId} className="question__title">
          {title}
        </h2>
        {note && <p className="question__note">{note}</p>}
        {/* The picture and Help me: above the question on phones, beside it on wide screens (James, 26 Nov 2026: "a little
            wider, rather than longer"), so the answer stays in view. Both wrappers are display: contents when stacked. */}
        <div className="question__aside">
        {isFigure(question.figure) ? <Figure figure={question.figure} /> : picture && <QuestionPicture picture={picture} />}
        {(card || help) && (
          // Help me (docs/plans/help-me/PLAN.md): a way to work it out with this question's numbers, never the answer, then
          // the picture box for the kinds that have one. Opening it means this answer doesn't count (H1).
          // Free help, no cost (James, 26 Nov 2026): every kind of angle with its name on angle questions, and what < > ≤ ≥ mean
          // on any question that uses them; what r means on remainders; a small grid on axis questions.
          <div className="question__help">
            <button type="button" className="question__hintbtn" aria-expanded={helpOpen} onClick={openHelp}>
              {helpOpen ? 'Hide help' : 'Help me'}
            </button>
            {helpOpen &&
              cards.map((c, n) => (
                <div key={`${n}-${c.title}`} className="help-card" data-more={n > 0 || undefined}>
                  {n > 0 && <p className="help-card__or">Or try this</p>}
                  <p className="help-card__title">{c.title}</p>
                  <ol className="help-card__steps">
                    {c.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            {helpOpen && help && (help === 'angles' ? <AngleNames /> : help === 'remainder' ? <RemainderHelp parts={question.parts} /> : help === 'axes' ? <AxisHelp /> : help === 'fractions' ? <FractionHelp parts={question.parts} /> : help === 'hours' ? <HoursHelp parts={question.parts} /> : help === 'units' ? <UnitHelp parts={question.parts} /> : help === 'turns' ? <TurnHelp parts={question.parts} /> : <SymbolHelp />)}
          </div>
        )}
        </div>
        <div className="question__main">
        {question.prompt && <p className="question__prompt">{question.prompt}</p>}
        <p ref={fact} className="question__fact" aria-label={question.spoken} data-long={question.parts.join('').length > 12 || undefined} data-one-line>
          {question.parts.map((part, i) => (
            <Part key={i} text={part} blank={blankBox} unit={i > 0 && question.parts[i - 1].startsWith('?')} />
          ))}
        </p>
        {secondsLeft !== null && !result && (
          <p className="question__timer" role="timer" aria-label={`${secondsLeft} seconds left`}>
            ⏱ {secondsLeft}
          </p>
        )}
        {/* The timer above isn't read out every second; screen readers hear a warning at 10 and 5. */}
        <p className="sr-only" aria-live="polite">
          {secondsLeft !== null && !result && (secondsLeft === 10 || secondsLeft === 5) ? `${secondsLeft} seconds left` : ''}
        </p>
        {onHint && question.answer !== undefined && !card && !help && (
          <div className="question__hint">
            <button type="button" className="question__hintbtn" disabled={!!hint || !!result || checking} onClick={showHint}>
              {hint ? 'Hint used' : 'Hint'}
            </button>
            <p className="question__hinttext" role="status">
              {hint?.text}
            </p>
          </div>
        )}
        <p className="question__feedback" role="status">
          {checking && 'Checking…'}
          {trouble && !checking && !result && trouble}
          {result?.correct && (
            <>
              <span className="question__sparkle" aria-hidden="true">
                ✦
              </span>{' '}
              Correct!{result.reward && <span className="question__reward"> {result.reward}</span>}
              {streak >= STREAK_FROM && <span className="question__streak"> 🔥 {streak} in a row!</span>}
            </>
          )}
          {result && !result.correct && <>{result.fact}</>}
        </p>
        {question.choices ? (
          <div className={`question__choices${choicesSize(question.choiceLabels)}`} role="group" aria-label="Choose an answer">
            {question.choices.map((choice, i) => (
              <button
                key={choice}
                type="button"
                className="question__choice"
                aria-label={question.choiceLabels ? spokenLabel(question.choiceLabels[i]) : undefined}
                disabled={!!result || checking || hint?.remove.includes(choice)}
                data-answer={result && choice === (result.answer ?? question.answer) ? true : undefined}
                onClick={() => submit(choice)}
                aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
              >
                {i < 9 && <kbd className="question__choice-key" aria-hidden="true">{i + 1}</kbd>}
                {question.choiceLabels ? choiceText(question.choiceLabels[i]) : choice}
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {typed ? `Your answer: ${spokenTyped(typed)}` : ''}
            </p>
            <NumberPad onDigit={addDigit} onBack={back} onEnter={enter} canEnter={typed !== '' && typed !== '0.'} disabled={!!result || checking} decimal={decimal} />
          </>
        )}
        {canClose && (
          <button type="button" className="question__close" disabled={!!result || checking} onClick={close}>
            {closeLabel}
          </button>
        )}
        {onClose && closeIsSkip && skips.left !== null && <SkipsLeft left={skips.left} />}
        </div>
      </div>
      {showPad &&
        (padOpen ? (
          <ScribblePad key={question.id} onCollapse={() => setPad(false)} />
        ) : (
          <button type="button" className="scribble-tab" onPointerDown={(e) => e.preventDefault()} onClick={() => setPad(true)}>
            <span aria-hidden="true">✏️</span> Scribble
          </button>
        ))}
      </div>
    </div>
  );
}
