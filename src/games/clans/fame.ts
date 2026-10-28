/**
 * Fame, the scoreboard and the achievements, for the screens. The real fame is kept by the database; the test page (no server)
 * works it out here from the same rules so James can see the screens.
 */
import { ACHIEVEMENTS, measures, NO_STATS, reached, type AchievementDef, type ClanStats } from '../../../shared/clans/rewards';
import { empireOf } from '../../../shared/clans/empire';
import { VILLAGE_BUILDINGS } from '../../../shared/clans/types';
import { earn, type Session } from './session';

/** One line of the scoreboard: a place, a clan name and fame. Nothing else is ever sent. */
export interface ScoreRow {
  place: number;
  name: string;
  fame: number;
  isMe: boolean;
}

/** What `clan_scoreboard()` gives back (the database's column names). */
export interface ScoreRowRaw {
  place: number;
  clan_name: string;
  fame: number;
  is_me: boolean;
}

export const toScoreRow = (r: ScoreRowRaw): ScoreRow => ({ place: r.place, name: r.clan_name, fame: r.fame, isMe: r.is_me });

/** Test page only: other clans, made up. */
export const PRETEND_CLANS: { name: string; fame: number }[] = [
  { name: 'Swift Foxes', fame: 212 }, { name: 'Brave Owls', fame: 187 }, { name: 'Red Wolves', fame: 164 }, { name: 'Gold Hawks', fame: 141 },
  { name: 'Iron Bears', fame: 120 }, { name: 'Wild Stags', fame: 96 }, { name: 'Blue Herons', fame: 77 }, { name: 'Green Otters', fame: 41 },
  { name: 'Quiet Moles', fame: 18 }, { name: 'Tiny Newts', fame: 7 }, { name: 'Sleepy Cats', fame: 3 },
];

/** Test page only: the pretend clans and you, by fame. Ties share a place; the top ten plus you, like the real one. */
export function pretendBoard(s: Session): ScoreRow[] {
  const all = [...PRETEND_CLANS.map((c) => ({ ...c, isMe: false })), { name: s.clan.name, fame: s.fame ?? 0, isMe: true }]
    .map((c, i) => ({ ...c, order: i }))
    .sort((a, b) => b.fame - a.fame || a.order - b.order);
  const rows = all.map((c) => ({ place: 1 + all.filter((o) => o.fame > c.fame).length, name: c.name, fame: c.fame, isMe: c.isMe }));
  return rows.filter((r, i) => (i < 10 && r.fame > 0) || r.isMe);
}

/** Test page only: some fame, as if won in the Mines. */
export const giveFame = (s: Session, n: number): Session => ({ ...s, fame: (s.fame ?? 0) + n });

/** Test page only: start a new season (every clan's fame goes to 0; the clan, its gold and its achievements stay). */
export const newSeason = (s: Session): Session => ({ ...s, fame: 0, season: (s.season ?? 1) + 1 });

/** Test page only: give just enough of the lifetime counts to earn the next achievement that is not earned yet. */
export function awardNext(s: Session): Session {
  const have = new Set(s.achievements ?? []);
  const next = ACHIEVEMENTS.find((a) => !have.has(a.id));
  if (!next) return s;
  const stats: ClanStats = { ...(s.stats ?? NO_STATS) };
  const clan = structuredClone(s.clan);
  switch (next.measure) {
    case 'clan_wins': stats.mineWins = Math.max(stats.mineWins, next.goal); break;
    case 'clan_bosses': stats.bossWins = Math.max(stats.bossWins, next.goal); break;
    case 'clan_wars': stats.warWins = Math.max(stats.warWins, next.goal); break;
    case 'clan_village': stats.villageBuilt = Math.max(stats.villageBuilt, next.goal); break;
    case 'clan_cries': stats.cries = Math.max(stats.cries, next.goal); break;
    case 'clan_monster': stats.monsterSlain = Math.max(stats.monsterSlain ?? 0, next.goal); break;
    case 'clan_level': clan.members[0] = { ...clan.members[0], level: Math.max(clan.members[0].level, next.goal) }; break;
    case 'clan_buildings': {
      const levels = empireOf(clan).levels;
      for (const b of VILLAGE_BUILDINGS) if (Object.values(levels).filter((n) => n > 0).length < next.goal && levels[b] < 1) levels[b] = 1;
      break;
    }
  }
  const ids = reached(measures(clan, stats));
  return { ...s, clan, stats, achievements: [...new Set([...have, ...ids])] };
}

/** The achievements with whether each is earned, and how far along (for the clan page). */
export function achievementList(s: Session): { def: AchievementDef; earned: boolean }[] {
  const have = new Set(s.achievements ?? []);
  return ACHIEVEMENTS.map((def) => ({ def, earned: have.has(def.id) }));
}

export { earn };
