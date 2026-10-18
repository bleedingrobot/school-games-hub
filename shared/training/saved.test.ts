import { describe, expect, it } from 'vitest';
import { FACTS } from './facts';
import { emptyState, rebuildState, recordAnswer, recordTyping, savedAnswerId, withUnsaved, type SavedAnswer } from './records';
import { buildMap } from './map';

/** Plays a few days live, keeping what would be saved with each answer. */
function playLive() {
  let state = recordTyping(recordTyping(emptyState(), 2, 900), 1, 600);
  const saved: SavedAnswer[] = [];
  const days = ['2026-10-19', '2026-10-20', '2026-10-21'];
  let at = Date.UTC(2026, 9, 19, 20, 0, 0);
  for (const [d, day] of days.entries()) {
    for (const f of FACTS.slice(0, 12)) {
      const wrong = (d + f.a) % 5 === 0;
      const ms = 900 + ((f.a * 397 + d * 211) % 6000);
      const r = recordAnswer(state, f.key, wrong ? f.answer + 1 : f.answer, f.answer, ms, day);
      state = r.state;
      saved.push({ key: f.key, correct: r.correct, ms, typingMs: r.typedMs, day, at: (at += 7000) });
    }
    at += 86_400_000;
  }
  return { state, saved };
}

describe('rebuilding records from saved answers', () => {
  it('gives the same records, colours and known days as answering live', () => {
    const { state, saved } = playLive();
    const rebuilt = rebuildState(saved, { typing: state.typing, autoSubmit: true, sessionsDone: 3 });
    expect(rebuilt.records).toEqual(state.records);
    expect(rebuilt.recent).toEqual(state.recent);
    expect(buildMap(rebuilt, '2026-10-22')).toEqual(buildMap(state, '2026-10-22'));
  });

  it('does not depend on the order they are listed in', () => {
    const { state, saved } = playLive();
    expect(rebuildState([...saved].reverse()).records).toEqual(state.records);
  });

  it('starts from the saved settings, or sensible ones with none', () => {
    expect(rebuildState([], null)).toEqual(emptyState());
    const s = rebuildState([], { typing: { 2: [800] }, autoSubmit: false, sessionsDone: 4 });
    expect([s.typing[2], s.autoSubmit, s.sessionsDone]).toEqual([[800], false, 4]);
  });

  it('takes off the typing time that was used for each answer, not the latest', () => {
    const saved: SavedAnswer[] = [{ key: 'mul:6x7', correct: true, ms: 2500, typingMs: 1200, day: '2026-10-19', at: 1 }];
    const s = rebuildState(saved, { typing: { 2: [100] } });
    expect(s.records['mul:6x7'].answers[0].thinkMs).toBe(1300);
  });
});

describe('answers not yet saved', () => {
  const a = (key: string, at: number): SavedAnswer => ({ key, correct: true, ms: 1000, typingMs: 500, day: '2026-10-19', at });

  it('are added after the saved ones', () => {
    expect(withUnsaved([a('mul:2x3', 1)], [a('mul:2x4', 2)]).map(savedAnswerId)).toEqual(['1|mul:2x3', '2|mul:2x4']);
  });

  it('are not counted twice when the server already has them', () => {
    expect(withUnsaved([a('mul:2x3', 1), a('mul:2x4', 2)], [a('mul:2x4', 2), a('mul:2x5', 3)])).toHaveLength(3);
  });

  it('are not counted twice when they are listed twice', () => {
    expect(withUnsaved([], [a('mul:2x3', 1), a('mul:2x3', 1)])).toHaveLength(1);
  });
});
