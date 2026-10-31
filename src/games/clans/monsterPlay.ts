/**
 * The test page's version of a monster try (no server, so it is Practice: nothing counts for fame or the Hall). The same shared
 * rules the server uses: the same seed, siege and fight, so a teacher sees exactly what a pupil would.
 */
import type { MonsterOutcome, ShownFight } from '../../../shared/clans/actions';
import { monsterSeed } from '../../../shared/clans/actions';
import { CONFIG } from '../../../shared/clans/config';
import { empireOf } from '../../../shared/clans/empire';
import type { FightState } from '../../../shared/clans/fight';
import { markSiege, monsterOf, monsterSave, playSiege, type MonsterSetup, type Siege } from '../../../shared/clans/monster';
import { payFight } from '../../../shared/clans/play';
import type { FightSummary, Session } from './session';

export interface PracticeTry {
  session: Session;
  open: ShownFight;
  siege: Siege;
  right: boolean | null;
  /** The right answer to the siege question, to show (null if there was no question). */
  answer: number | null;
}

/** Start a practice try: play the siege and set the fight up. Fire arrows are used up. */
export function startPracticeTry(s: Session, answer: number | null): PracticeTry {
  const season = s.season ?? 1;
  const clan = structuredClone(s.clan);
  const save = monsterSave(clan, season);
  const seed = monsterSeed(s.baseSeed, season, save.tries);
  const marked = markSiege(seed, s.settings, answer);
  const siege = playSiege(clan, save.supplies.arrows, marked.right, seed);
  const setup: MonsterSetup = {
    kind: monsterOf(season), losses: save.wonDay === undefined ? save.losses : 0, siege: siege.share,
    potions: save.supplies.potions, net: save.supplies.net > 0, walls: empireOf(clan).levels.walls,
  };
  clan.monster = { ...save, tries: save.tries + 1, lastDay: s.day, supplies: { ...save.supplies, arrows: 0 } };
  const open: ShownFight = { depth: CONFIG.monster.depth, boss: false, seed, no: s.fightNo + 1, settings: s.settings, rounds: [], monster: { setup, siege } };
  return { session: { ...s, clan }, open, siege, right: marked.right, answer: marked.question ? marked.question.answer : null };
}

/** A practice fight is over: pay it, and keep the tries and the supplies the way the server does. No fame, no fights used. */
export function finishPracticeTry(s: Session, open: ShownFight, fight: FightState): { session: Session; summary: FightSummary; monster: MonsterOutcome } {
  const season = s.season ?? 1;
  const clan = structuredClone(s.clan);
  const summary = payFight(clan, fight);
  const won = summary.result === 'won';
  const save = monsterSave(clan, season);
  const setup = open.monster!.setup;
  const first = won && save.wonDay === undefined;
  clan.monster = {
    ...save,
    losses: won || save.wonDay !== undefined ? save.losses : save.losses + 1,
    ...(first ? { wonDay: s.day } : {}),
    supplies: {
      ...save.supplies,
      potions: Math.max(0, save.supplies.potions - (setup.potions - (fight.monster?.potions ?? setup.potions))),
      net: Math.max(0, save.supplies.net - (setup.net && fight.monster?.net === false ? 1 : 0)),
    },
  };
  return { session: { ...s, clan, fightNo: s.fightNo + 1 }, summary, monster: { kind: setup.kind, season, won, first, tries: clan.monster.tries } };
}
