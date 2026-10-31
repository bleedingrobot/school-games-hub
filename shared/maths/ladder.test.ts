import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { CAMPAIGN_STEPS } from './config';
import { parseFactKey } from './facts';
import { afterAnswer, newStats, type FactStats } from './leitner';
import { AutoPack, autoPools, LADDER, ladderProgress, tablesJumpFloor } from './ladder';
import { BandedPack, sameAnswer } from './banded';
import { BANDED_PACKS } from './skillPacks';
import { earlyFactsPack, EARLY_FACTS } from './skillPacks/earlyFacts';

const rec = (key: string, box: number): FactStats => ({ ...newStats(key), attempts: 3, correct: 3, box });
const secure = (keys: string[]) => keys.map((k) => rec(k, 3));
const built = LADDER.filter((s) => s.built);

/** Reads a question off the screen for the plain sums the early facts ask. */
function solve(parts: string[]): number {
  const text = parts.join(' ');
  let m = /^(\d+) \+ (\d+) = \?$/.exec(text);
  if (m) return +m[1] + +m[2];
  m = /^Double (\d+) = \?$/.exec(text);
  if (m) return 2 * +m[1];
  m = /^Half of (\d+) = \?$/.exec(text);
  if (m) return +m[1] / 2;
  m = /^(\d+) ÷ (\d+) = \?$/.exec(text);
  if (m) return +m[1] / +m[2];
  m = /^(\d+) ÷ \? = (\d+)$/.exec(text);
  if (m) return +m[1] / +m[2];
  m = /^(\d+) − (\d+) = \?$/.exec(text);
  if (m) return +m[1] - +m[2];
  m = /^(\d+) \+ \? = (\d+)$/.exec(text);
  if (m) return +m[2] - +m[1];
  m = /^\? \+ (\d+) = (\d+)$/.exec(text);
  if (m) return +m[2] - +m[1];
  return NaN;
}

