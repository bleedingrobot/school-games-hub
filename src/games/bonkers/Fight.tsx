/**
 * Smash Quest's fights: every hit is a maths question (always 4 choices). The server marks each answer and sends the
 * next question; this screen replays the marks with the same rules (shared/bonkers/engine.ts) to show the smashes, hearts and
 * health, so what the pupil sees is exactly what the server will save.
 */
import { useEffect, useRef, useState } from 'react';
import { CLASS_INFO, trainerFor, zoneById, type MonsterInfo } from '../../../shared/bonkers/content';
import { autoSmash, replay, type Blow, type Foe, type Progress } from '../../../shared/bonkers/engine';
import { BOOSTS } from '../../../shared/bonkers/config';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import type { AdventureView, AnswerReply, BonkersBackend } from './backend';
import { questWords } from './words';

const shown = (q: PublicQuestion): ShownQuestion => ({ id: q.slot, parts: q.parts, spoken: q.spoken, prompt: q.prompt, choices: q.choices, choiceLabels: q.choiceLabels, maxLength: q.maxLength, input: q.input, figure: q.figure });

/** "6 × 7 = 42" from the question's parts, putting the answer where the question mark was. */
export function factText(parts: readonly string[], answer: number): string {
  if (!Number.isFinite(answer)) return '';
  return parts.some((p) => p.includes('?')) ? parts.map((p) => p.replace('?', String(answer))).join(' ') : `${parts.join(' ')} = ${answer}`;
}

/** How a foe looks: a zone monster, the zone's big one, or a trainer. */
function looks(foe: Foe, zoneId: string, level: number): { emoji: string; colour: string; line: string; ouch: string } {
  if (foe.id.startsWith('trainer-')) {
    const t = trainerFor(level);
    return { emoji: t?.emoji ?? '🏋️', colour: t?.colour ?? '#888', line: t?.line ?? 'Fight me!', ouch: t?.beaten ?? 'Well done!' };
  }
  const zone = zoneById(zoneId);
  const mon: MonsterInfo | undefined = zone ? [...zone.monsters, zone.big].find((m) => m.id === foe.id) : undefined;
  return { emoji: mon?.emoji ?? '👾', colour: mon?.colour ?? '#888', line: mon?.line ?? 'Grrr!', ouch: mon?.ouch ?? 'Ouch!' };
}

function Hearts({ n, of }: { n: number; of: number }) {
  return (
    <span className="bq-hearts" aria-label={`${n} of ${of} hearts`}>
      {Array.from({ length: of }, (_, i) => <span key={i} aria-hidden="true">{i < n ? '❤️' : '🤍'}</span>)}
    </span>
  );
}

type Pause = { kind: 'ended'; blow: Blow; foe: Foe } | { kind: 'trainer' } | null;

