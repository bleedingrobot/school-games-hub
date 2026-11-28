/**
 * A pupil's own iPad in Stand Up If (docs/STAND-PLAN.md): the round's sign with their own number ("Stand up if your
 * answer > 40"), their own ladder question, then Stand or Sit (James, 28 Nov 2026: kids press a button for standing or
 * sitting). During the countdown it says what they chose, so they show it for real; then whether they were right and
 * their streak of right in a row. Never shows anyone else's results.
 */
import { useCallback, useEffect, useState } from 'react';
import { SIGN_WORDS, standPhase, type Sign } from '../../../shared/classlive/stand';
import type { StandPlayer, StandPublic } from '../../../shared/classlive/standServer';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { ClassLiveLink } from './link';
import './stand.css';

const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');
const num = (x: number) => String(Math.round(x * 1000) / 1000);

type Asked = { n: number; question: PublicQuestion; sign: Sign; target: number };

function Streak({ me }: { me: StandPlayer }) {
  return (
    <div className="su-streak" aria-label={`${me.streak} right in a row. Best ${me.best}.`}>
      <span className="su-streak__now">🔥 {me.streak} in a row</span>
      <span className="su-streak__best">Best {me.best}</span>
    </div>
  );
}

export function StandPad({ link, room, view, me: meView, setMe, setView, clock }: {
  link: ClassLiveLink;
  room: number | null;
  view: RoomView;
  me: PlayerView | null;
  setMe: (me: PlayerView) => void;
  setView: (v: RoomView) => void;
  clock: () => number;
}) {
  const g = view.game as StandPublic;
  const me: StandPlayer = meView?.game.kind === 'stand' ? meView.game : { kind: 'stand', streak: 0, best: 0, spots: 0, go: null, last: null };
  const [now, setNow] = useState(() => clock());
  const [asked, setAsked] = useState<Asked | null>(null);
  const [problem, setProblem] = useState('');
  const [again, setAgain] = useState(0);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(clock()), 250);
    return () => window.clearInterval(id);
  }, [clock]);
  const t = view.startedAt === null ? 0 : Math.max(0, now - view.startedAt);
  const r = g.round;
  const phase = r && view.state === 'live' ? standPhase(r, t) : null;

  const send = useCallback(async (body: Record<string, unknown>) => {
    try {
      const out = await link.send({ room, ...body });
      const b = out.body as { view?: RoomView; me?: PlayerView };
      if (b.view) setView(b.view);
      if (b.me) setMe(b.me);
      return out;
    } catch {
      return { status: 0, body: { error: 'We lost the connection. Try again.' } as Record<string, unknown> };
    }
  }, [link, room, setView, setMe]);

  // This round's question and number (asked once a round; again every 2 s if it didn't come).
  const need = phase === 'think' && r && !me.go && asked?.n !== r.n ? r.n : null;
  useEffect(() => {
    if (need === null) return;
    let dead = false;
    void send({ action: 'ask' }).then((out) => {
      if (dead) return;
      const b = out.body as { question?: PublicQuestion; n?: number; sign?: Sign; target?: number };
      if (out.status === 200 && b.question && b.n === need && b.sign && typeof b.target === 'number') setAsked({ n: b.n, question: b.question, sign: b.sign, target: b.target });
      else if (out.status !== 200 || !b.question) window.setTimeout(() => { if (!dead) setAgain((n) => n + 1); }, 2000);
    });
    return () => { dead = true; };
  }, [need, send, again]);

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    if (!asked) throw new Error('Try again.');
    const q = asked.question;
    const out = await send({ action: 'answer', n: asked.n, slot: q.slot, answer: value, ms });
    const b = out.body as { right?: boolean; answer?: number; error?: string; reason?: string };
    if (out.status !== 200) {
      if (b.reason === 'old_round') setAsked(null);
      throw new Error(String(b.error ?? 'Try again.'));
    }
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };

  const choose = async (stand: boolean) => {
    if (!me.go) return;
    setChoosing(true);
    setProblem('');
    const out = await send({ action: 'play', n: me.go.n, stand });
    setChoosing(false);
    if (out.status !== 200) setProblem(String((out.body as { error?: string }).error ?? 'Try again.'));
  };

  const top = (
    <header className="su-pad__top">
      <b>🧍 Stand Up If</b>
      <Streak me={me} />
    </header>
  );

  if (view.state === 'over') {
    return (
      <div className="su-pad">
        {top}
        <div className="su-pad__big">
          <div className="su-pad__icon" aria-hidden="true">🐊</div>
          <h1>Well done!</h1>
          <p>You got {me.spots} {me.spots === 1 ? 'round' : 'rounds'} right. Your best streak: {me.best} in a row.</p>
        </div>
      </div>
    );
  }
  if (!r || !phase) {
    return (
      <div className="su-pad">
        {top}
        <div className="su-pad__big"><div className="su-pad__icon" aria-hidden="true">🐊</div><h1>{view.state === 'lobby' ? 'Waiting for your teacher to start.' : 'Get ready!'}</h1></div>
      </div>
    );
  }

  const go = me.go && me.go.n === r.n ? me.go : null;

  if (phase === 'think') {
    if (!go) {
      return (
        <div className="su-pad su-pad--asking">
          {top}
          {asked && asked.n === r.n ? (
            <>
              <div className="su-mine" aria-label={`Stand up if your answer is ${SIGN_WORDS[asked.sign].words} ${num(asked.target)}`}>
                <span>Stand up if your answer</span>
                <b className="su-mine__sign">{asked.sign}</b>
                <b className="su-mine__num">{num(asked.target)}</b>
              </div>
              <div className="su-q">
                <QuestionModal
                  key={`${r.n}:${asked.question.slot}`}
                  question={{ id: asked.question.slot, parts: asked.question.parts, spoken: asked.question.spoken, prompt: asked.question.prompt, choices: asked.question.choices, choiceLabels: asked.question.choiceLabels, input: asked.question.input, maxLength: asked.question.maxLength }}
                  title="Work out your answer"
                  note={`Then check: is it ${SIGN_WORDS[asked.sign].words} ${num(asked.target)}?`}
                  spot="Stand Up If" inline scribble={false} onSubmit={onSubmit} onDone={() => undefined}
                />
              </div>
            </>
          ) : <p className="su-wait">Getting your question…</p>}
        </div>
      );
    }
    const sentence = `${num(go.answer)} ${go.sign} ${num(go.target)}`;
    return (
      <div className="su-pad">
        {top}
        <div className="su-pad__big">
          <p className="su-answer">{go.right ? '✅ ' : ''}The answer is <b>{num(go.answer)}</b>{go.right ? '' : ' (not quite this time)'}</p>
          <h1 className="su-ask">Is <span className="su-ask__sum">{sentence}</span> ?</h1>
          <p className="su-ask__words">Is {num(go.answer)} {SIGN_WORDS[go.sign].words} {num(go.target)}?</p>
          <div className="su-choose" role="group" aria-label="Stand or sit">
            <button type="button" className={`su-pick su-pick--stand ${go.stand === true ? 'su-pick--on' : ''}`} aria-pressed={go.stand === true} disabled={choosing} onClick={() => void choose(true)}>
              <span aria-hidden="true">🧍</span>Yes: Stand
            </button>
            <button type="button" className={`su-pick su-pick--sit ${go.stand === false ? 'su-pick--on' : ''}`} aria-pressed={go.stand === false} disabled={choosing} onClick={() => void choose(false)}>
              <span aria-hidden="true">🪑</span>No: Sit
            </button>
          </div>
          <p className="su-locked" role="status">{go.stand === null ? 'Tap one.' : 'Locked in! You can change it until the countdown.'}</p>
          {problem && <p className="su-problem" role="alert">{problem}</p>}
        </div>
      </div>
    );
  }

  if (phase === 'stand') {
    return (
      <div className={`su-pad su-pad--show ${go?.stand === true ? 'su-pad--stand' : go?.stand === false ? 'su-pad--sit' : ''}`}>
        {top}
        <div className="su-pad__big">
          {go?.stand === true ? <><div className="su-pad__icon" aria-hidden="true">🧍</div><h1>Stand up!</h1></>
            : go?.stand === false ? <><div className="su-pad__icon" aria-hidden="true">🪑</div><h1>Stay sitting!</h1></>
              : <><div className="su-pad__icon" aria-hidden="true">⏰</div><h1>Too late this round. Stay sitting!</h1></>}
        </div>
      </div>
    );
  }

  // Results (once the server has revealed this round).
  const last = me.last && me.last.n === r.n ? me.last : null;
  if (!last) {
    return <div className="su-pad">{top}<div className="su-pad__big"><h1>Checking…</h1></div></div>;
  }
  const sum = `${num(last.answer)} ${last.sign} ${num(last.target)}`;
  const why = last.truth ? `${sum} is true, so stand.` : `${sum} is not true, so sit.`;
  return (
    <div className={`su-pad ${last.spot ? 'su-pad--right' : 'su-pad--wrong'}`}>
      {top}
      <div className="su-pad__big" role="status">
        {!last.took ? (
          <><div className="su-pad__icon" aria-hidden="true">⏰</div><h1>You missed this round.</h1><p>Answer and tap Stand or Sit before the countdown.</p></>
        ) : last.spot ? (
          <><div className="su-pad__icon" aria-hidden="true">🎉</div><h1>Right!</h1><p className="su-why">{why}</p>{me.streak >= 2 && <p className="su-hot">🔥 {me.streak} in a row!</p>}</>
        ) : (
          <><div className="su-pad__icon" aria-hidden="true">💪</div><h1>Not this time.</h1><p className="su-why">{why}</p>{!last.right && <p>Your answer wasn't right, so this round doesn't count.</p>}<p>New streak next round!</p></>
        )}
      </div>
    </div>
  );
}