describe('the early facts pack', () => {
  const pack = earlyFactsPack([], randomFromSeed(String(3)));
  const keys = Object.values(EARLY_FACTS.families).flatMap((f) => f.keys);

  it('has the facts it should', () => {
    expect(keys).toContain('bond10:3+7');
    expect(keys).toContain('bond20:8+12');
    expect(keys).toContain('dbl:7');
    expect(keys).toContain('half:14');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('asks only correct questions, with a distinct right answer among the choices', () => {
    for (const key of keys) {
      for (let i = 0; i < 12; i++) {
        const q = pack.questionFor(key, 'focus', { multipleChoice: true });
        expect(q.factKey).toBe(key);
        expect(sameAnswer(solve(q.parts), q.answer), `${key}: ${q.parts.join(' ')}`).toBe(true);
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices).toContain(q.answer);
        expect(q.choices!.every((c) => c >= 0 && Number.isInteger(c))).toBe(true);
      }
    }
  });

  it('can be made again from its numbers (so the server can check an answer)', () => {
    for (const key of keys) {
      const q = pack.questionFor(key, 'focus');
      const again = pack.rebuild(key, q.params!);
      expect(again?.parts).toEqual(q.parts);
      expect(again?.answer).toBe(q.answer);
    }
    expect(pack.rebuild('bond10:3+7', [3, 7, 9])).toBeNull();
    expect(pack.rebuild('bond10:3+7', [4, 6, 0])).toBeNull();
  });

  it('gives the same questions for the same seed, and not the same one twice running', () => {
    const run = (seed: number) => {
      const p = earlyFactsPack([], randomFromSeed(String(seed)));
      return Array.from({ length: 40 }, () => p.nextQuestion({ level: 4 })!.parts.join(' '));
    };
    expect(run(5)).toEqual(run(5));
    const asked = run(6);
    for (let i = 1; i < asked.length; i++) expect(asked[i]).not.toBe(asked[i - 1]);
  });

  it('owns its keys and no others', () => {
    expect(pack.owns('bond10:0+10')).toBe(true);
    expect(pack.owns('add:3+4')).toBe(false);
    expect(pack.owns('mul:3x4')).toBe(false);
  });
});

describe('the ladder', () => {
  it('has no key in two skills, and every key is owned by a pack', () => {
    const seen = new Map<string, string>();
    const auto = new AutoPack();
    for (const skill of built) {
      expect(skill.keys.length).toBeGreaterThan(0);
      for (const key of skill.keys) {
        expect(seen.get(key), `${key} is in ${seen.get(key)} and ${skill.id}`).toBeUndefined();
        seen.set(key, skill.id);
        expect(() => (auto as unknown as { ownerOf(k: string): unknown }).ownerOf(key)).not.toThrow();
      }
    }
  });

  it('puts the times tables in the NZC order', () => {
    expect(CAMPAIGN_STEPS.map((s) => s.add)).toEqual([[2, 5, 10], [3, 4, 8], [6, 9], [7], [11, 12]]);
    const ids = LADDER.map((s) => s.id);
    expect(ids.indexOf('tables-3-4-8')).toBeLessThan(ids.indexOf('tables-6-9'));
    expect(ids.indexOf('tables-6-9')).toBeLessThan(ids.indexOf('tables-7'));
    expect(ids.indexOf('facts-10')).toBeLessThan(ids.indexOf('tables-2-5-10'));
  });

  it('keeps every times-table fact (none lost by the new order)', () => {
    const keys = new Set(built.flatMap((s) => s.keys));
    for (let a = 1; a <= 12; a++) for (let b = Math.max(a, 2); b <= 12; b++) expect(keys.has(`mul:${a}x${b}`), `mul:${a}x${b}`).toBe(true);
  });

  it('every skill has curriculum tags that exist in the NZC teaching sequences', () => {
    const dir = join(homedir(), 'projects/maths-alignment-tool/data/curriculum/teaching-sequence');
    let text: string;
    try {
      text = readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    } catch {
      return; // the alignment tool isn't on this machine (CI): skip
    }
    for (const skill of LADDER) {
      if (skill.id === 'bonds-1000') { expect(skill.curriculumTags).toEqual([]); continue; }
      expect(skill.curriculumTags.length, skill.id).toBeGreaterThan(0);
      for (const tag of skill.curriculumTags) expect(text, `${skill.id}: ${tag}`).toContain(`- ${tag} `);
    }
  });
});

describe('division by 11 and 12', () => {
  it('is in the last tables skill, and asks correct questions', () => {
    const skill = LADDER.find((s) => s.id === 'tables-11-12')!;
    const div = skill.keys.filter((k) => k.startsWith('div:'));
    expect(div).toContain('div:132/12');
    expect(div).toContain('div:121/11');
    expect(div).toHaveLength(24);
    const pack = new AutoPack([], randomFromSeed('d'));
    for (const key of div) {
      const q = (pack as unknown as { ownerOf(k: string): { questionFor(k: string, b: 'focus'): { parts: string[]; answer: number } } }).ownerOf(key).questionFor(key, 'focus');
      expect(sameAnswer(solve(q.parts), q.answer), `${key}: ${q.parts.join(' ')}`).toBe(true);
    }
  });

  it('is never served by the band-based games (Maths Monsters)', () => {
    const pack = new BandedPack(BANDED_PACKS.division);
    for (let level = 1; level <= pack.bandCount; level++) {
      const pools = pack.poolsFor(level);
      expect([...pools.focus, ...pools.review, ...pools.stretch].some((k) => /\/1[12]$/.test(k))).toBe(false);
    }
    expect(pack.owns('div:132/12')).toBe(true);
    expect(pack.bandOf('div:132/12')).toBeUndefined();
  });
});

describe('ladder progress', () => {
  it('starts on the first skill with nothing secure', () => {
    const p = ladderProgress([]);
    expect(p.current?.id).toBe('facts-10');
    expect(p.secureCount).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.skills.find((s) => s.skill.id === 'facts-10')?.status).toBe('current');
    expect(p.skills.find((s) => s.skill.id === 'ten-and')?.status).toBe('upcoming'); // built in F.6; every skill is built now
  });

  it('moves on at 70% in box 2 or higher, and holds back just under it', () => {
    const keys = built[0].keys;
    const need = Math.ceil(keys.length * 0.7);
    expect(ladderProgress(secure(keys.slice(0, need - 1))).current?.id).toBe(built[0].id);
    const p = ladderProgress(secure(keys.slice(0, need)));
    expect(p.current?.id).toBe(built[1].id);
    expect(p.secureCount).toBe(1);
    expect(p.percent).toBe(Math.round(100 / built.length));
  });

  it('reaches 100% and no current skill when every built skill is secure', () => {
    const p = ladderProgress(secure(built.flatMap((s) => s.keys)));
    expect(p.current).toBeNull();
    expect(p.percent).toBe(100);
    expect(p.secureCount).toBe(built.length);
  });

  it('skips a skill whose tables are all switched off, and it no longer counts', () => {
    const all = ladderProgress([]);
    const saved = secure(built.flatMap((s) => s.keys));
    // With only ×6 and ×9 on, the ×7 and ×11/×12 skills have nothing to ask, so they drop out.
    const p = ladderProgress(saved, { enabledTables: [6, 9] });
    expect(p.current).toBeNull();
    expect(p.builtCount).toBeLessThan(all.builtCount);
    expect(p.percent).toBe(100);
    // A student who has done everything before ×7 is on ×7 when it is on, and past it when it is off.
    const through = built.findIndex((s) => s.id === 'tables-6-9');
    const done = secure(built.slice(0, through + 1).flatMap((s) => s.keys));
    expect(ladderProgress(done).current?.id).toBe('tables-7');
    expect(ladderProgress(done, { enabledTables: [6, 9] }).current?.id).toBe('times-tens'); // ×7 is skipped, the next skill is not
  });

  it('builds pools of focus, review and stretch around the current skill', () => {
    const upTo = built.findIndex((s) => s.id === 'facts-20');
    const p = ladderProgress(secure(built.slice(0, upTo).flatMap((s) => s.keys)));
    const pools = autoPools(p);
    expect(new Set(pools.focus)).toEqual(new Set(built[upTo].keys));
    expect(new Set(pools.review)).toEqual(new Set(built.slice(0, upTo).flatMap((s) => s.keys)));
    expect(new Set(pools.stretch)).toEqual(new Set(built[upTo + 1].keys));
  });
});

