import { useState } from 'react';
import { MAX_LEVEL } from '../../../shared/lord/data';
import { EVENTS } from '../../../shared/lord/events';
import type { LordAction, LordState, ToolId } from '../../../shared/lord/server';

/**
 * Test tools for James: jump to any level, trigger any event, go straight to the dragon, skip a day. Like
 * LORD.ts's "god mode". They only exist in the browser-only trial (preview/lord). The server also refuses them
 * for anyone who is not a teacher, so a pupil could never use them even if the buttons were somehow shown.
 */
export function Tools({ state, act, showEvent, close, busy, resetAll }: {
  state: LordState;
  act: (action: LordAction) => Promise<unknown>;
  showEvent: (eventId: string) => void;
  close: () => void;
  busy: boolean;
  resetAll: () => void;
}) {
  const [level, setLevel] = useState(state.hero?.level ?? 1);
  const [eventId, setEventId] = useState(EVENTS[0].id);
  const tool = (id: ToolId, value?: number | string) => () => void act({ action: 'tools', tool: id, value });

  return (
    <section className="lord-place lord-panel" aria-label="Test tools">
      <header className="lord-place__head">
        <h2>Test tools</h2>
        <button type="button" className="lord-btn" onClick={close}>Back to the village</button>
      </header>
      <p className="lord-soft">For trying the game out. None of this is in the real game, and nothing here is sent to the school’s system.</p>
      <div className="lord-card">
        <h3>Jump to a level</h3>
        <label>Level <input type="number" min={1} max={MAX_LEVEL} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(MAX_LEVEL, Number(e.target.value) || 1)))} /></label>{' '}
        <button type="button" className="lord-btn" disabled={busy} onClick={tool('jump', level)}>Go</button>{' '}
        <button type="button" className="lord-btn" disabled={busy} onClick={tool('jump', MAX_LEVEL)}>Straight to the dragon (level 12)</button>
        <p className="lord-soft">Gives the right strength and gear for that level, enough experience to challenge your next master (or the dragon at level 12), and a full day of turns. Your gold stays.</p>
      </div>
      <div className="lord-card">
        <h3>Gold, turns and days</h3>
        <div className="lord-actions">
          <button type="button" className="lord-btn" disabled={busy} onClick={tool('gold')}>+1000 gold</button>
          <button type="button" className="lord-btn" disabled={busy} onClick={tool('exp')}>+500 experience</button>
          <button type="button" className="lord-btn" disabled={busy} onClick={tool('refill')}>Refill today’s turns</button>
          <button type="button" className="lord-btn" disabled={busy} onClick={tool('hurt')}>Hurt me (20% health)</button>
          <button type="button" className="lord-btn" disabled={busy} onClick={tool('new-day')}>Skip to tomorrow</button>
          <button type="button" className="lord-btn" disabled={busy} onClick={tool('best-gear')}>Best gear</button>
          {state.openFight && <button type="button" className="lord-btn" disabled={busy} onClick={tool('abandon-fight')}>Give up the open fight</button>}
        </div>
      </div>
      <div className="lord-card">
        <h3>Trigger a forest event</h3>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Event">
          {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.title}{e.maths ? ' (maths)' : ''}</option>)}
        </select>{' '}
        <button type="button" className="lord-btn" disabled={busy} onClick={() => void act({ action: 'tools', tool: 'event', value: eventId }).then((r) => r && showEvent(eventId))}>Show it</button>
      </div>
      <div className="lord-card">
        <h3>Start again</h3>
        <button type="button" className="lord-btn" onClick={() => { if (window.confirm('Delete this trial hero and start again?')) resetAll(); }}>Delete my trial hero</button>
      </div>
    </section>
  );
}
