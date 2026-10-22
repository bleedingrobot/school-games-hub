import { useState } from 'react';
import { SPELLS } from '../../../shared/clans/spells';
import type { Member } from '../../../shared/clans/types';
import { Bar } from './Bars';
import { Portrait } from './Sprite';
import { headline } from './session';
import { CARD_HELP, CLASS_TEXT, RACE_TEXT, TRAIN_HELP } from './text';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** A member: portrait, name, and by default only HP, attack, defence and one star. "More details" shows the rest. */
export function MemberCard({ member, leader = false, children }: { member: Member; leader?: boolean; children?: React.ReactNode }) {
  const [more, setMore] = useState(false);
  const h = headline(member);
  const spells = member.spells.map((id) => SPELLS[id]).filter((s) => s && !s.notYet);
  return (
    <article className="cq-card" aria-label={member.name}>
      <header className="cq-card__head">
        <Portrait race={member.race} cls={member.cls} scale={4} />
        <div>
          <h3>
            {member.name}
            {leader && <span className="cq-tag"> leader</span>}
            {member.knockedOut && <span className="cq-tag cq-tag--out"> knocked out</span>}
            {member.points > 0 && <span className="cq-tag cq-tag--up"> {member.points} points to spend</span>}
          </h3>
          <p className="cq-soft">
            {member.race} {member.cls} · level {member.level}
          </p>
        </div>
      </header>
      <dl className="cq-headline">
        <div title={CARD_HELP.hp}><dt>HP</dt><dd>{h.hp}</dd></div>
        <div title={CARD_HELP.attack}><dt>Attack</dt><dd>{h.attack}</dd></div>
        <div title={CARD_HELP.defence}><dt>Defence</dt><dd>{h.defence}</dd></div>
        <div title={CARD_HELP.star}><dt>★ Best</dt><dd>{cap(h.star.name)} {h.star.value}</dd></div>
      </dl>
      <p className="cq-gear">
        {([['weapon', 'Weapon'], ['armor', 'Armour'], ['shield', 'Shield']] as const).map(([k, label]) => (
          <span key={k}>{label}: {member.gear[k] ?? 'none'}</span>
        ))}
      </p>
      {children}
      <button type="button" className="cq-link" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? 'Fewer details' : 'More details'}
      </button>
      {more && (
        <div className="cq-more">
          <p className="cq-soft">{RACE_TEXT[member.race]} {CLASS_TEXT[member.cls]}</p>
          <dl className="cq-stats">
            {Object.entries(member.stats).map(([k, v]) => (
              <div key={k} title={TRAIN_HELP[k]}><dt>{cap(k)}</dt><dd>{v}</dd></div>
            ))}
            <div title={CARD_HELP.sp}><dt>Skill points</dt><dd>{member.maxSp}</dd></div>
          </dl>
          <p className="cq-soft">Spells: {spells.length ? spells.map((s) => s.name).join(', ') : 'none'}</p>
          <Bar label="HP" value={member.hp} max={member.maxHp} kind="hp" />
          {member.maxSp > 0 && <Bar label="SP" value={member.sp} max={member.maxSp} kind="sp" />}
        </div>
      )}
    </article>
  );
}
