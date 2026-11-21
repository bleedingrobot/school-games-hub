/**
 * What happens in the Market, the Training Hall and the Church, as plain functions on the session.
 * The rules (prices, costs, who can wake) live in shared/clans; these only apply them to a copy of the clan
 * and say no (null) when something can't be done, so the screens stay display-only.
 */
import { CONFIG } from '../../../shared/clans/config';
import { churchCost, hpCost, shopPrice, spCost, trainCost, wakeCost } from '../../../shared/clans/character';
import { buyItem as buyItemFor, buyTroopMix as buyTroopMixFor, knockedOutMembers, raidSeed as raidSeedFor, sendArmyTo, trainMember, wakeAllCost, wakeAllPayers, wakeEveryone, wakeOne, wakeOrder, type TrainKey } from '../../../shared/clans/play';
import type { RaidOutcome, ShownFight } from '../../../shared/clans/actions';
import { canUpgrade, capacity, empireOf, newEmpire, raidKingdom, upgrade, type BattleResult, type Done, type Fail, type Push } from '../../../shared/clans/empire';
import { addBanners, bannerBoard, clanPower, defenderCopy, lightOf, raidNews, raidReward, raidSiege, raidsLeft, rivalList, sketchPower, targetEmpire, type BoardRow, type RaidSetup, type RaidTarget, type Rival, type RivalSketch } from '../../../shared/clans/raids';
import { weekOf } from '../../../shared/clans/village';
import type { FightState } from '../../../shared/clans/fight';
import { STATS, TROOP_KINDS, type Clan, type Empire, type ItemDef, type Member, type Stat, type Troops, type VillageBuilding } from '../../../shared/clans/types';
import { finishQuest, puzzleFor, questById, questDoneToday, todaysQuest, type PuzzleSpec, type QuestDef, type QuestDone } from '../../../shared/clans/quests';
import { earn, type Session } from './session';
import { classByName, raceByName, rollMember } from '../../../shared/clans/character';
import { renameCheck, slotSeed } from '../../../shared/clans/create';
import { buySupply, monsterSave, type SupplyKind } from '../../../shared/clans/monster';
import { setLook, type Look } from '../../../shared/clans/looks';

const withClan = (s: Session, change: (clan: Clan) => boolean): Session | null => {
  const clan = structuredClone(s.clan);
  return change(clan) ? { ...s, clan } : null;
};

/** Pay for an item and put it on the member (10% off with `discount`). Null if it can't be bought. */
export const buyItem = (s: Session, memberIndex: number, item: ItemDef, discount = false): Session | null => withClan(s, (clan) => buyItemFor(clan, memberIndex, item, discount).ok);

export { shopPrice };

export type { TrainKey };

export interface TrainOption {
  key: TrainKey;
  label: string;
  /** What one purchase gives, for the button. */
  gives: string;
  /** Points for one purchase. */
  cost: number;
  /** How many the member could buy right now. */
  most: number;
}

const STAT_LABEL: Record<Stat, string> = { agility: 'Agility', dexterity: 'Dexterity', strength: 'Strength', wisdom: 'Wisdom', armor: 'Armour', charisma: 'Charisma' };

/** Everything a member can train, with its price at this Training Hall level and how many they could afford. */
export function trainOptions(m: Member, hall: number): TrainOption[] {
  const stats = STATS.map((stat): TrainOption => {
    const cost = trainCost(stat, hall);
    return { key: stat, label: STAT_LABEL[stat], gives: `+1 (now ${m.stats[stat]})`, cost, most: Math.max(0, Math.min(Math.floor(m.points / cost), CONFIG.statCap - m.stats[stat])) };
  });
  const hp = hpCost(hall);
  const sp = spCost(hall);
  return [
    ...stats,
    { key: 'hp', label: 'Health', gives: `+${CONFIG.hpBuy.amount} HP (now ${m.maxHp})`, cost: hp, most: Math.floor(m.points / hp) },
    ...(m.maxSp > 0 || m.spells.length > 0 ? [{ key: 'sp' as const, label: 'Skill points', gives: `+${CONFIG.spBuy.amount} SP (now ${m.maxSp})`, cost: sp, most: Math.floor(m.points / sp) }] : []),
  ];
}