export function Fight({ backend, progress, start, onDone }: {
  backend: BonkersBackend; progress: Progress; start: AdventureView; onDone: (current: AdventureView) => Promise<void>;
}) {
  const [view, setView] = useState<AdventureView>(start);
  const [asking, setAsking] = useState<{ special: boolean } | null>(null);
  const [pause, setPause] = useState<Pause>(null);
  const [lastBlow, setLastBlow] = useState<Blow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The answer waiting for the feedback to finish, so the bonk lands after "Correct!".
  const pending = useRef<AnswerReply | null>(null);
  // The question slot whose auto smashes have played (they play for about a second before each question pops up).
  const [smashed, setSmashed] = useState(-1);
  const slotNow = view.marks.length;
  useEffect(() => {
    if (pause || smashed === slotNow) return;
    const t = setTimeout(() => setSmashed(slotNow), (view.adventure.moments?.[slotNow]?.autos ?? 0) ? 1500 : 0);
    return () => clearTimeout(t);
  }, [slotNow, smashed, pause, view.adventure.moments]);
  const adv = view.adventure;
  const r = replay(adv, view.marks);
  const cls = adv.start.cls;
  const hero = progress.hero ?? { cls, look: 'girl' as const };
  const ci = CLASS_INFO[cls];
  const zone = zoneById(adv.quest.zone);
  const quest = questWords(adv.quest);

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      await onDone(view);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That couldn’t be saved. Try again.');
      setSaving(false);
    }
  };

  const fightDots = (
    <ol className="bq-dots" aria-label={`Fight ${Math.min(r.fight + 1, adv.foes.length)} of ${adv.foes.length}`}>
      {adv.foes.map((f, i) => {
        const res = r.results.filter((x) => !x.trainer)[i];
        return <li key={i} className={res ? `bq-dots--${res.outcome}` : i === r.fight && r.phase === 'fight' ? 'bq-dots--now' : ''}>{f.big ? '★' : i + 1}</li>;
      })}
      {r.trainerMet && <li className={r.phase === 'trainer' ? 'bq-dots--now' : r.trainerWon ? 'bq-dots--won' : 'bq-dots--bonked'}>🏋️</li>}
    </ol>
  );

  const header = (
    <div className="bq-fight__top" style={{ background: zone ? `linear-gradient(90deg, ${zone.sky[0]}, ${zone.sky[1]})` : undefined }}>
      <span><b>{zone?.name}</b> · {quest.title}</span>
      {fightDots}
    </div>
  );

  // A fight just ended: say how it went before the next one (or the trainer, or the end).
  if (pause?.kind === 'ended') {
    const look = looks(pause.foe, adv.quest.zone, adv.start.level);
    const won = pause.blow.ended === 'won';
    const trainer = pause.foe.id.startsWith('trainer-');
    return (
      <section className="bq-fight" aria-label="Fight over">
        {header}
        <div className="bq-card bq-center bq-pop">
          <p className="bq-face bq-face--big" aria-hidden="true">{won ? '💫' : look.emoji}</p>
          <h2 className="bq-h2">{won ? `You smashed ${pause.foe.name}!` : `Smashed! ${pause.foe.name} wins this one.`}</h2>
          <p>{won ? `“${look.ouch}”` : 'Nothing lost, hero. Dust yourself off!'}</p>
          {!trainer && <p className="bq-big-line">⭐ +{won ? 3 : 1} {won ? 'stars' : 'star'}</p>}
          <button type="button" className="bq-btn bq-btn--big" onClick={() => setPause(r.phase === 'trainer' && !trainer ? { kind: 'trainer' } : null)}>
            {r.phase === 'done' ? 'Finish the adventure' : r.phase === 'trainer' && !trainer ? 'Something’s coming…' : 'Next fight!'}
          </button>
        </div>
      </section>
    );
  }

  if (pause?.kind === 'trainer' && r.foe) {
    const look = looks(r.foe, adv.quest.zone, adv.start.level);
    return (
      <section className="bq-fight" aria-label="Your trainer">
        {header}
        <div className="bq-card bq-center bq-pop">
          {r.questDone && <p className="bq-big-line">✅ Quest done! +3 stars</p>}
          <p>Your star bar is full! Your trainer wants a fight.</p>
          <p className="bq-face bq-face--big" aria-hidden="true">{look.emoji}</p>
          <h2 className="bq-h2">{r.foe.name}</h2>
          <p className="bq-speech">“{look.line}”</p>
          <p>Beat them to reach level {adv.start.level + 1}. You have {r.maxHearts} hearts this time.</p>
          <button type="button" className="bq-btn bq-btn--big" onClick={() => setPause(null)}>Fight!</button>
        </div>
      </section>
    );
  }

  if (r.phase === 'done') {
    return (
      <section className="bq-fight" aria-label="Adventure over">
        {header}
        <div className="bq-card bq-center bq-pop">
          {r.questDone && !r.trainerMet && <p className="bq-big-line">✅ Quest done! +3 stars</p>}
          <p className="bq-face bq-face--big" aria-hidden="true">🧰</p>
          <h2 className="bq-h2">Adventure over!</h2>
          <button type="button" className="bq-btn bq-btn--big" disabled={saving} onClick={() => void finish()}>{saving ? 'Saving…' : 'See what you got'}</button>
          {error && <p className="bq-note" role="alert">{error}</p>}
        </div>
      </section>
    );
  }

  const foe = r.foe as Foe;
  const look = looks(foe, adv.quest.zone, adv.start.level);
  // The last answer's bonk, while it's still this fight's.
  const blow = lastBlow && !lastBlow.ended && r.blows.at(-1)?.slot === lastBlow.slot ? lastBlow : null;
  const q = view.question;
  const moment = adv.moments?.[slotNow] ?? { autos: 0, boost: 1 };
  const autoHit = autoSmash(adv.start.power, r.foeHp, moment);
  const ready = smashed === slotNow;
  const hpNow = ready ? r.foeHp - autoHit : r.foeHp;
  const boost = BOOSTS.find((b) => b.times === moment.boost);

  const answer = async (value: number, ms: number): Promise<MarkedAnswer> => {
    if (!q || !asking) throw new Error('No question');
    try {
      const a = await backend.answer(view.seed, q.slot, value, ms, asking.special);
      pending.current = a;
      return { correct: a.correct, fact: factText(q.parts, a.answer), boxBefore: 0, boxAfter: 0, answer: a.answer, ...(a.correct ? { reward: 'SMASH!' } : {}) };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That couldn’t be marked. Try again.');
      setAsking(null);
      throw e;
    }
  };

  const landed = () => {
    const a = pending.current;
    pending.current = null;
    setAsking(null);
    if (!a) return;
    const next: AdventureView = { ...view, marks: a.marks, question: a.question };
    const after = replay(adv, a.marks);
    const b = after.blows.at(-1) ?? null;
    setView(next);
    setLastBlow(b);
    if (b?.ended) setPause({ kind: 'ended', blow: b, foe });
  };

  return (
    <section className="bq-fight" aria-label={`Fight: ${foe.name}`}>
      {header}
      <div className="bq-arena" style={{ background: zone ? `linear-gradient(${zone.sky[0]}, ${zone.sky[1]} 62%, ${zone.ground} 62%)` : undefined }}>
        <div className={`bq-side bq-side--hero${blow?.ouch ? ' bq-shake' : ''}`} key={`h${blow?.slot ?? 'x'}`}>
          <span className="bq-face" aria-hidden="true">{ci.emoji[hero.look]}</span>
          <strong>{ci.names[hero.look]}</strong>
          <Hearts n={r.hearts} of={r.maxHearts} />
          {blow?.ouch && <span className="bq-float bq-float--ouch">OUCH!</span>}
          {r.calm > 0 && <span className="bq-tag">🧶 Tied up for {r.calm}</span>}
        </div>
        <div className="bq-vs" aria-hidden="true">VS</div>
        <div className={`bq-side bq-side--foe${blow || (ready && autoHit) ? ' bq-wobble' : ''}`} key={`f${slotNow}${ready ? 'a' : ''}`}>
          <span className={`bq-face${foe.big ? ' bq-face--big' : ''}`} aria-hidden="true">{look.emoji}</span>
          <strong>{foe.name}</strong>
          <div className="bq-hp" role="progressbar" aria-label={`${foe.name}’s health`} aria-valuemin={0} aria-valuemax={foe.hp} aria-valuenow={hpNow}>
            <div className="bq-hp__fill" style={{ width: `${(100 * hpNow) / foe.hp}%`, background: look.colour }} />
          </div>
          <span className="bq-hp__num">{hpNow} / {foe.hp}</span>
          {ready && autoHit > 0 && <span className="bq-float">-{autoHit}</span>}
          {!ready && blow?.right && <span className="bq-float bq-float--big">-{blow.hit}{blow.special ? '!!' : ''}</span>}
        </div>
      </div>
      {!blow && !ready && r.foeHp === foe.hp && <p className="bq-speech">{foe.name}: “{look.line}”</p>}
      {blow && !ready && (
        <p className="bq-blow-line" aria-live="polite">
          {blow.right
            ? (blow.special ? `${ci.move.name}! ×${blow.boost} MEGA SMASH!` : `SMASH! ×${blow.boost} damage!`)
            : blow.ouch ? 'Missed… and it smashed you back!' : 'Missed… but it couldn’t smash you back!'}
        </p>
      )}
      {!ready && <p className="bq-hint" aria-live="polite">{moment.autos ? 'Smash… smash… smash…' : ''}</p>}
      {ready && q && (
        <div className={`bq-boost bq-pop bq-boost--x${moment.boost}`} role="status">
          <p className="bq-boost__name">⚡ {boost?.name ?? 'SMASH TIME!'}</p>
          <p className="bq-boost__what">Answer right to smash for ×{moment.boost} damage!{moment.boost >= 10 ? ' That’s ABSURD!' : ''}</p>
          <div className="bq-actions">
            <button type="button" className="bq-btn bq-btn--big" disabled={!!asking} onClick={() => setAsking({ special: false })}>
              <span aria-hidden="true">💥</span> Answer it!
            </button>
            <button
              type="button" className="bq-btn bq-btn--special" style={{ '--bq-c': ci.colour } as React.CSSProperties}
              disabled={!!asking || r.specialUsed} onClick={() => setAsking({ special: true })} title={ci.move.does}
            >
              <span aria-hidden="true">✨</span> {ci.move.name}{r.specialUsed ? ' (used)' : ''}
            </button>
          </div>
          <p className="bq-hint">{r.specialUsed ? 'Special move used this fight.' : `${ci.move.name}: ${ci.move.does} Once a fight.`}</p>
        </div>
      )}
      {error && <p className="bq-note" role="alert">{error}</p>}
      {asking && q && (
        <QuestionModal
          question={shown(q)}
          title={asking.special ? `${ci.move.name}! ×${moment.boost}` : (boost?.name ?? 'Smash it!')}
          note={asking.special ? ci.move.does : `Right: a ×${moment.boost} smash. Wrong: no smash, and it may smash you back.`}
          spot="Smash Quest"
          onSubmit={answer}
          onDone={landed}
        />
      )}
    </section>
  );
}