describe('auto', () => {
  const play = (pack: AutoPack, n: number, right = true) => {
    const asked: ReturnType<AutoPack['nextQuestion']>[] = [];
    for (let i = 0; i < n; i++) {
      const q = pack.nextQuestion({})!;
      asked.push(q);
      pack.recordAnswer(q, right ? q.answer : q.answer + 1, 1000);
    }
    return asked;
  };

  it('moves a new student up the ladder as they answer right', () => {
    const pack = new AutoPack([], randomFromSeed(String(11)));
    expect(pack.progress().current?.id).toBe('facts-10');
    play(pack, 400);
    expect(built.findIndex((s) => s.id === pack.progress().current?.id)).toBeGreaterThan(1);
  });

  it('mixes about 60% focus, 30% review and 10% stretch', () => {
    const start = built.findIndex((s) => s.id === 'facts-20');
    const saved = secure(built.slice(0, start).flatMap((s) => s.keys));
    const bands = { focus: 0, review: 0, stretch: 0, repeat: 0 };
    const pack = new AutoPack(saved, randomFromSeed(String(21)));
    for (let i = 0; i < 1500; i++) {
      const q = pack.nextQuestion({})!;
      bands[q.band]++;
      // a wrong answer would schedule repeats, so keep every fact at its box: answer slowly
      pack.recordAnswer(q, q.answer, 9000);
    }
    expect(bands.focus / 1500).toBeGreaterThan(0.55);
    expect(bands.focus / 1500).toBeLessThan(0.65);
    expect(bands.review / 1500).toBeGreaterThan(0.25);
    expect(bands.review / 1500).toBeLessThan(0.35);
    expect(bands.stretch / 1500).toBeGreaterThan(0.06);
    expect(bands.stretch / 1500).toBeLessThan(0.14);
  });

  it('leans review towards the hardest tables', () => {
    const upTo = built.findIndex((s) => s.id === 'tables-7');
    const saved = secure(built.slice(0, upTo).flatMap((s) => s.keys));
    const pack = new AutoPack(saved, randomFromSeed(String(31)));
    let hard = 0;
    let all = 0;
    for (let i = 0; i < 3000; i++) {
      const q = pack.nextQuestion({})!;
      pack.recordAnswer(q, q.answer, 9000);
      if (q.band !== 'review') continue;
      const mul = parseFactKey(q.factKey);
      if (!mul) continue;
      all++;
      if ([6, 7, 8, 9, 12].some((t) => t === mul.a || t === mul.b)) hard++;
    }
    const pool = autoPools(pack.progress()).review.map((k) => parseFactKey(k)).filter(Boolean);
    const poolShare = pool.filter((f) => [6, 7, 8, 9, 12].some((t) => t === f!.a || t === f!.b)).length / pool.length;
    expect(hard / all).toBeGreaterThan(poolShare);
  });

  it('brings a wrong answer back soon, and records under the same keys other games use', () => {
    const pack = new AutoPack([], randomFromSeed(String(41)));
    const heard: string[] = [];
    pack.onAnswer((a) => heard.push(a.key));
    const q = pack.nextQuestion({})!;
    pack.recordAnswer(q, q.answer + 1, 1000);
    expect(heard).toEqual([q.factKey]);
    const keys = Array.from({ length: 8 }, () => {
      const n = pack.nextQuestion({})!;
      pack.recordAnswer(n, n.answer, 1000);
      return n.factKey;
    });
    expect(keys.slice(2, 6)).toContain(q.factKey);
    expect(pack.stats().find((s) => s.key === q.factKey)?.box).toBeGreaterThanOrEqual(1);
  });

  it('keeps every old times-table record: records load, count, and are passed back', () => {
    const old = [afterAnswer(newStats('mul:6x7'), true, 1000, Date.now()), afterAnswer(newStats('add:3+4'), true, 1000, Date.now())];
    const pack = new AutoPack(old, randomFromSeed(String(51)));
    expect(pack.stats().map((s) => s.key).sort()).toEqual(['add:3+4', 'mul:6x7']);
  });

  it('only asks for facts that exist, whatever the student has done (many seeds)', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const pack = new AutoPack([], randomFromSeed(String(seed)));
      for (const q of play(pack, 300)) {
        expect(q).not.toBeNull();
        expect(Number.isFinite(q!.answer)).toBe(true);
      }
    }
    expect(BANDED_PACKS['add-sub']).toBeDefined();
  });
});

