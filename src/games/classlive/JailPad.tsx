/**
 * A jail station in Real-life Four Corners (docs/JAIL-PLAN.md): any iPad that joined the game. Every name in the class
 * is on it; a pupil who is out taps their own name (no sign-in), says "yes, that's me", and answers questions until
 * they have enough right. The big screen flashes their name and they run back into the game. "Not you?" takes the name
 * back off the jail list.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JailKid, JailPublic } from '../../../shared/classlive/jailServer';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import type { RoomView } from '../../../shared/classlive/server';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { ClassLiveLink } from './link';
import './jail.css';

const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');
/** Back to the names if nobody answers for this long (the pupil wandered off). */
const IDLE_MS = 90_000;

type Step =
  | { at: 'names' }
  | { at: 'sure'; id: string; name: string }
  | { at: 'asking'; kid: JailKid; question: PublicQuestion | null }
  | { at: 'back'; name: string };

export function JailPad({ link, room, view, setView }: {
  link: ClassLiveLink;
  room: number | null;
  view: RoomView;
  setView: (v: RoomView) => void;
}) {
  const g = view.game as JailPublic;
  const [step, setStep] = useState<Step>({ at: 'names' });
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ kid?: JailKid; question?: PublicQuestion; back?: boolean; view?: RoomView } | null>(null);
  const lastTouch = useRef(Date.now());
  const live = view.state === 'live';

  const send = useCallback(async (body: Record<string, unknown>) => {
    try {
      const out = await link.send({ room, ...body });
      const b = out.body as { view?: RoomView; kid?: JailKid; question?: PublicQuestion; error?: string };
      if (b.view) setView(b.view);
      return out;
    } catch {
      return { status: 0, body: { error: 'We lost the connection. Try again.' } as Record<string, unknown> };
    }
  }, [link, room, setView]);

  // A question for whoever is answering, if the last reply didn't bring one (retry every 2 s, like Four Corners' jail).
  const asking = step.at === 'asking' && !step.question ? step.kid.id : null;
  const [again, setAgain] = useState(0);
  useEffect(() => {
    if (!asking || !live) return;
    let dead = false;
    void send({ action: 'ask', as: asking }).then((out) => {
      if (dead) return;
      const b = out.body as { kid?: JailKid; question?: PublicQuestion };
      if (out.status === 200 && b.kid && !b.kid.inJail) setStep({ at: 'back', name: b.kid.name });
      else if (out.status === 200 && b.question && b.kid) setStep({ at: 'asking', kid: b.kid, question: b.question });
      else window.setTimeout(() => { if (!dead) setAgain((n) => n + 1); }, 2000);
    });
    return () => { dead = true; };
  }, [asking, live, send, again]);

  // Wandered off: back to the names.
  useEffect(() => {
    if (step.at === 'names') return;
    lastTouch.current = Date.now();
    const id = window.setInterval(() => { if (Date.now() - lastTouch.current > IDLE_MS) setStep({ at: 'names' }); }, 5000);
    return () => window.clearInterval(id);
  }, [step.at]);
  // "Back in!" shows for a moment, then the names again for the next pupil.
  useEffect(() => {
    if (step.at !== 'back') return;
    const id = window.setTimeout(() => setStep({ at: 'names' }), 4000);
    return () => window.clearTimeout(id);
  }, [step]);
  useEffect(() => { if (view.state === 'over') setStep({ at: 'names' }); }, [view.state]);

  const goIn = async (id: string) => {
    setBusy(true);
    setProblem('');
    const out = await send({ action: 'play', do: 'in', as: id });
    setBusy(false);
    const b = out.body as { kid?: JailKid; question?: PublicQuestion; error?: string };
    if (out.status !== 200 || !b.kid) { setProblem(String(b.error ?? 'Try again.')); setStep({ at: 'names' }); return; }
    setStep({ at: 'asking', kid: b.kid, question: b.question ?? null });
  };
  const notMe = async (id: string) => {
    setStep({ at: 'names' });
    await send({ action: 'play', do: 'undo', as: id });
  };

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    if (step.at !== 'asking' || !step.question) throw new Error('Try again.');
    lastTouch.current = Date.now();
    const q = step.question;
    const out = await send({ action: 'answer', as: step.kid.id, slot: q.slot, answer: value, ms });
    const b = out.body as { right?: boolean; answer?: number; kid?: JailKid; question?: PublicQuestion; back?: boolean; error?: string; reason?: string };
    if (out.status !== 200) {
      if (b.reason === 'answered' || b.reason === 'not_in') pending.current = { kid: b.kid };
      throw new Error(String(b.error ?? 'Try again.'));
    }
    pending.current = { kid: b.kid, question: b.question, back: b.back === true };
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };
  const onDone = () => {
    const p = pending.current;
    pending.current = null;
    if (step.at !== 'asking') return;
    if (p?.back || (p?.kid && !p.kid.inJail)) { setStep({ at: 'back', name: p?.kid?.name ?? step.kid.name }); return; }
    setStep({ at: 'asking', kid: p?.kid ?? step.kid, question: p?.question ?? null });
  };

  const top = (
    <header className="jl-pad__top">
      <b>🔒 Jail station</b>
      <span>{g.inJail.length === 0 ? 'Nobody in jail' : `${g.inJail.length} in jail`}</span>
    </header>
  );

  if (step.at === 'back') {
    return (
      <div className="jl-pad jl-pad--back" role="status">
        <div className="jl-back">
          <div className="jl-back__burst" aria-hidden="true">🎉</div>
          <h1>{step.name}, you're back in!</h1>
          <p>Look at the big screen, then run back into the game! 🏃</p>
        </div>
      </div>
    );
  }

  if (step.at === 'asking') {
    const { kid, question } = step;
    return (
      <div className="jl-pad jl-pad--asking">
        <header className="jl-pad__top">
          <b>🔒 {kid.name}</b>
          <button type="button" className="jl-notme" onClick={() => void notMe(kid.id)}>Not you?</button>
        </header>
        <div className="jl-locks" aria-label={`${kid.right} of ${kid.need} right`}>
          {Array.from({ length: kid.need }, (_, i) => <i key={i} className={i < kid.right ? 'on' : ''}>{i < kid.right ? '🔓' : '🔒'}</i>)}
        </div>
        <div className="jl-q">
          {question ? (
            <QuestionModal
              key={question.slot}
              question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
              title="Answer your way out"
              note={`${kid.right} of ${kid.need} right`}
              spot="Real-life Four Corners" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
            />
          ) : <p className="jl-wait">Getting your question…</p>}
        </div>
      </div>
    );
  }

  if (step.at === 'sure') {
    return (
      <div className="jl-pad jl-pad--sure">
        {top}
        <div className="jl-sure">
          <h1>Are you {step.name}?</h1>
          <div className="jl-sure__row">
            <button type="button" className="jl-yes" disabled={busy} onClick={() => void goIn(step.id)}>{busy ? 'One moment…' : "Yes, that's me"}</button>
            <button type="button" className="jl-no" disabled={busy} onClick={() => setStep({ at: 'names' })}>No</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="jl-pad">
      {top}
      <p className="jl-ask">{live ? `Out? Tap your name, then get ${g.need} right to get back in.` : view.state === 'lobby' ? 'Waiting for your teacher to start. This iPad is a jail station.' : 'The game has finished. Well done!'}</p>
      {problem && <p className="jl-problem" role="alert">{problem}</p>}
      <ul className="jl-names">
        {g.roster.map((p) => {
          const inJail = g.inJail.includes(p.id);
          return (
            <li key={p.id}>
              <button type="button" className={`jl-name ${inJail ? 'jl-name--in' : ''}`} disabled={!live} onClick={() => setStep({ at: 'sure', id: p.id, name: p.name })}>
                {inJail && <span aria-hidden="true">🔒 </span>}{p.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
