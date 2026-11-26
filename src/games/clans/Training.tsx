import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { train, trainOptions, type TrainKey, type TrainOption } from './places';
import type { Session, Change } from './session';
import { PlaceSprite, Portrait } from './Sprite';
import { TRAIN_HELP } from './text';
import { RecBadge } from './RecBadge';
import { lookOf } from '../../../shared/clans/looks';

type Phase = { t: 'idle' } | { t: 'choose'; opt: TrainOption } | { t: 'done'; text: string };

/** The Training Hall: spend a member's points. Pick what to train, then choose how many. */
export function Training({ session, onChange, onBack }: { session: Session; onChange: Change; onBack: () => void }) {
  const { clan } = session;
  const [mi, setMi] = useState(0);
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const member = clan.members[mi];
  const hall = clan.village.trainingHall;
  const options = trainOptions(member, hall);
  const idle = () => setPhase({ t: 'idle' });

  const pick = (opt: TrainOption) => setPhase({ t: 'choose', opt });
  const buyNow = (key: TrainKey, count: number, label: string) => {
    const next = train(session, mi, key, count);
    if (!next) return;
    onChange(next, { type: 'train', member: mi, key, count });
    setPhase({ t: 'done', text: `${member.name} trained ${label} ${count > 1 ? `${count} times` : 'once'}. ${next.clan.members[mi].points} points left.` });
  };

  let body: React.ReactNode;
  if (phase.t === 'choose') {
    const { opt } = phase;
    body = (
      <div className="cq-panel">
        <p title={TRAIN_HELP[opt.key]}>{opt.label}: <strong>{opt.cost} points</strong> for each {opt.gives}. {member.name} has <strong>{member.points}</strong> points.</p>
        {opt.most === 0 ? <p className="cq-warn">That is not possible right now.</p> : (
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => buyNow(opt.key, 1, opt.label.toLowerCase())}>Buy 1</button>
            {opt.most > 1 && <button type="button" className="cq-btn" onClick={() => buyNow(opt.key, opt.most, opt.label.toLowerCase())}>Buy {opt.most} (all you can)</button>}
            <button data-key="esc" type="button" className="cq-btn" onClick={idle}>Not now</button>
          </div>
        )}
      </div>
    );
  } else if (phase.t === 'done') {
    body = <div className="cq-panel" role="status"><p className="cq-note">{phase.text}</p><button data-key="enter" type="button" className="cq-btn cq-btn--hot" autoFocus onClick={idle}>Keep training</button></div>;
  } else {
    body = (
      <table className="cq-train">
        <caption className="cq-soft">Training Hall level {hall}. Choose what to train. <span className="cq-rec">★ Main</span> is the most important stat for a {member.cls}, and <span className="cq-rec cq-rec--also">Also good</span> are worth training next. Hover over a name to see what it does.</caption>
        <thead><tr><th scope="col">What</th><th scope="col">Each costs</th><th scope="col"><span className="sr-only">Buy</span></th></tr></thead>
        <tbody>
          {options.map((o) => (
            <tr key={o.key}>
              <th scope="row" title={TRAIN_HELP[o.key]}>
                {o.label}
                <RecBadge cls={member.cls} stat={o.key} />
                {' '}<small className="cq-soft">{o.gives}</small>
              </th>
              <td>{o.cost} points</td>
              <td><button type="button" className="cq-btn" disabled={o.most === 0} aria-label={`Train ${o.label}`} onClick={() => pick(o)}>{o.most === 0 ? (member.points === 0 ? 'No points' : o.cost > member.points ? 'Not enough' : 'At the top') : 'Train'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <section className="cq-place" aria-label="The Training Hall">
      <div className="cq-place__head">
        <h2><PlaceSprite place="training" /> The Training Hall</h2>
        <button data-key="esc" type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <p className="cq-soft">Members earn <strong>{CONFIG.pointsPerLevel} training points</strong> for every level. Who is training?</p>
      <div className="cq-pick" role="group" aria-label="Who is training?">
        {clan.members.map((m, i) => (
          <button key={m.name} type="button" className="cq-btn cq-pick__btn" aria-pressed={i === mi} onClick={() => { setMi(i); idle(); }}>
            <Portrait race={m.race} cls={m.cls} look={lookOf(m)} scale={2} />
            <span><strong>{m.name}</strong><br /><small>{m.points} points to spend</small></span>
          </button>
        ))}
      </div>
      <p aria-live="polite"><strong>{member.name}</strong> has <strong>{member.points}</strong> points left.</p>
      {body}
    </section>
  );
}
