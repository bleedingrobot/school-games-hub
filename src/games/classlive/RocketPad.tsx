/**
 * A team's station in Rocket Relay (docs/ROCKET-PLAN.md): any iPad that joined the game, set to one team. It shows
 * who is running next (the running order is on the big screen too); the runner arrives, taps "I'm here", answers their
 * own question(s), then runs back to tag the next runner. Their maths and points are theirs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RocketKid, RocketPublic } from '../../../shared/classlive/rocketServer';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import type { RoomView } from '../../../shared/classlive/server';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { ClassLiveLink } from './link';
import './rocket.css';

const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');

type Step =
  | { at: 'wait' }
  | { at: 'asking'; kid: RocketKid; question: PublicQuestion | null }
  | { at: 'done'; name: string; boosted: boolean };

const teamKey = (room: number | null) => `rocket-team-${room ?? 0}`;
function savedTeam(room: number | null): number | null {
  try {
    const v = window.sessionStorage.getItem(teamKey(room));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

export function RocketPad({ link, room, view, setView }: {
  link: ClassLiveLink;
  room: number | null;
  view: RoomView;
  setView: (v: RoomView) => void;
}) {
  const g = view.game as RocketPublic;
  const [team, setTeamState] = useState<number | null>(() => savedTeam(room));
  const [step, setStep] = useState<Step>({ at: 'wait' });
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [sureSkip, setSureSkip] = useState(false);
  const pending = useRef<{ kid?: RocketKid; question?: PublicQuestion; runOver?: boolean; boost?: number } | null>(null);
  const boosted = useRef(false);
  const live = view.state === 'live';
  const t = team !== null ? g.teams[team] : undefined;

  const setTeam = (n: number | null) => {
    setTeamState(n);
    try { if (n === null) window.sessionStorage.removeItem(teamKey(room)); else window.sessionStorage.setItem(teamKey(room), String(n)); } catch { /* private mode */ }
  };

  const send = useCallback(async (body: Record<string, unknown>) => {
    try {
      const out = await link.send({ room, team, ...body });
      const b = out.body as { view?: RoomView };
      if (b.view) setView(b.view);
      return out;
    } catch {
      return { status: 0, body: { error: 'We lost the connection. Try again.' } as Record<string, unknown> };
    }
  }, [link, room, team, setView]);

  // A question for the runner, if the last reply didn't bring one (retry every 2 s).
  const asking = step.at === 'asking' && !step.question ? step.kid.id : null;
  const [again, setAgain] = useState(0);
  useEffect(() => {
    if (!asking || !live) return;
    let dead = false;
    void send({ action: 'ask', as: asking }).then((out) => {
      if (dead) return;
      const b = out.body as { kid?: RocketKid; question?: PublicQuestion };
      if (out.status === 200 && b.kid && !b.kid.here) setStep({ at: 'wait' });
      else if (out.status === 200 && b.question && b.kid) setStep({ at: 'asking', kid: b.kid, question: b.question });
      else window.setTimeout(() => { if (!dead) setAgain((n) => n + 1); }, 2000);
    });
    return () => { dead = true; };
  }, [asking, live, send, again]);

  // "Run back!" shows for a moment, then the next runner.
  useEffect(() => {
    if (step.at !== 'done') return;
    const id = window.setTimeout(() => setStep({ at: 'wait' }), 3500);
    return () => window.clearTimeout(id);
  }, [step]);
  useEffect(() => { if (view.state !== 'live') setStep({ at: 'wait' }); }, [view.state]);
  useEffect(() => { setSureSkip(false); }, [t?.runner?.id]);

  const here = async () => {
    if (!t?.runner) return;
    setBusy(true);
    setProblem('');
    boosted.current = false;
    const out = await send({ action: 'play', do: 'here', as: t.runner.id });
    setBusy(false);
    const b = out.body as { kid?: RocketKid; question?: PublicQuestion; error?: string };
    if (out.status !== 200 || !b.kid) { setProblem(String(b.error ?? 'Try again.')); return; }
    setStep({ at: 'asking', kid: b.kid, question: b.question ?? null });
  };
  const skip = async () => {
    if (!t?.runner) return;
    setSureSkip(false);
    const out = await send({ action: 'play', do: 'skip', as: t.runner.id });
    if (out.status !== 200) setProblem(String((out.body as { error?: string }).error ?? 'Try again.'));
  };

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    if (step.at !== 'asking' || !step.question) throw new Error('Try again.');
    const q = step.question;
    const out = await send({ action: 'answer', as: step.kid.id, slot: q.slot, answer: value, ms });
    const b = out.body as { right?: boolean; answer?: number; kid?: RocketKid; question?: PublicQuestion; runOver?: boolean; boost?: number; error?: string; reason?: string };
    if (out.status !== 200) {
      if (b.reason === 'answered' || b.reason === 'not_here' || b.reason === 'won') pending.current = { kid: b.kid, runOver: true };
      throw new Error(String(b.error ?? 'Try again.'));
    }
    if ((b.boost ?? 0) > 0) boosted.current = true;
    pending.current = { kid: b.kid, question: b.question, runOver: b.runOver === true, boost: b.boost };
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };
  const onDone = () => {
    const p = pending.current;
    pending.current = null;
    if (step.at !== 'asking') return;
    if (p?.runOver || (p?.kid && !p.kid.here)) { setStep({ at: 'done', name: step.kid.name, boosted: boosted.current }); return; }
    setStep({ at: 'asking', kid: p?.kid ?? step.kid, question: p?.question ?? null });
  };

  if (team === null || !t) {
    return (
      <div className="rk-pad">
        <header className="rk-pad__top"><b>🚀 Rocket Relay station</b></header>
        <p className="rk-ask">Which team is this iPad for? Put it at the far end, opposite that team's line.</p>
        <div className="rk-teams">
          {g.teams.map((x, i) => (
            <button key={x.name} type="button" className="rk-team" style={{ background: x.colour }} onClick={() => setTeam(i)}>
              <b>{x.name}</b>
              <span>{x.size} runners</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const top = (
    <header className="rk-pad__top" style={{ background: t.colour }}>
      <b>🚀 {t.name} team</b>
      <button type="button" className="rk-change" onClick={() => setTeam(null)}>Change team</button>
    </header>
  );

  if (step.at === 'done') {
    return (
      <div className="rk-pad rk-pad--done" role="status">
        {top}
        <div className="rk-big">
          <div className="rk-big__icon" aria-hidden="true">{step.boosted ? '🚀' : '🏃'}</div>
          <h1>{step.boosted ? `Boost! Run back, ${step.name}!` : `Run back, ${step.name}!`}</h1>
          <p>{t.runner ? `Tag ${t.runner.name}. They're next!` : 'Tag the next runner!'}</p>
        </div>
      </div>
    );
  }

  if (step.at === 'asking') {
    const { kid, question } = step;
    return (
      <div className="rk-pad rk-pad--asking">
        {top}
        <div className="rk-dots" aria-label={`${kid.runRight} of ${kid.perRun} right`}>
          {Array.from({ length: kid.perRun }, (_, i) => <i key={i} className={i < kid.runRight ? 'on' : ''}>{i < kid.runRight ? '🔥' : '○'}</i>)}
        </div>
        <div className="rk-q">
          {question ? (
            <QuestionModal
              key={question.slot}
              question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
              title={kid.secondTry ? `One more try, ${kid.name}!` : `${kid.name}, boost your rocket!`}
              note={kid.perRun > 1 ? `${kid.runRight} of ${kid.perRun} right` : undefined}
              spot="Rocket Relay" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
            />
          ) : <p className="rk-wait">Getting your question…</p>}
        </div>
      </div>
    );
  }

  const won = g.winner !== null ? g.teams[g.winner] : null;
  return (
    <div className="rk-pad">
      {top}
      {!live ? (
        <p className="rk-ask">{view.state === 'lobby' ? 'Waiting for your teacher to start the race.' : 'The race has finished. Well done!'}</p>
      ) : won ? (
        <div className="rk-big"><div className="rk-big__icon" aria-hidden="true">🌕</div><h1>{won.name} team reached the Moon!</h1></div>
      ) : t.runner ? (
        <div className="rk-big">
          <p className="rk-up">You're up!</p>
          <h1 className="rk-runner">{t.runner.name}</h1>
          <button type="button" className="rk-here" disabled={busy} onClick={() => void here()}>{busy ? 'One moment…' : "🏁 I'm here!"}</button>
          {problem && <p className="rk-problem" role="alert">{problem}</p>}
          {sureSkip ? (
            <div className="rk-skip">
              <span>Skip {t.runner.name}?</span>
              <button type="button" onClick={() => void skip()}>Yes, skip</button>
              <button type="button" onClick={() => setSureSkip(false)}>No</button>
            </div>
          ) : <button type="button" className="rk-skip-btn" onClick={() => setSureSkip(true)}>Not here today?</button>}
          {t.next && <p className="rk-next">Next: {t.next.name}</p>}
        </div>
      ) : <p className="rk-ask">Nobody on this team.</p>}
    </div>
  );
}
