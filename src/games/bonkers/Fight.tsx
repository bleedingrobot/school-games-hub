/**
 * Smash Quest's fights: every hit is a maths question (always 4 choices). The server marks each answer and sends the
 * next question; this screen replays the marks with the same rules (shared/bonkers/engine.ts) to show the smashes, hearts and
 * health, so what the pupil sees is exactly what the server will save.
 */
import { useEffect, useRef, useState } from 'react';
import { CLASS_INFO, trainerFor, zoneById, type MonsterInfo } from '../../../shared/bonkers/content';
import { autoSmash, monsterSwings, replay, type Blow, type Foe, type Progress } from '../../../shared/bonkers/engine';
import { BOOSTS, FOE_HEARTS, HEARTS, POINTS, STARS, STICKERS_A_WIN, TRAINER_HEARTS } from '../../../shared/bonkers/config';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import type { AdventureView, AnswerReply, BonkersBackend } from './backend';
import { questWords, xp } from './words';

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

function Hearts({ n, of, full = '❤️', label }: { n: number; of: number; full?: string; label?: string }) {
  return (
    <span className="bq-hearts" aria-label={`${label ?? ''}${n} of ${of} hearts`}>
      {Array.from({ length: of }, (_, i) => <span key={i} aria-hidden="true">{i < n ? full : '🤍'}</span>)}
    </span>
  );
}

/** The order the blows land before a question: the monster swings back after every second smash (any left over at the end). */
function blowOrder(smashes: number, swings: number): ('smash' | 'swing')[] {
  const out: ('smash' | 'swing')[] = [];
  let left = swings;
  for (let i = 0; i < smashes; i++) {
    out.push('smash');
    if (left > 0 && i % 2 === 1) { out.push('swing'); left -= 1; }
  }
  while (left-- > 0) out.push('swing');
  return out;
}

