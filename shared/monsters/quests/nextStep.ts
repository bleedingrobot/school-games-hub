/**
 * The "what next" line above the map (docs/MONSTERS-QUESTS-PLAN.md section 2, like Star Trader's Bolt
 * and Clan Quest's next-step line): one sentence with real names, worked out fresh from the save.
 * `target` says what the "Show me" button points at (a person, a spot, or a whole map).
 */
import { BIT_NAME, canMake, describeBits, RECIPES } from './bits';
import { EGG_LABEL, HATCH_SPOTS, isReady } from './eggs';
import { canWake, GIANTS, isAwake } from './giants';
import { canStart, FINALE_NEEDS, jobsFor, questById, QUESTS, stepHint } from './quests';
import type { QuestSave, Task } from './types';
import type { TypeId } from '../types';
import { AREAS } from '../world/areas';

export interface NextStep {
  text: string;
  target?: { map?: string; person?: string; spot?: string };
}

export interface NextContext {
  badges: readonly string[];
  playDays: number;
  day?: string;
  player?: string;
  /** Where the next badge is won, from the world (e.g. "Beat the Tower trainer in Shell Beach"). */
  badgeStep?: NextStep;
}

const fill = (t: Task, left: number) => t.hint.replace('{left}', String(left));

const mapOfPerson = (id: string) => id.split(':')[0];

/** A map's place name for a sentence: "Kauri Bush", or "Harbour Town" for the starting town. */
const placeName = (map: string) => AREAS.find((a) => a.map === map)?.name ?? 'Harbour Town';

/** A person's name in a sentence: "the Hermit" and "the Teacher" are jobs, not names. */
const personName = (id: string) => {
  const name = id.split(':')[1];
  return ['Hermit', 'Teacher'].includes(name) ? `the ${name}` : name;
};

export function nextStep(q: QuestSave, ctx: NextContext): NextStep {
  // 1. An egg ready to hatch: the most exciting thing, and it needs a trip.
  const ready = q.eggs.find((e) => isReady(e, ctx.playDays));
  if (ready) {
    const spot = HATCH_SPOTS[ready.kind];
    return { text: `Your ${EGG_LABEL[ready.kind]} is ready! Take it to ${spot.place} to hatch it.`, target: { map: spot.map, spot: spot.spot } };
  }
  // 2. A giant whose item is made: go and wake it.
  const wakeable = GIANTS.find((g) => canWake(q, g, ctx.badges));
  if (wakeable) return { text: `You have the ${wakeable.itemName}. Go and wake the sleeping giant!`, target: { map: wakeable.map } };
  // 3. A started story quest's step.
  for (const quest of QUESTS) {
    const st = q.quests[quest.id];
    if (!st) continue;
    const task = quest.steps[st.step];
    if (st.ready) return { text: `Part done! ${stepHint(quest, st)}.`, target: { person: quest.giver, map: mapOfPerson(quest.giver) } };
    if (quest.id === 'finale' && !FINALE_NEEDS.every((f) => q.flags.includes(f))) {
      const missing = FINALE_NEEDS.filter((f) => !q.flags.includes(f)).map((f) => f.slice(8));
      return { text: `Hatch ${missing.length === 1 ? 'one more egg' : `${missing.length} more kinds of egg`} for the Teacher in Harbour Town.` };
    }
    if (task.do === 'bring') {
      const have = q.bits[task.type as TypeId] ?? 0;
      const need = task.count ?? 1;
      if (have < need) return { text: `Collect ${need - have} more ${BIT_NAME[task.type as TypeId][need - have === 1 ? 0 : 1]} for ${quest.title.toLowerCase()} (wild monsters drop them).` };
    }
    return { text: fill(task, (task.count ?? 1) - st.n), target: task.person ? { person: task.person, map: mapOfPerson(task.person) } : task.map ? { map: task.map, spot: task.spot } : undefined };
  }
  // 4. A wake-up item you could make now.
  for (const g of GIANTS) {
    if (isAwake(q, g) || !ctx.badges.includes(g.badge)) continue;
    const recipe = RECIPES.find((r) => r.flag === g.item)!;
    const can = canMake(q, recipe);
    if ('cost' in can) return { text: `You have enough bits! Ask the Tinker in Harbour Town to make the ${recipe.name}.`, target: { person: 'harbour-town:Tinker', map: 'harbour-town' } };
    if (recipe.needs?.every((f) => q.flags.includes(f))) return { text: `Collect bits for the ${recipe.name}: ${describeBits(recipe.cost)}.` };
  }
  // 5. A quest you can start.
  const badges = ctx.badges.length;
  const startable = QUESTS.find((quest) => canStart(q, quest, badges));
  if (startable) return { text: `Someone needs help: talk to ${personName(startable.giver)} in ${placeName(mapOfPerson(startable.giver))}.`, target: { person: startable.giver, map: mapOfPerson(startable.giver) } };
  // 6. Today's notice board.
  if (ctx.day && ctx.player) {
    const jobs = jobsFor(ctx.day, ctx.player, { maxArea: badges + 1 });
    const board = q.board?.day === ctx.day ? q.board : undefined;
    const open = jobs.findIndex((_, i) => !board?.paid.includes(i));
    if (open >= 0) return { text: fill(jobs[open], (jobs[open].count ?? 1) - (board?.n[open] ?? 0)) };
  }
  // 7. The next badge, from the world.
  if (ctx.badgeStep) return ctx.badgeStep;
  return { text: 'Fill your monster book: some monsters only turn up in the rain, or on one special day!' };
}

export { questById };
