import { describe, expect, it } from 'vitest';
import { ALL_GAMES, GAMES, POWER_CLASH_ON, findGame } from './registry';
import { BOT_LEVELS, isBotLevel, isRanked } from './types';

describe('game registry', () => {
  it('has chess, checkers, Wormholes & Black Holes, 101, Gem Keep, Power Clash, Maths Monsters, Dragon Maths, Clan Quest, Marble Rush, Bond Match, Mine Runner, Archery Challenge and Kingdom Keeper', () => {
    expect(GAMES.map((g) => g.id)).toEqual(['chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash', 'monsters', 'dragon-maths', 'clan-quest', 'marble', 'bond-match', 'mine', 'archery', 'kingdom']);
  });

  it('shows Power Clash on the dashboard while the switch is on', () => {
    expect(POWER_CLASH_ON).toBe(true);
    expect(findGame('power-clash')?.name).toBeDefined();
  });

  it('keeps Wormholes & Black Holes and 101 off the rankings', () => {
    expect(GAMES.filter(isRanked).map((g) => g.id)).toEqual(['chess', 'checkers']);
    expect(findGame('space')?.ranked).toBe(false);
    expect(findGame('101')?.ranked).toBe(false);
    expect(findGame('gem-keep')?.ranked).toBe(false);
    expect(findGame('monsters')?.ranked).toBe(false);
    expect(findGame('dragon-maths')?.ranked).toBe(false);
    expect(findGame('clan-quest')?.ranked).toBe(false);
    expect(findGame('bond-match')?.ranked).toBe(false);
  });

  it('gives every game a unique, URL-safe id', () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it('puts every game in a dashboard group, in the same order as before games said their own group', () => {
    const inGroup = (group: string) => ALL_GAMES.filter((g) => g.group === group).map((g) => g.id);
    expect(inGroup('no-maths')).toEqual(['chess', 'checkers', '101', 'power-clash']);
    expect(inGroup('easy-maths')).toEqual(['space', 'gem-keep', 'bond-match', 'mine', 'archery']);
    expect(inGroup('complex-maths')).toEqual(['monsters', 'dragon-maths', 'clan-quest', 'marble', 'kingdom']);
    expect(ALL_GAMES.filter((g) => !g.group)).toEqual([]);
  });

  it('the games with a teacher switch and teacher panels say so themselves', () => {
    expect(ALL_GAMES.filter((g) => g.useTeacherSwitch).map((g) => g.id)).toEqual(['monsters', 'dragon-maths', 'clan-quest', 'bond-match', 'mine', 'archery', 'kingdom']);
    expect(ALL_GAMES.filter((g) => g.TeacherPanels).map((g) => g.id)).toEqual(['gem-keep', 'monsters', 'dragon-maths', 'clan-quest', 'kingdom']);
    expect(ALL_GAMES.filter((g) => g.StudentPanel).map((g) => g.id)).toEqual(['gem-keep', 'monsters', 'dragon-maths', 'clan-quest']);
    // Moved to the new teacher contract (docs/TEACHER-VIEW-PLAN.md, stage 3), which replaces TeacherPanels and StudentPanel.
    expect(ALL_GAMES.filter((g) => g.teacher).map((g) => g.id)).toEqual(['space', 'marble', 'bond-match', 'mine', 'archery']);
    expect(ALL_GAMES.filter((g) => g.teacher && (g.TeacherPanels || g.StudentPanel))).toEqual([]);
  });

  it('finds games by id', () => {
    expect(findGame('chess')?.name).toBe('Chess');
    expect(findGame('snakes')).toBeUndefined();
    expect(findGame(undefined)).toBeUndefined();
  });
});

describe('bot levels', () => {
  it('are Very Easy, Easy and Medium', () => {
    expect(BOT_LEVELS.map((l) => l.label)).toEqual(['Very Easy', 'Easy', 'Medium']);
  });

  it('rejects unknown levels', () => {
    expect(isBotLevel('easy')).toBe(true);
    expect(isBotLevel('impossible')).toBe(false);
    expect(isBotLevel(null)).toBe(false);
  });
});
