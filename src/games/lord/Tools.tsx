import { useState } from 'react';
import { ARMOURS, MAX_LEVEL, WEAPONS, baseStats, expNeeded } from '../../../shared/lord/data';
import { EVENTS } from '../../../shared/lord/events';
import type { ForestEvent, Hero } from '../../../shared/lord/types';

/**
 * Test tools for James: jump to any level, trigger any event, go straight to the dragon, skip a day.
 * Like LORD.ts's "god mode". Only on the trial page; the real game will not have it.
 */
export function Tools({ hero, setHero, skipDay, resetAll, showEvent, close }: {
  hero: Hero;
  setHero: (h: Hero) => void;
  skipDay: () => void;
  resetAll: () => void;
  showEvent: (event: ForestEvent) => void;
  close: () => void;
}) {
  const [level, setLevel] = useState(hero.level);
  const [eventId, setEventId] = useState(EVENTS[0].id);

  /** A hero at `to`, with the base stats, gear and exp that a steady player would have. */
  function jumpTo(to: number) {
    const base = baseStats(to);
    const gear = Math.min(WEAPONS.length - 1, to - 1);
    setHero({
      ...hero, level: to, ...base, hp: base.maxHp, weapon: gear, armour: gear,
      exp: to < MAX_LEVEL ? expNeeded(to) : expNeeded(MAX_LEVEL - 1), forestLeft: Math.max(hero.forestLeft, 10), skillLeft: 3, masterTried: false,
    });
  }

  return (
    <section className="lord-place" aria-label="Test tools">
      <header className="lord-place__head">
        <h2>Test tools</h2>
        <button type="button" className="lord-btn" onClick={close}>Back to the village</button>
      </header>
      <p className="lord-soft">For trying the game out. None of this will be in the real game, and nothing here is saved to the school’s system.</p>
      <div className="lord-card">
        <h3>Jump to a level</h3>
        <label>Level <input type="number" min={1} max={MAX_LEVEL} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(MAX_LEVEL, Number(e.target.value) || 1)))} /></label>{' '}
        <button type="button" className="lord-btn" onClick={() => jumpTo(level)}>Go</button>{' '}
        <button type="button" className="lord-btn" onClick={() => jumpTo(MAX_LEVEL)}>Straight to the dragon (level 12)</button>
        <p className="lord-soft">Gives the right strength and gear for that level, enough experience to challenge your next master (or the dragon at level 12), and a full day of turns. Your gold stays.</p>
      </div>
      <div className="lord-card">
        <h3>Gold, turns and days</h3>
        <div className="lord-actions">
          <button type="button" className="lord-btn" onClick={() => setHero({ ...hero, gold: hero.gold + 1000 })}>+1000 gold</button>
          <button type="button" className="lord-btn" onClick={() => setHero({ ...hero, exp: hero.exp + 500 })}>+500 experience</button>
          <button type="button" className="lord-btn" onClick={() => setHero({ ...hero, forestLeft: 10, skillLeft: 3, masterTried: false })}>Refill today’s turns</button>
          <button type="button" className="lord-btn" onClick={() => setHero({ ...hero, hp: Math.max(1, Math.floor(hero.maxHp / 5)) })}>Hurt me (20% health)</button>
          <button type="button" className="lord-btn" onClick={skipDay}>Skip to tomorrow</button>
          <button type="button" className="lord-btn" onClick={() => setHero({ ...hero, weapon: WEAPONS.length - 1, armour: ARMOURS.length - 1 })}>Best gear</button>
        </div>
      </div>
      <div className="lord-card">
        <h3>Trigger a forest event</h3>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Event">
          {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.title}{e.maths ? ' (maths)' : ''}</option>)}
        </select>{' '}
        <button type="button" className="lord-btn" onClick={() => showEvent(EVENTS.find((e) => e.id === eventId)!)}>Show it</button>
      </div>
      <div className="lord-card">
        <h3>Start again</h3>
        <button type="button" className="lord-btn" onClick={() => { if (window.confirm('Delete this trial hero and start again?')) resetAll(); }}>Delete my trial hero</button>
      </div>
    </section>
  );
}
