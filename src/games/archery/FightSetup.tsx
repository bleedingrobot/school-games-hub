/**
 * Before a fight (docs/ARCHERY-PLAN.md, section 1): pick a world and a bot, then pack your quiver from what you own:
 * how many of each arrow and helper to bring, which shield and which bow. What you pack is taken out of your bag
 * when the fight starts; anything you don't use comes back at the end.
 */
import { useEffect, useRef, useState } from 'react';
import { arrowKind, isArrowId } from '../../../shared/archery/arrows';
import { BOT_KITS, BOT_LEVELS, BOT_NAMES, BOT_SHIELDS, type BotLevel } from '../../../shared/archery/bot';
import { BOWS, helperKind, isHelperId, shieldKind } from '../../../shared/archery/gear';
import { CARRY_MOST } from '../../../shared/archery/shop';
import { WORLD_IDS, type BowId, type ItemId, type PlayerSetup, type ShieldId, type WorldId } from '../../../shared/archery/types';
import type { ArmoryState } from '../../data/archery';
import { ItemIcon } from './ItemIcon';
import { LEVEL_NAMES, WORLD_HINTS, WORLD_NAMES } from './text';

const LEVEL_HINTS: Record<BotLevel, string> = {
  easy: 'Guesses, then walks its shots towards you. Ignores the wind.',
  medium: 'Works out a good shot, but forgets the wind at first.',
  hard: 'Thinks about the wind too. Still misses sometimes!',
};

const itemName = (id: ItemId) => (isHelperId(id) ? helperKind(id).name : arrowKind(id).name);

function botKit(l: BotLevel): string {
  const parts = Object.entries(BOT_KITS[l]).map(([id, n]) => `${n} ${arrowKind(id as never).name}${(n ?? 0) > 1 ? 's' : ''}`);
  const sh = BOT_SHIELDS[l];
  return `Brings ${parts.join(', ')}${sh ? ` and a ${shieldKind(sh).name}` : ''}.`;
}

export function PickScreen({ world, level, onWorld, onLevel, onNext, onBack }: {
  world: WorldId;
  level: BotLevel;
  onWorld: (w: WorldId) => void;
  onLevel: (l: BotLevel) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="ar-page" aria-labelledby="ar-pick-title">
      <div className="ar-page__head">
        <h2 id="ar-pick-title" ref={heading} tabIndex={-1}>Pick your fight</h2>
        <button type="button" className="button button--light ar-btn" onClick={onBack}>Back</button>
      </div>
      <h3>1. Where?</h3>
      <div className="ar-choices">
        {WORLD_IDS.map((w) => (
          <button key={w} type="button" className={`button button--light ar-btn ar-choice ar-choice--${w}`} aria-pressed={world === w} onClick={() => onWorld(w)}>
            <b>{WORLD_NAMES[w]}</b>
            <span>{WORLD_HINTS[w]}</span>
          </button>
        ))}
      </div>
      <h3>2. Against which bot?</h3>
      <div className="ar-choices ar-choices--three">
        {BOT_LEVELS.map((l) => (
          <button key={l} type="button" className="button button--light ar-btn ar-choice" aria-pressed={level === l} onClick={() => onLevel(l)}>
            <b>{BOT_NAMES[l]} ({LEVEL_NAMES[l]})</b>
            <span>{LEVEL_HINTS[l]}</span>
            <small>{botKit(l)}</small>
          </button>
        ))}
      </div>
      <p className="ar-page__go">
        <button type="button" className="button button--play ar-btn ar-btn--big" onClick={onNext}>Next: pack your quiver</button>
      </p>
    </section>
  );
}

/** What to pack by default: the last pack, trimmed to what you still own. */
export function trimPack(p: PlayerSetup | null, state: ArmoryState): PlayerSetup {
  const quiver: PlayerSetup['quiver'] = {};
  for (const [id, n] of Object.entries(p?.quiver ?? {}) as [ItemId, number][]) {
    const k = Math.min(n, state.gear[id] ?? 0, CARRY_MOST);
    if (k > 0) quiver[id] = k;
  }
  const shield = p?.shield && state.shields.includes(p.shield) ? p.shield : null;
  const bow = p?.bow && p.bow !== 'starter' && state.bows.includes(p.bow) ? p.bow : 'starter';
  return { quiver, shield, bow };
}