/** Buy `count` of something at the Training Hall (stops early if the points run out). Null if not even one could be bought. */
export const train = (s: Session, memberIndex: number, key: TrainKey, count: number): Session | null => withClan(s, (clan) => trainMember(clan, memberIndex, key, count).ok);

/** Wake one member at the Church (the first wake-up each day is free). Null if they're not out or the gold isn't there. */
export const wakeMember = (s: Session, memberIndex: number): Session | null => withClan(s, (clan) => wakeOne(clan, memberIndex).ok);

export const knockedOut = knockedOutMembers;

/** "Change look": only the picture changes. Null if there is no such member. */
export const changeLook = (s: Session, memberIndex: number, look: Look): Session | null => withClan(s, (clan) => setLook(clan, memberIndex, look).ok);
export { wakeOrder, wakeAllPayers, wakeAllCost };

/** Wake everyone, dearest first. Null if the clan can't afford the lot (nobody is woken). */
export const wakeAll = (s: Session): Session | null => withClan(s, (clan) => wakeEveryone(clan).ok);

export { wakeCost, churchCost };

// Test-only helpers for James's settings strip.
export const giveGold = (s: Session, amount: number): Session => ({ ...s, clan: { ...s.clan, gold: s.clan.gold + amount } });
export const givePoints = (s: Session, amount: number): Session => ({ ...s, clan: { ...s.clan, members: s.clan.members.map((m) => ({ ...m, points: m.points + amount })) } });
/** Knock out the last `n` members (never the first, so someone can still fight). */
export const knockOutSome = (s: Session, n: number): Session => ({
  ...s, clan: { ...s.clan, members: s.clan.members.map((m, i, all) => (i >= all.length - n ? { ...m, knockedOut: true, hp: 0 } : m)) },
});

// ---------------------------------------------------------------------------
// My Village. Same idea: apply the engine's rule to a copy, null when it can't be done.
// ---------------------------------------------------------------------------

/** The engine's own kind sentence for why something can't be done (for the screens to show). */
export const whyNot = (done: Done): string => (done.ok ? '' : done.say);

/** Take a building up one level, paid from the purse. Null if it can't be done (see `canUpgradeBuilding` for why). */
export const upgradeBuilding = (s: Session, b: VillageBuilding): Session | null => withClan(s, (clan) => upgrade(clan, b).ok);
/** Can this building go up a level right now, and if not, why? Works on a copy, so the session is never changed. */
export const canUpgradeBuilding = (s: Session, b: VillageBuilding): Done => canUpgrade(structuredClone(s.clan), b);

// Test-only helpers for James's settings strip.
export const giveFollowers = (s: Session, amount: number): Session => ({ ...s, clan: { ...s.clan, followers: s.clan.followers + amount } });
/** Take the Barracks to its top level and fill the room with troops, whatever it costs. */
export function barracksAndFill(s: Session): Session {
  const next = structuredClone(s);
  const e = empireOf(next.clan);
  e.levels.barracks = CONFIG.empire.buildings.barracks.max;
  for (const kind of TROOP_KINDS) e.troops[kind] = capacity(e, kind);
  return next;
}

// ---------------------------------------------------------------------------
// Troops, raids and Friendly War
// ---------------------------------------------------------------------------

/** Buy a mix of troops in one go, or none of them: the first thing that can't be done is the answer. */
export function buyTroopMix(s: Session, mix: Troops): Session | { fail: Fail } {
  const clan = structuredClone(s.clan);
  const done = buyTroopMixFor(clan, mix);
  return done.ok ? { ...s, clan } : { fail: done };
}
/** Can this mix be bought right now? Works on a copy. */
export const canBuyMix = (s: Session, mix: Troops): Done => { const r = buyTroopMix(s, mix); return 'fail' in r ? r.fail : { ok: true }; };

/** The seed for the next raid or Friendly War. */
export const raidSeed = (s: Session) => raidSeedFor(s.baseSeed, s.raidNo ?? 0);

/** Has today's raid on a kingdom been used? */
export const raidUsed = (s: Session) => canRaid(s) !== null;
/** Why a real raid can't go out right now, or null if it can. */
export function canRaid(s: Session): string | null {
  const probe = structuredClone(s.clan);
  const r = raidKingdom(probe, 'bunny-hollow', 'steady', 1);
  return r.ok ? null : r.say;
}

