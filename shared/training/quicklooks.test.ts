import { describe, expect, it } from 'vitest';
import { gapKey, helpedKey, subKey } from '../subitising/keys';
import { FACTS } from './facts';
import { buildMap } from './map';
import { emptyState, rebuildState, recordAnswer, recordTyping, withUnsaved, type SavedAnswer } from './records';
import { greenThisWeek, weekLine } from './week';

/** Times-table answers played live over three days, as they would be saved. */
function timesTables() {
  let state = recordTyping(recordTyping(emptyState(), 2, 900), 1, 600);
  const saved: SavedAnswer[] = [];
  let at = Date.UTC(2026, 9, 19, 20, 0, 0);
  for (const [d, day] of ['2026-10-19', '2026-10-20', '2026-10-21'].entries()) {
    for (const f of FACTS.slice(0, 14)) {
      const wrong = (d + f.a) % 4 === 0;
      const ms = 900 + ((f.a * 397 + d * 211) % 6000);
      const r = recordAnswer(state, f.key, wrong ? f.answer + 1 : f.answer, f.answer, ms, day);
      state = r.state;
      saved.push({ key: f.key, correct: r.correct, ms, typingMs: r.typedMs, day, at: (at += 7000) });
    }
    at += 86_400_000;
  }
  return { state, saved };
}

/** Quick looks answers (right, wrong, helped, frames) with the same days and times mixed in between. */
function quickAnswers(times: SavedAnswer[]): SavedAnswer[] {
  const keys = [subKey('line', 2), subKey('dice', 4), gapKey('ten', 7), helpedKey(subKey('ten', 8)), subKey('five', 5), helpedKey(gapKey('five', 4))];
  return times.flatMap((t, i) => [{ key: keys[i % keys.length], correct: i % 3 !== 0, ms: 0, typingMs: 0, day: t.day, at: t.at + 1 }]);
}

describe('Quick looks answers and the times-table facts map', () => {
  it('a student with both kinds of answers has exactly the same facts map as one with only times tables', () => {
    const { state, saved } = timesTables();
    const student = { typing: state.typing, autoSubmit: true, sessionsDone: 3 };
    const only = rebuildState(saved, student);
    const mixed = rebuildState([...saved, ...quickAnswers(saved)].sort((a, b) => a.at - b.at), student);
    expect(mixed).toEqual(only);
    expect(Object.keys(mixed.records).every((k) => /^(mul|div):/.test(k))).toBe(true);
    // And what a student sees from that: the map colours, this week's line.
    expect(buildMap(mixed, '2026-10-21')).toEqual(buildMap(only, '2026-10-21'));
    expect(weekLine(greenThisWeek(mixed.records, '2026-10-21'))).toBe(weekLine(greenThisWeek(only.records, '2026-10-21')));
  });

  it('even when the Quick looks answers come first, or only Quick looks answers exist', () => {
    const { saved } = timesTables();
    const quick = quickAnswers(saved).map((a) => ({ ...a, at: a.at - 10 * 86_400_000 }));
    expect(rebuildState([...quick, ...saved])).toEqual(rebuildState(saved));
    expect(rebuildState(quick)).toEqual(emptyState());
  });

  it('an answer waiting to be saved is not counted twice', () => {
    const { saved } = timesTables();
    const q = quickAnswers(saved);
    expect(withUnsaved([...saved, ...q], q)).toHaveLength(saved.length + q.length);
  });
});
