import { useState } from 'react';
import { SPELLS } from '../../../shared/clans/spells';
import type { Member } from '../../../shared/clans/types';
import { Bar } from './Bars';
import { ItemSprite, Portrait } from './Sprite';
import { headline } from './session';
import { CARD_HELP, CLASS_TEXT, RACE_TEXT, TRAIN_HELP } from './text';
import { LOOKS, lookOf, type Look } from '../../../shared/clans/looks';
import { memberThumb } from './art';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const LOOK_NAMES: Record<Look, string> = { 'female-1': 'Girl 1', 'female-2': 'Girl 2', 'male-1': 'Boy 1', 'male-2': 'Boy 2' };

/** The four paintings of this race and class, to pick one. Only the picture changes. */
export function LookPicker({ race, cls, value, onPick }: { race: string; cls: string; value: Look; onPick: (look: Look) => void }) {
  return (
    <div className="cq-looks" role="group" aria-label="Look">
      {LOOKS.map((look) => {
        const src = memberThumb(race, cls, look);
        return (
          <button key={look} type="button" className="cq-btn cq-look" aria-pressed={look === value} aria-label={LOOK_NAMES[look]} title={LOOK_NAMES[look]} onClick={() => onPick(look)}>
            {src ? <img src={src} alt="" /> : LOOK_NAMES[look]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A member: portrait, name, and by default only HP, attack, defence and one star. "More details" shows the rest.
 * With `onLook`, a "Change look" button opens the four paintings to pick from.
 */
export function MemberCard({ member, leader = false, onLook, children }: { member: Member; leader?: boolean; onLook?: (look: Look) => void; children?: React.ReactNode }) {
  const [more, setMore] = useState(false);
  const [picking, setPicking] = useState(false);
  const h = headline(member);
  const spells = member.spells.map((id) => SPELLS[id]).filter((s) => s && !s.notYet);
  return (
    <article className="cq-card" aria-label={member.name}>
      <header className="cq-card__head">
        <Portrait race={member.race} cls={member.cls} look={lookOf(member)} scale={4} />
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
          <span key={k}>{label}: {member.gear[k] ? <><ItemSprite name={member.gear[k]!} kind={k} scale={1.3} /> {member.gear[k]}</> : 'none'}</span>
        ))}
      </p>
      {children}
      {onLook && (
        <>
          <button type="button" className="cq-link" aria-expanded={picking} onClick={() => setPicking(!picking)}>
            {picking ? 'Done' : 'Change look'}
          </button>
          {picking && <LookPicker race={member.race} cls={member.cls} value={lookOf(member)} onPick={onLook} />}
        </>
      )}
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