/** The hero's own smashes: a beat before the first (so the last blow can be seen), then one at a time. */
// (Screen tests run them quickly, so they stay inside the test budget: docs/TESTING.md.)
const QUICK = import.meta.env.MODE === 'test';
const AUTO_FIRST_MS = QUICK ? 20 : 1000;
const AUTO_STEP_MS = QUICK ? 20 : 900;

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
  // The hero's own smashes before each question, played one at a time so each can be seen (James, 27 Nov 2026:
  // "the auto attacks need to be seen"): `played.n` smashes have landed for question `played.slot`.
  // The monster swings back after every second smash (James, 28 Nov 2026: "they never seem to get hit").
  const [played, setPlayed] = useState({ slot: -1, n: 0 });
  const adv = view.adventure;
  const r = replay(adv, view.marks);
  const slotNow = view.marks.length;
  const moment = adv.moments?.[slotNow] ?? { autos: 0, boost: 1 };
  const autosNow = moment.autos;
  const swingsNow = monsterSwings(r.hearts, moment, r.calm > 0);
  const stepsNow = autosNow + swingsNow;
  const stepShown = played.slot === slotNow ? played.n : 0;
  const ready = stepsNow === 0 || stepShown > stepsNow; // one beat after the last blow, the question pops up
  const kinds = blowOrder(autosNow, swingsNow);
  const shownKinds = kinds.slice(0, stepShown);
  const swingsShown = shownKinds.filter((k) => k === 'swing').length;
  const smashesShown = shownKinds.length - swingsShown;
  const swingingNow = !ready && kinds[stepShown - 1] === 'swing';
  useEffect(() => {
    if (pause || ready) return;
    const t = setTimeout(() => setPlayed({ slot: slotNow, n: stepShown + 1 }), stepShown === 0 ? AUTO_FIRST_MS : AUTO_STEP_MS);
    return () => clearTimeout(t);
  }, [slotNow, stepShown, pause, ready]);
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
    const next = (
      <button type="button" className="bq-btn bq-btn--big" onClick={() => setPause(r.phase === 'trainer' && !trainer ? { kind: 'trainer' } : null)}>
        {r.phase === 'done' ? 'Finish the adventure' : r.phase === 'trainer' && !trainer ? 'Something’s coming…' : 'Next fight!'}
      </button>
    );
    return (
      <section className="bq-fight" aria-label="Fight over">
        {header}
        {won ? (
          // The victory screen after every won fight (James, 28 Nov 2026).
          <div className="bq-card bq-center bq-victory" style={{ '--bq-c': ci.colour } as React.CSSProperties}>
            <div className="bq-victory__confetti" aria-hidden="true">
              {['⭐', '🎉', '✨', '💥', '🌟', '🎊', '⭐', '✨'].map((c, i) => <span key={i} style={{ '--i': i } as React.CSSProperties}>{c}</span>)}
            </div>
            <p className="bq-victory__banner">VICTORY!</p>
            <div className="bq-victory__scene" aria-hidden="true">
              <span className="bq-face bq-victory__hero">{ci.emoji[hero.look]}</span>
              <span className="bq-face bq-victory__foe">{look.emoji}</span>
            </div>
            <h2 className="bq-h2">You smashed {pause.foe.name}!</h2>
            <p className="bq-speech">{pause.foe.name}: “{look.ouch}”</p>
            <ul className="bq-victory__loot">
              {!trainer && <li className="bq-pop" style={{ animationDelay: '0.5s' }}>✨ <b>+{xp(STARS.win)}</b> XP</li>}
              {!trainer && <li className="bq-pop" style={{ animationDelay: '0.8s' }}>🏷️ <b>+{STICKERS_A_WIN}</b> sticker</li>}
              <li className="bq-pop" style={{ animationDelay: '1.1s' }}>❤️ <b>{pause.blow.hearts}</b> of {trainer ? TRAINER_HEARTS : HEARTS} hearts left</li>
              <li className="bq-pop" style={{ animationDelay: '1.4s' }}>🪙 <b>+{trainer ? POINTS.trainer : POINTS.fightWon}</b> hub points</li>
            </ul>
            {next}
          </div>
        ) : (
        <div className="bq-card bq-center bq-pop">
          <p className="bq-face bq-face--big" aria-hidden="true">{look.emoji}</p>
          <h2 className="bq-h2">Smashed! {pause.foe.name} wins this one.</h2>
          <p>Nothing lost, hero. Dust yourself off!</p>
          {!trainer && <p className="bq-big-line">✨ +{xp(STARS.bonked)} XP</p>}
          {next}
        </div>
        )}
      </section>
    );
  }

  if (pause?.kind === 'trainer' && r.foe) {
    const look = looks(r.foe, adv.quest.zone, adv.start.level);
    return (
      <section className="bq-fight" aria-label="Your trainer">
        {header}
        <div className="bq-card bq-center bq-pop">
          {r.questDone && <p className="bq-big-line">✅ Quest done! +{xp(STARS.quest)} XP</p>}
          <p>Your XP bar is full! Your trainer wants a fight.</p>
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
          {r.questDone && !r.trainerMet && <p className="bq-big-line">✅ Quest done! +{xp(STARS.quest)} XP</p>}
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
  const autoHit = autoSmash(adv.start.power, r.foeHp, moment);
  // The total split into the smashes, landing one by one.
  const landedBy = (n: number) => (moment.autos ? Math.floor((autoHit * Math.min(n, moment.autos)) / moment.autos) : 0);
  const smashing = !ready && stepShown >= 1 && !swingingNow;
  const thisSmash = smashing ? landedBy(smashesShown) - landedBy(smashesShown - 1) : 0;
  const heartsNow = r.hearts - (ready ? swingsNow : swingsShown);
  const hpNow = r.foeHp - (ready ? autoHit : landedBy(smashesShown));
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
        <div className={`bq-side bq-side--hero${(blow?.ouch && stepShown === 0) || swingingNow ? ' bq-shake' : ''}${smashing ? ' bq-lunge' : ''}`} key={`h${blow?.slot ?? 'x'}-${slotNow}-${stepShown}`}>
          <span className="bq-face" aria-hidden="true">{ci.emoji[hero.look]}</span>
          <strong>{ci.names[hero.look]}</strong>
          <Hearts n={heartsNow} of={r.maxHearts} />
          {((blow?.ouch && stepShown === 0) || swingingNow) && <span className="bq-float bq-float--ouch">OUCH!</span>}
          {r.calm > 0 && <span className="bq-tag">🧶 Tied up for {r.calm}</span>}
        </div>
        <div className="bq-vs" aria-hidden="true">VS</div>
        <div className={`bq-side bq-side--foe${(blow && stepShown === 0) || thisSmash ? ' bq-wobble' : ''}${swingingNow ? ' bq-lunge bq-lunge--back' : ''}`} key={`f${slotNow}-${stepShown}`}>
          <span className={`bq-face${foe.big ? ' bq-face--big' : ''}`} aria-hidden="true">{look.emoji}</span>
          <strong>{foe.name}</strong>
          <Hearts n={Math.ceil((FOE_HEARTS * hpNow) / foe.hp)} of={FOE_HEARTS} full="💜" label={`${foe.name}’s health: `} />
          {thisSmash > 0 && <span className="bq-float">SMASH!</span>}
          {stepShown === 0 && blow?.right && <span className="bq-float bq-float--big">×{blow.boost}{blow.special ? '!!' : ''}</span>}
        </div>
      </div>
      {!blow && !ready && r.foeHp === foe.hp && <p className="bq-speech">{foe.name}: “{look.line}”</p>}
      {blow && stepShown === 0 && (
        <p className="bq-blow-line" aria-live="polite">
          {blow.right
            ? (blow.special ? `${ci.move.name}! ×${blow.boost} MEGA SMASH!` : `SMASH! ×${blow.boost} damage!`)
            : blow.ouch ? 'Missed… and it smashed you back!' : 'Missed… but it couldn’t smash you back!'}
        </p>
      )}
      {smashing && <p className="bq-smash-line" aria-live="polite">💥 {ci.names[hero.look]} smashes! <span>{smashesShown} of {moment.autos}</span></p>}
      {swingingNow && <p className="bq-smash-line bq-smash-line--ouch" aria-live="polite">👊 {foe.name} smashes back!</p>}
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