describe('times-table curriculum codes', () => {
  it('the times-table pack carries the codes the ladder gives its times-table skills', async () => {
    const { TIMES_TABLES_TAGS, TimesTables } = await import('./skillPacks/timesTables');
    const ladder = [...new Set(LADDER.filter((s) => s.stage === 'times-tables').flatMap((s) => s.curriculumTags))];
    expect([...TIMES_TABLES_TAGS].sort()).toEqual(ladder.sort());
    expect(new TimesTables().curriculumTags.some((t) => t.startsWith('TODO'))).toBe(false);
  });
});

describe('jumping ahead on secure times tables (22 Oct 2026)', () => {
  const at = (id: string) => LADDER.findIndex((s) => s.id === id);
  const times = (id: string) => LADDER[at(id)].keys.filter((k) => k.startsWith('mul:'));
  const byKey = (stats: FactStats[]) => new Map(stats.map((s) => [s.key, s]));

  it('moves a student who knows ×3, ×4 and ×8 past everything easier, even skills never asked', () => {
    const progress = ladderProgress(secure(times('tables-3-4-8')));
    expect(at(progress.current!.id)).toBeGreaterThan(at('tables-3-4-8'));
    // Bonds to 10 was never asked: passed over, not secure.
    expect(progress.skills[at('facts-10')]).toMatchObject({ status: 'secure', passedOver: true });
    expect(progress.skills[at('tables-3-4-8')]).toMatchObject({ status: 'secure' });
  });

  it('needs 70% of the skill’s times facts', () => {
    const keys = times('tables-2-5-10');
    const enough = Math.ceil(keys.length * 0.7);
    expect(tablesJumpFloor(byKey(secure(keys.slice(0, enough))))).toBe(at('tables-2-5-10') + 1);
    expect(tablesJumpFloor(byKey(secure(keys.slice(0, enough - 1))))).toBe(0);
    // Box 1 (still learning) doesn't count.
    expect(tablesJumpFloor(byKey(keys.map((k) => rec(k, 1))))).toBe(0);
  });

  it('only times-table skills can do it, so a small skill can’t jump anyone by luck', () => {
    expect(tablesJumpFloor(byKey(secure(LADDER[at('bonds-100')].keys)))).toBe(0);
    expect(tablesJumpFloor(byKey(secure(LADDER[at('facts-20')].keys)))).toBe(0);
    expect(ladderProgress(secure(LADDER[at('bonds-100')].keys)).current?.id).toBe('facts-10');
  });

  it('jumps from the highest secure times-table skill', () => {
    const stats = secure([...times('tables-2-5-10'), ...times('tables-7')]);
    expect(tablesJumpFloor(byKey(stats))).toBe(at('tables-7') + 1);
  });

  it('never lowers a floor that is already higher', () => {
    const progress = ladderProgress(secure(times('tables-2-5-10')), { floor: at('tables-7') });
    expect(at(progress.current!.id)).toBeGreaterThanOrEqual(at('tables-7'));
  });
});