export interface WarDone {
  session: Session;
  result: BattleResult;
  /** Gold won (0 for a Friendly War or a loss). */
  gold: number;
  friendly: boolean;
}

/** Send the army to a kingdom: a real raid (loses troops, wins loot) or a Friendly War (changes nothing). */
export function sendArmy(s: Session, kingdomId: string, push: Push, friendly: boolean): WarDone | Fail {
  const clan = structuredClone(s.clan);
  const out = sendArmyTo(clan, kingdomId, push, friendly, raidSeed(s));
  if (!out.ok) return out;
  const won = out.result.outcome === 'won';
  const next = { ...s, clan: friendly ? s.clan : clan, raidNo: (s.raidNo ?? 0) + 1 };
  const paid = earn(next, { wars: friendly && won ? 1 : 0, kingdomRaids: !friendly && won ? 1 : 0 });
  return { session: paid, result: out.result, gold: out.gold, friendly };
}

// Test-only helpers for James's settings strip.
/** A huge army, and the day's raid not yet used. */
export function armyToWin(s: Session): Session {
  const next = structuredClone(s);
  const e = empireOf(next.clan);
  e.troops = { footman: 2000, axeman: 500, knight: 200 };
  e.kingdomRaidsToday = 0;
  return next;
}
/** One lone footman, and the day's raid not yet used. */
export function armyToLose(s: Session): Session {
  const next = structuredClone(s);
  const e = empireOf(next.clan);
  e.troops = { footman: 1, axeman: 0, knight: 0 };
  e.kingdomRaidsToday = 0;
  return next;
}
export function freshRaid(s: Session): Session {
  const next = structuredClone(s);
  const e = empireOf(next.clan);
  e.kingdomRaidsToday = 0;
  e.raidsToday = 0;
  e.raidedToday = [];
  return next;
}

// Quests.
/** The quest to show: the one picked for testing, or today's. Null if no quest suits the settings. */
export const questToday = (s: Session): QuestDef | null => (s.questPick ? questById(s.questPick) ?? null : todaysQuest(s.baseSeed, s.day, s.settings));

/** Has the clan already done a quest today? */
export const questUsed = (s: Session) => questDoneToday(s.clan, s.day);

/** The puzzle on one of today's choices, made from the clan's seed and the day. */
export const questPuzzle = (s: Session, q: QuestDef, choice: number): PuzzleSpec | null => puzzleFor(q, choice, s.baseSeed, s.day, s.settings);

/** Do the quest on a copy of the clan. `right` is how the puzzle went (null if the choice had none). */
export function doQuest(s: Session, q: QuestDef, choice: number, right: boolean | null): { session: Session; done: Extract<QuestDone, { ok: true }> } | Extract<QuestDone, { ok: false }> {
  const clan = structuredClone(s.clan);
  const done = finishQuest(clan, s.day, q, choice, right);
  return done.ok ? { session: { ...s, clan }, done } : done;
}

// Test-only helpers for James's settings strip.
export function freshQuest(s: Session): Session {
  const next = structuredClone(s);
  delete next.clan.questDay;
  return next;
}

// ---------------------------------------------------------------------------
// Village Raids. With a server the classmates are real; on the test page the pretend classmates below stand in (copies of
// your own heroes, a bit weaker or stronger), and the raid is played with the very same rules. Nothing is saved anywhere.
// ---------------------------------------------------------------------------

/** The New Zealand day the test page pretends it is (its days are counted up from here). */
const PRETEND_TODAY = 30000;
export const pretendToday = (s: Session) => PRETEND_TODAY + s.day - 1;

