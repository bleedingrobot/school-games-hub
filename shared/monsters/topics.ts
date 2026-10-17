/**
 * The teacher's topic switches. A switched-off topic's questions are swapped for the nearest topic
 * that is on, so no area is ever blocked. "Nearest" is the topic next to it in teaching order
 * (the order of the six types in the plan); when two are equally near, the earlier (easier) one wins.
 */
import { TOPICS, type TopicId } from '../maths/skillPacks';

export const TOPIC_IDS: readonly TopicId[] = TOPICS.map((t) => t.id);

/** The topic to ask instead of `topic` when only `enabled` are on. Never returns a switched-off topic unless none is on. */
export function effectiveTopic(topic: TopicId, enabled: readonly TopicId[] | undefined): TopicId {
  if (!enabled || enabled.length === 0 || enabled.includes(topic)) return topic;
  const at = TOPIC_IDS.indexOf(topic);
  let best: TopicId = topic;
  let bestDistance = Infinity;
  for (const id of TOPIC_IDS) {
    if (!enabled.includes(id)) continue;
    const distance = Math.abs(TOPIC_IDS.indexOf(id) - at);
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

export const isTopicId = (x: unknown): x is TopicId => typeof x === 'string' && (TOPIC_IDS as readonly string[]).includes(x);
