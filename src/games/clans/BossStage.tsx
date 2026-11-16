/**
 * The season monster fight made big (docs/CLANS-MONSTER-EPIC-PLAN.md): the entrance, the monster's long strength bar, the
 * towering monster, its weather, and the boulder. Display only: the fight itself is Fight.tsx and shared/clans/fight.ts.
 * Every picture has a drawn stand-in, so it all works before the paintings exist. Reduced motion: no shaking, flashing or flying.
 */
import { useEffect, useRef, useState } from 'react';
import { MONSTER_LOOKS } from '../../../shared/clans/monster';
import type { MonsterKind } from '../../../shared/clans/types';
import { MonsterArt } from './MonsterArt';
import { arenaArt, bossArt, boulderArt, siegeArt } from './art';

/** The battlefield behind the monster: its own painting, else the siege painting, else a stormy sky drawn in CSS. */
export function arenaBackdrop(kind: MonsterKind): string | undefined {
  const a = arenaArt(kind);
  const s = siegeArt(kind);
  return a.small ?? s.small;
}

/** Rain, lightning, dust or snow over the arena, by monster. */
export function BossWeather({ kind }: { kind: MonsterKind }) {
  return (
    <span className={`cq-weather cq-weather--${kind}`} aria-hidden="true">
      <span className="cq-weather__fall" />
      <span className="cq-weather__fall cq-weather__fall--far" />
      <span className="cq-weather__flash" />
    </span>
  );
}

/** The towering monster: the painted cut-out, else the portrait, made huge. */
export function BossFigure({ kind, state }: { kind: MonsterKind; state: string }) {
  const full = bossArt(kind);
  const look = MONSTER_LOOKS[kind];
  return (
    <span className={`cq-boss ${state}`} data-monster={kind}>
      <span className="cq-boss__shadow" aria-hidden="true" />
      {full ? <img className="cq-boss__img" src={full} alt={look.name} draggable={false} /> : <span className="cq-boss__stand"><MonsterArt kind={kind} /></span>}
    </span>
  );
}

/**
 * The monster's strength across the top of the fight. The siege's share shows as already knocked off (stone grey), the
 * clan's hits as a bright bar that drains with a red trail behind it.
 */
export function BossBar({ kind, hp, maxHp, startHp, rage }: { kind: MonsterKind; hp: number; maxHp: number; startHp: number; rage: boolean }) {
  const look = MONSTER_LOOKS[kind];
  const top = Math.max(1, maxHp);
  const now = Math.max(0, Math.min(1, hp / top));
  const start = Math.max(0, Math.min(1, startHp / top));
  // The red trail catches up a moment after each hit.
  const [trail, setTrail] = useState(now);
  useEffect(() => {
    const t = window.setTimeout(() => setTrail(now), 450);
    return () => window.clearTimeout(t);
  }, [now]);
  return (
    <div className={`cq-bossbar ${rage ? 'is-rage' : ''}`} role="group" aria-label={`${look.name}: ${Math.round(now * 100)}% of its strength left`}>
      <div className="cq-bossbar__name">
        <strong>{look.name}</strong>
        <span>{Math.round(now * 100)}%</span>
      </div>
      <div className="cq-bossbar__track" aria-hidden="true">
        <span className="cq-bossbar__siege" style={{ left: `${start * 100}%` }} />
        <span className="cq-bossbar__trail" style={{ width: `${Math.max(now, trail) * 100}%` }} />
        <span className="cq-bossbar__fill" style={{ width: `${now * 100}%` }} />
        <span className="cq-bossbar__ticks" />
      </div>
    </div>
  );
}

/** The boulder (or the monster's big move) flying at the clan. */
export function BigMove({ kind }: { kind: MonsterKind }) {
  const rock = boulderArt();
  return (
    <span className={`cq-bigmove cq-bigmove--${kind}`} aria-hidden="true">
      {kind === 'giant' && (rock ? <img src={rock} alt="" /> : <span className="cq-bigmove__rock">🪨</span>)}
      {kind === 'golem' && <span className="cq-bigmove__quake" />}
      {kind === 'troll' && <span className="cq-bigmove__ice" />}
    </span>
  );
}

const INTRO_LINES: Record<MonsterKind, string> = {
  giant: 'The sky turns black. Thunder rolls down from the mountains…',
  golem: 'The ground begins to shake. Something huge is walking…',
  troll: 'A freezing wind howls through the gate. Snow begins to fall…',
};

/**
 * The entrance, before the first round: the sky darkens, the monster rises, its name slams in. Tap (or Enter) to fight.
 * `onDone` is called once.
 */
export function BossIntro({ kind, clan, onDone }: { kind: MonsterKind; clan: string; onDone: () => void }) {
  const look = MONSTER_LOOKS[kind];
  const back = arenaBackdrop(kind);
  const [ready, setReady] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 2200);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready) button.current?.focus();
  }, [ready]);
  return (
    <div
      className={`cq-intro cq-intro--${kind} ${ready ? 'is-ready' : ''}`} role="dialog" aria-modal="true" aria-label={`${look.name} arrives`}
      style={back ? ({ '--cq-intro-back': `url(${back})` } as React.CSSProperties) : undefined}
      onClick={() => (ready ? onDone() : setReady(true))}
    >
      <BossWeather kind={kind} />
      <p className="cq-intro__line">{INTRO_LINES[kind]}</p>
      <div className="cq-intro__boss"><BossFigure kind={kind} state="is-rising" /></div>
      <div className="cq-intro__title">
        <span className="cq-intro__small">The season monster</span>
        <h2>{look.name}</h2>
        <p>{look.blurb}</p>
      </div>
      <button ref={button} type="button" className="cq-btn cq-btn--hot cq-intro__go" onClick={(e) => { e.stopPropagation(); onDone(); }}>
        {clan}, to battle!
      </button>
    </div>
  );
}