const PRETEND = [
  { id: 'pretend-foxes', name: 'Swift Foxes', className: null, share: 0.75, banners: 4, looks: [['Elf', 'Assassin'], ['Halfling', 'Healer'], ['Elf', 'Wizard'], ['Imp', 'Warrior']] },
  { id: 'pretend-owls', name: 'Brave Owls', className: null, share: 1, banners: 7, looks: [['Dwarf', 'Knight'], ['Human', 'Healer'], ['Half-Elf', 'Sorcerer'], ['Human', 'Pirate']] },
  { id: 'pretend-wolves', name: 'Iron Wolves', className: null, share: 1.4, banners: 2, looks: [['Orc', 'Barbarian'], ['Minotaur', 'Warrior'], ['Muya', 'Necromancer'], ['Orc', 'Samurai']] },
  { id: 'pretend-stars', name: 'Lucky Stars', className: null, share: 1.05, banners: 0, looks: [['Human', 'Martial Artist'], ['Elf', 'Healer'], ['Halfling', 'Assassin'], ['Dwarf', 'Wizard']] },
  // From other classes at school (play anyone, stage 5).
  { id: 'pretend-hawks', name: 'Silver Hawks', className: 'Room 7', share: 0.9, banners: 5, looks: [['Elf', 'Ranger'], ['Human', 'Knight'], ['Dwarf', 'Healer'], ['Imp', 'Wizard']] },
  { id: 'pretend-bears', name: 'Storm Bears', className: 'Room 12', share: 1.2, banners: 1, looks: [['Minotaur', 'Barbarian'], ['Orc', 'Warrior'], ['Human', 'Healer'], ['Elf', 'Sorcerer']] },
] as const;

const scaled = (n: number, share: number) => Math.max(1, Math.round(n * share));

/** A pretend classmate's heroes: copies of yours, scaled by `share`, shown as other races and classes. */
function pretendHeroes(s: Session, p: (typeof PRETEND)[number]): Member[] {
  return s.clan.members.map((m, i) => {
    const [race, cls] = p.looks[i % p.looks.length];
    const stats = { ...m.stats };
    for (const k of STATS) stats[k] = scaled(m.stats[k], p.share);
    return { ...structuredClone(m), race, cls, stats, maxHp: scaled(m.maxHp, p.share), hp: scaled(m.maxHp, p.share), level: scaled(m.level, p.share), knockedOut: false };
  });
}

/** A pretend classmate's village: yours, scaled by `share`. */
function pretendEmpire(s: Session, share: number): Empire {
  const e = empireOf(s.clan);
  const levels = { ...e.levels };
  for (const k of Object.keys(levels) as VillageBuilding[]) levels[k] = Math.round(levels[k] * share);
  return { ...newEmpire(), levels, troops: { footman: Math.round(e.troops.footman * share), axeman: 0, knight: 0 } };
}

/** Test page only: the pretend classmates as the raid list sees them. */
export function pretendSketches(s: Session): RivalSketch[] {
  const week = weekOf(pretendToday(s));
  return PRETEND.map((p) => {
    const e = pretendEmpire(s, p.share);
    return { id: p.id, name: p.name, heroLevels: pretendHeroes(s, p).reduce((t, m) => t + m.level, 0), levels: e.levels, troops: e.troops, banners: { week, count: p.banners }, sameClass: !p.className, className: p.className };
  });
}

/** Test page only: one pretend classmate, loaded to be raided. */
export function pretendTarget(s: Session, id: string): RaidTarget | null {
  const p = PRETEND.find((x) => x.id === id);
  return p ? { id: p.id, name: p.name, gold: 0, members: pretendHeroes(s, p), empire: pretendEmpire(s, p.share) } : null;
}

/** Test page only: the raid screen's list and Banners board. */
export function pretendRaidList(s: Session): { targets: Rival[]; board: BoardRow[]; left: number } {
  const e = empireOf(s.clan);
  const mates = pretendSketches(s);
  return { targets: rivalList(s.clan, e.raidedToday, mates), board: bannerBoard(s.clan, weekOf(pretendToday(s)), mates), left: raidsLeft(e) };
}

