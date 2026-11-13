/**
 * One bag (docs/ORDERUP-PLAN.md, layout A): the order card on the left, the bag in the middle, the ticket on the right. The
 * pupil taps the two numbers that go together first (a number with a power on its own), types the step's answer, and the
 * bag collapses. Every tap is kept as an event; the server replays them (shared/orderup/play.ts), so this screen only
 * helps and shows.
 *
 * The help ladder, per step: the order card always; the hint after a wrong pick; "Let's look together" after a second; the
 * pair glowing after a third (not on the "hints only" setting). Full help also lights the next rule before any tap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyStep, format, isNum, nextStep, parse, ruleOfOp, tokensOf, type Node, type Rule } from '../../../shared/orderup/expr';
import { answerHint, answerMistake, checkPick, pickHint } from '../../../shared/orderup/mistakes';
import { autoStep, type BagEvent } from '../../../shared/orderup/play';
import type { Help } from '../../../shared/orderup/progress';
import { dotGroups, lookLines, stepNumbers, stepRule, workedStep } from './look';
import { RULES, WORDS } from './words';

interface Props {
  text: string;
  help: Help;
  /** The guided first bag after the worked example: the right pair glows from the start. */
  guided?: boolean;
  say: (text: string) => void;
  onDone: (events: BagEvent[]) => void;
}

interface Hint {
  text: string;
  /** "Let's look together" lines. */
  look?: string[];
  /** Dots for a times step that was added. */
  dots?: { groups: number; each: number } | null;
}

