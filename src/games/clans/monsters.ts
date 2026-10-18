import { MONSTERS } from '../../../shared/clans/gamedata';
import type { MonsterDef } from '../../../shared/clans/types';

export const MONSTERS_BY_NAME: Record<string, MonsterDef> = Object.fromEntries(MONSTERS.map((m) => [m.name, m]));