/** Test page only: start a raid (no siege question in Practice). The same siege and fight the server would make. */
export function pretendRaidStart(s: Session, id: string): { ok: true; session: Session; open: ShownFight; breach: number; tower: number } | Fail {
  const target = pretendTarget(s, id);
  if (!target) return { ok: false, why: 'target', say: "That clan can't be raided right now." };
  const clan = structuredClone(s.clan);
  const e = empireOf(clan);
  if (raidsLeft(e) <= 0) return { ok: false, why: 'limit', say: `That's all ${CONFIG.classRaids.perDay} raids for today. Come back tomorrow!` };
  if (e.raidedToday.includes(id)) return { ok: false, why: 'same', say: 'You already raided that clan today. Pick another one!' };
  const seed = raidSeedFor(s.baseSeed, s.raidNo ?? 0);
  const siege = raidSiege(e, targetEmpire(target), null, seed);
  const sketch = pretendSketches(s).find((x) => x.id === id)!;
  const setup: RaidSetup = {
    target: id, name: target.name, light: lightOf(Math.max(1, clanPower(clan)), sketchPower(sketch)),
    defenders: target.members.map(defenderCopy), breach: siege.breach, tower: siege.tower, right: null,
  };
  e.raidsToday++;
  e.raidedToday.push(id);
  const open: ShownFight = { depth: 0, boss: false, seed, no: s.fightNo + 1, settings: s.settings, rounds: [], raid: setup };
  return { ok: true, session: { ...s, clan, raidNo: (s.raidNo ?? 0) + 1, fightNo: s.fightNo + 1 }, open, breach: siege.breach, tower: siege.tower };
}

/** Test page only: a raid is over. The same pay the server gives; the pretend classmate gets nothing (it isn't real). */
export function pretendRaidFinish(s: Session, setup: RaidSetup, fight: FightState): { session: Session; outcome: RaidOutcome } {
  const clan = structuredClone(s.clan);
  const e = empireOf(clan);
  const won = fight.result === 'won';
  const pay = raidReward(fight.result, setup.light, e);
  clan.gold += pay.gold;
  e.banners = addBanners(e.banners, weekOf(pretendToday(s)), pay.banners);
  return {
    session: earn({ ...s, clan, news: [`${raidNews(clan.name, setup.name, won)} (pretend)`, ...(s.news ?? [])] }, { classRaids: won ? 1 : 0 }),
    outcome: { name: setup.name, light: setup.light, won, gold: pay.gold, banners: pay.banners },
  };
}

/**
 * A new season: pick a member's race and class again, before they have played. The same sum the server does (same dice), so the answer
 * agrees. Null if the member has started this season, or the race or class is not a real one.
 */
export function repickMember(s: Session, memberIndex: number, race: string, cls: string): Session | null {
  const m = s.clan.members[memberIndex];
  if (!m || m.level !== 1 || m.xp !== 0 || !raceByName(race) || !classByName(cls)) return null;
  const clan = structuredClone(s.clan);
  const fresh = rollMember({ rng: Math.imul(slotSeed(s.baseSeed, memberIndex) | 0, 2654435761) + (clan.season ?? 0) * 7919 }, m.name, race, cls, memberIndex === 0);
  clan.members[memberIndex] = { ...fresh, ...(m.look ? { look: m.look } : {}) };
  return { ...s, clan };
}

/** A new name for one member on the re-pick screen, or why it can't be used. */
export function renameMember(s: Session, memberIndex: number, name: string, typedNames: boolean): { ok: true; session: Session; name: string } | { ok: false; say: string } {
  const named = renameCheck(s.clan, memberIndex, name, typedNames);
  if (!named.ok) return named;
  const clan = structuredClone(s.clan);
  clan.members[memberIndex] = { ...clan.members[memberIndex], name: named.name };
  return { ok: true, session: { ...s, clan }, name: named.name };
}

/** "Keep going" on the re-pick screen. */
export function repickDone(s: Session): Session {
  const { repick: _repick, ...clan } = structuredClone(s.clan);
  return { ...s, clan };
}

/** Test page only: a full set of monster supplies, so the potions and the net can be seen in a practice fight. */
export function giveSupplies(s: Session): Session {
  const clan = structuredClone(s.clan);
  const season = s.season ?? 1;
  const save = monsterSave(clan, season);
  clan.monster = { ...save, supplies: { arrows: CONFIG.monster.supplies.arrows.max, potions: CONFIG.monster.supplies.potions.max, net: CONFIG.monster.supplies.net.max } };
  return { ...s, clan };
}

/** Buy monster supplies at the Market (paid from the purse, never more than the most a clan may hold). Null if it can't be done. */
export const buySupplies = (s: Session, season: number, kind: SupplyKind, count: number): Session | null => withClan(s, (clan) => buySupply(clan, season, kind, count).ok);