export function PackScreen({ state, world, level, initial, busy, problem, onFight, onArmory, onBack }: {
  state: ArmoryState;
  world: WorldId;
  level: BotLevel;
  initial: PlayerSetup;
  busy: boolean;
  problem: string;
  onFight: (pack: PlayerSetup) => void;
  onArmory: () => void;
  onBack: () => void;
}) {
  const [pack, setPack] = useState<PlayerSetup>(initial);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const owned = (Object.entries(state.gear) as [ItemId, number][]).filter(([, n]) => n > 0);
  const arrows = owned.filter(([id]) => isArrowId(id));
  const helpers = owned.filter(([id]) => isHelperId(id));
  const step = (id: ItemId, by: number) => {
    const n = Math.max(0, Math.min((pack.quiver[id] ?? 0) + by, state.gear[id] ?? 0, CARRY_MOST));
    const quiver = { ...pack.quiver, [id]: n };
    if (!n) delete quiver[id];
    setPack({ ...pack, quiver });
  };
  const row = ([id, n]: [ItemId, number]) => {
    const k = pack.quiver[id] ?? 0;
    const name = itemName(id);
    return (
      <li key={id} className="ar-packrow">
        <ItemIcon kind="gear" id={id} size={40} />
        <span className="ar-packrow__name">{name} <small>(you have {n})</small></span>
        <span className="ar-packrow__count">
          <button type="button" className="button button--light ar-btn ar-step" aria-label={`One less ${name}`} disabled={k <= 0} onClick={() => step(id, -1)}>−</button>
          <output aria-label={`${name}: ${k} packed`}>{k}</output>
          <button type="button" className="button button--light ar-btn ar-step" aria-label={`One more ${name}`} disabled={k >= Math.min(n, CARRY_MOST)} onClick={() => step(id, 1)}>+</button>
        </span>
      </li>
    );
  };
  const bows: BowId[] = ['starter', ...state.bows];
  return (
    <section className="ar-page" aria-labelledby="ar-pack-title">
      <div className="ar-page__head">
        <h2 id="ar-pack-title" ref={heading} tabIndex={-1}>Pack your quiver</h2>
        <button type="button" className="button button--light ar-btn" onClick={onBack}>Back</button>
      </div>
      <p>{WORLD_NAMES[world]}, against {BOT_NAMES[level]} ({LEVEL_NAMES[level]}). Plain Arrows are free and never run out. Anything you pack but don't use comes back after the fight.</p>
      <h3>Special arrows</h3>
      {arrows.length ? <ul className="ar-packlist">{arrows.map(row)}</ul> : <p className="ar-help">No special arrows yet. Earn coins in a speed round and visit the <button type="button" className="button button--light ar-btn ar-small" onClick={onArmory}>Armory</button>.</p>}
      {helpers.length > 0 && (
        <>
          <h3>Helpers</h3>
          <ul className="ar-packlist">{helpers.map(row)}</ul>
        </>
      )}
      <h3>Shield</h3>
      <div className="ar-choices ar-choices--three">
        <button type="button" className="button button--light ar-btn ar-choice" aria-pressed={!pack.shield} onClick={() => setPack({ ...pack, shield: null })}><b>No shield</b></button>
        {state.shields.map((s: ShieldId) => (
          <button key={s} type="button" className="button button--light ar-btn ar-choice" aria-pressed={pack.shield === s} onClick={() => setPack({ ...pack, shield: s })}>
            <b>{shieldKind(s).name}</b><span>{shieldKind(s).does}</span>
          </button>
        ))}
      </div>
      <h3>Bow</h3>
      <div className="ar-choices ar-choices--three">
        {bows.map((b) => {
          const kind = BOWS.find((x) => x.id === b)!;
          return (
            <button key={b} type="button" className="button button--light ar-btn ar-choice" aria-pressed={(pack.bow ?? 'starter') === b} onClick={() => setPack({ ...pack, bow: b })}>
              <b>{kind.name}</b><span>{kind.does}</span>
            </button>
          );
        })}
      </div>
      {problem && <p className="ar-problem" role="alert">{problem}</p>}
      <p className="ar-page__go">
        <button type="button" className="button button--play ar-btn ar-btn--big" disabled={busy} onClick={() => onFight(pack)}>{busy ? 'Starting…' : 'Fight!'}</button>
      </p>
    </section>
  );
}