export function BagPlay({ text, help, guided = false, say, onDone }: Props) {
  const [root, setRoot] = useState<Node>(() => parse(text));
  const [step, setStep] = useState<Node | null>(() => autoStep(parse(text)));
  const [picked, setPicked] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const [wrongPicks, setWrongPicks] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [hint, setHint] = useState<Hint | null>(null);
  const [lines, setLines] = useState<{ text: string; rule: Rule | null }[]>(() => [{ text, rule: null }]);
  const [pulse, setPulse] = useState<{ id: number; rule: Rule } | null>(null);
  const events = useRef<BagEvent[]>([]);
  const last = useRef(Date.now());
  const finished = useRef(false);

  const stamp = () => {
    const now = Date.now();
    const ms = Math.min(now - last.current, 600_000);
    last.current = now;
    return ms;
  };

  const next = nextStep(root);
  const rung = help === 'hints' ? Math.min(wrongPicks, 1) : wrongPicks;
  const glowPair = !step && next && (rung >= 3 || (guided && lines.length === 1)) ? stepNumbers(next) : [];
  const glowSign = !step && next && rung >= 2 && next.kind === 'bin' ? next.id : null;
  const litRule: Rule | null = step ? stepRule(root, step) : next && (hint || help === 'full' || guided) ? stepRule(root, next) : null;

  const pick = useCallback((ids: number[]) => {
    const check = checkPick(root, ids);
    events.current.push({ p: ids, ms: stamp() });
    setPicked([]);
    if (check.ok) {
      setStep(check.step);
      setHint(null);
      setTyped('');
      say(WORDS.whatIs(format(check.step)));
      return;
    }
    const wrong = wrongPicks + 1;
    setWrongPicks(wrong);
    const words = pickHint(check.mistake, check.next);
    const h: Hint = { text: words };
    if (help !== 'hints' && wrong >= 2) h.look = lookLines(root);
    if (help !== 'hints' && wrong >= 3) h.text = `${words} ${WORDS.tapGlowing}`;
    setHint(h);
    say(h.look ? [WORDS.lookTogether, ...h.look].join(' ') : h.text);
  }, [root, wrongPicks, help, say]);

  const tapNumber = (id: number, exp?: number) => {
    if (step || finished.current) return;
    if (exp) return pick([id]);
    if (picked.includes(id)) return setPicked(picked.filter((x) => x !== id));
    if (picked.length === 1) return pick([picked[0], id]);
    setPicked([id]);
  };

  const submit = useCallback(() => {
    if (!step || typed === '' || finished.current) return;
    const value = Number(typed);
    events.current.push({ a: value, ms: stamp() });
    const after = applyStep(root, step.id);
    const done = isNum(after);
    const right = findNum(after, step.id) === value;
    if (!right) {
      const wrong = wrongAnswers + 1;
      setWrongAnswers(wrong);
      const mistake = answerMistake(step, value);
      const h: Hint = wrong >= 2 ? { text: workedStep(step) } : { text: answerHint(mistake, step), dots: mistake === 'added-not-multiplied' ? dotGroups(step) : null };
      setHint(h);
      setTyped('');
      say(h.text);
      return;
    }
    const rule = stepRule(root, step);
    setLines((l) => [...l, { text: `= ${format(after)}`, rule }]);
    setPulse({ id: step.id, rule });
    setRoot(after);
    setHint(null);
    setTyped('');
    setWrongPicks(0);
    setWrongAnswers(0);
    if (done) {
      finished.current = true;
      setStep(null);
      onDone(events.current);
      return;
    }
    const auto = autoStep(after);
    setStep(auto);
    if (auto) say(WORDS.whatIs(format(auto)));
  }, [step, typed, root, wrongAnswers, say, onDone]);

  // Typing on a keyboard works as well as the pad.
  useEffect(() => {
    if (!step) return;
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (/^[0-9]$/.test(e.key)) setTyped((t) => (t.length < 5 ? t + e.key : t));
      else if (e.key === 'Backspace') setTyped((t) => t.slice(0, -1));
      else if (e.key === 'Enter') submit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [step, submit]);

  const stepIds = step ? stepNumbers(step) : [];
  const tokens = tokensOf(root);

  return (
    <div className="ou-layout">
      <OrderCard lit={litRule} />

      <section className="ou-bag" aria-label="The bag">
        <div className="ou-bag__paper">
          <p className="ou-expr" aria-label={format(root)}>
            {tokens.map((t, i) => {
              if (t.kind === 'num') {
                const isPicked = picked.includes(t.id) || stepIds.includes(t.id);
                const cls = ['ou-num', isPicked && 'ou-num--picked', glowPair.includes(t.id) && 'ou-num--glow', pulse?.id === t.id && `ou-num--pulse ou-rule--${pulse.rule}`].filter(Boolean).join(' ');
                return (
                  <button
                    key={`n${t.id}-${i}`}
                    type="button"
                    className={cls}
                    aria-pressed={isPicked}
                    disabled={!!step || isNum(root)}
                    onClick={() => tapNumber(t.id, t.exp)}
                  >
                    {t.value}
                    {t.exp ? <sup className="ou-rule--exponents">{t.exp}</sup> : null}
                  </button>
                );
              }
              if (t.kind === 'op') {
                const cls = `ou-op ou-rule--${ruleOfOp(t.op)}${glowSign === t.id ? ' ou-op--glow' : ''}`;
                return <span key={`o${t.id}`} className={cls} aria-hidden="true">{t.op}</span>;
              }
              return (
                <span key={`${t.kind}${t.id}`} className="ou-paren ou-rule--brackets" aria-hidden="true">
                  {t.kind === 'open' ? '(' : ')'}
                  {t.kind === 'close' && t.exp ? <sup>{t.exp}</sup> : null}
                </span>
              );
            })}
          </p>
        </div>

        {hint && (
          <div className="ou-hint" role="status">
            {hint.look && (
              <>
                <p className="ou-hint__lead">{WORDS.lookTogether}</p>
                <ol className="ou-hint__look">{hint.look.map((l) => <li key={l}>{l}</li>)}</ol>
              </>
            )}
            <p>{hint.text}</p>
            {hint.dots && (
              <p className="ou-dots" aria-hidden="true">
                {Array.from({ length: hint.dots.groups }, (_, g) => (
                  <span key={g} className="ou-dots__group">{Array.from({ length: hint.dots!.each }, (_, d) => <span key={d} className="ou-dot" />)}</span>
                ))}
              </p>
            )}
          </div>
        )}

        {!isNum(root) && (step ? (
          <div className="ou-pad-wrap">
            <p className="ou-ask">{WORDS.whatIs(format(step))}</p>
            <p className="ou-typed" aria-live="polite" aria-label="Your answer">{typed || ' '}</p>
            <div className="ou-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} type="button" className="ou-key" onClick={() => setTyped((t) => (t.length < 5 ? t + d : t))}>{d}</button>
              ))}
              <button type="button" className="ou-key ou-key--soft" onClick={() => setTyped((t) => t.slice(0, -1))} aria-label={WORDS.clear}>⌫</button>
              <button type="button" className="ou-key" onClick={() => setTyped((t) => (t.length < 5 ? t + '0' : t))}>0</button>
              <button type="button" className="ou-key ou-key--go" onClick={submit} disabled={typed === ''}>{WORDS.check}</button>
            </div>
          </div>
        ) : (
          <p className="ou-ask">{tokens.some((t) => t.kind === 'num' && t.exp) ? `${WORDS.tapPair} ${WORDS.tapPower}` : WORDS.tapPair}</p>
        ))}
      </section>

      <section className="ou-ticket" aria-label={WORDS.ticket}>
        <h3>{WORDS.ticket}</h3>
        <ol>
          {lines.map((l, i) => (
            <li key={i} className={l.rule ? `ou-ticket__line ou-ticket__line--${l.rule}` : 'ou-ticket__line'}>{l.text}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function findNum(root: Node, id: number): number | null {
  if (root.id === id && isNum(root)) return root.value;
  if (root.kind === 'bin') return findNum(root.left, id) ?? findNum(root.right, id);
  if (root.kind === 'pow') return findNum(root.base, id);
  if (root.kind === 'group') return findNum(root.inner, id);
  return null;
}

/** The order card: the four rules in their colours, with the one that applies now lit. */
export function OrderCard({ lit }: { lit: Rule | null }) {
  return (
    <aside className="ou-card" aria-label={WORDS.card}>
      <h3>{WORDS.card}</h3>
      <ol>
        {RULES.map((r) => (
          <li key={r.rule} className={`ou-card__rule ou-rule--${r.rule}${lit === r.rule ? ' ou-card__rule--lit' : ''}`} aria-current={lit === r.rule ? 'step' : undefined}>
            <span className="ou-card__signs">{r.signs}</span>
            <span className="ou-card__name">{r.name}</span>
            <span className="ou-card__short">{r.short}</span>
            <span className="ou-card__note">{r.note}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
