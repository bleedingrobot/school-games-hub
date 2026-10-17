/** Small battle screen pieces: health and exp bars, name cards, and the Team / Bag / end sheets. */
import type { ReactNode } from 'react';
import type { Bag, BattleEvent, ItemId } from '../../../shared/monsters/engine';
import { speciesOf } from '../../../shared/monsters/monsterBook';
import { expForLevel, maxHpOf, type Monster } from '../../../shared/monsters/rules';
import { TYPE_LABEL } from '../../../shared/monsters/types';
import { MonsterArt } from './art/MonsterArt';
import { ITEM_LABEL, ITEM_NOTE, nameOf } from './text';

export function HealthBar({ monster }: { monster: Monster }) {
  const max = maxHpOf(monster);
  const share = Math.max(0, Math.min(1, monster.hp / max));
  const name = speciesOf(monster.species).name;
  return (
    <div
      className="mb-bar mb-bar--hp"
      data-level={share > 0.5 ? 'ok' : share > 0.2 ? 'warn' : 'low'}
      role="progressbar"
      aria-label={`${name} health`}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={monster.hp}
      aria-valuetext={`${monster.hp} of ${max}`}
    >
      <span style={{ width: `${share * 100}%` }} />
    </div>
  );
}

export function ExpBar({ monster }: { monster: Monster }) {
  const from = expForLevel(monster.level);
  const to = expForLevel(monster.level + 1);
  const share = to > from ? Math.max(0, Math.min(1, (monster.exp - from) / (to - from))) : 1;
  return (
    <div className="mb-bar mb-bar--exp" role="progressbar" aria-label={`${nameOf(monster.species)} experience`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
      <span style={{ width: `${share * 100}%` }} />
    </div>
  );
}

export function TypeChip({ species }: { species: string }) {
  const type = speciesOf(species).type;
  return <span className={`mb-chip mb-chip--${type}`}>{TYPE_LABEL[type]}</span>;
}

/** The name card beside a monster: name, level, type and bars. */
export function NameCard({ monster, mine, side }: { monster: Monster; mine?: boolean; side: 'you' | 'foe' }) {
  return (
    <div className={`mb-card mb-card--${side}`}>
      <div className="mb-card__top">
        <strong className="mb-card__name">{nameOf(monster.species)}{monster.shiny ? ' ✦' : ''}</strong>
        <span className="mb-card__level">Lv {monster.level}</span>
        <TypeChip species={monster.species} />
      </div>
      <HealthBar monster={monster} />
      {mine && (
        <>
          <span className="mb-card__hp">
            {monster.hp} / {maxHpOf(monster)}
          </span>
          <ExpBar monster={monster} />
        </>
      )}
    </div>
  );
}

/** A full-size panel over the battle (Team, Bag, results). */
export function Sheet({ title, children, onBack, backLabel = 'Back' }: { title: string; children: ReactNode; onBack?: () => void; backLabel?: string }) {
  return (
    <div className="mb-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mb-sheet__head">
        <h2>{title}</h2>
        {onBack && (
          <button type="button" className="mb-btn mb-btn--small" onClick={onBack}>
            {backLabel}
          </button>
        )}
      </div>
      <div className="mb-sheet__body">{children}</div>
    </div>
  );
}

export interface TeamListProps {
  team: Monster[];
  active: number;
  /** What the row button says and whether it can be pressed for this monster. */
  action: (m: Monster, i: number) => { label: string; enabled: boolean };
  onPick: (i: number) => void;
}

export function TeamList({ team, active, action, onPick }: TeamListProps) {
  return (
    <ul className="mb-team">
      {team.map((m, i) => {
        const a = action(m, i);
        const tired = m.hp <= 0;
        return (
          <li key={i} className={`mb-team__row${tired ? ' is-tired' : ''}${i === active ? ' is-active' : ''}`}>
            <MonsterArt species={m.species} shiny={m.shiny} size={52} still state={tired ? 'idle' : 'idle'} />
            <div className="mb-team__info">
              <strong>
                {nameOf(m.species)} <span>Lv {m.level}</span> <TypeChip species={m.species} />
              </strong>
              <HealthBar monster={m} />
              <span className="mb-team__hp">{tired ? 'Tired out' : `${m.hp} / ${maxHpOf(m)} health`}{i === active ? ' · out now' : ''}</span>
            </div>
            <button type="button" className="mb-btn mb-btn--small" disabled={!a.enabled} onClick={() => onPick(i)} aria-label={`${a.label} ${nameOf(m.species)}`}>
              {a.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function BagList({ bag, wild, onPick }: { bag: Bag; wild: boolean; onPick: (item: ItemId) => void }) {
  const items: ItemId[] = ['potion', 'super-potion', 'ball', 'great-ball'];
  return (
    <ul className="mb-bag">
      {items.map((item) => {
        const count = bag[item] ?? 0;
        const isBall = item === 'ball' || item === 'great-ball';
        const blocked = isBall && !wild;
        return (
          <li key={item}>
            <button type="button" className="mb-btn mb-bag__item" disabled={count < 1 || blocked} onClick={() => onPick(item)}>
              <span className={`mb-bag__icon mb-bag__icon--${item}`} aria-hidden="true" />
              <span className="mb-bag__text">
                <strong>{ITEM_LABEL[item]}</strong>
                <small>{blocked ? 'Can’t catch a trainer’s monster' : ITEM_NOTE[item]}</small>
              </span>
              <span className="mb-bag__count" aria-label={`${count} left`}>×{count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** What happened in the battle, for the results sheet. */
export function summarise(events: readonly BattleEvent[]) {
  const exp = new Map<string, number>();
  const levels: string[] = [];
  const evolved: { from: string; to: string }[] = [];
  let caught: string | null = null;
  for (const e of events) {
    if (e.kind === 'exp') exp.set(e.monster, (exp.get(e.monster) ?? 0) + e.amount);
    else if (e.kind === 'level-up') levels.push(`${nameOf(e.monster)} reached level ${e.level}`);
    else if (e.kind === 'evolved') evolved.push({ from: e.from, to: e.to });
    else if (e.kind === 'caught') caught = e.monster;
  }
  return { exp: [...exp.entries()], levels, evolved, caught };
}
