import { describe, expect, it } from 'vitest';
import { SLIP_WORDS } from '../../../src/games/beanstalk/words';
import { memoryServices } from '../../../shared/beanstalk/memoryServices';
import { mistakeKind, replay, targetOf, type MistakeKind, type Round, type Tap } from '../../../shared/beanstalk/round';
import { makeHandler } from './handler';

// S34: Kiwi's Beanstalk saves the kind of each go's first wrong pair (replay().slips in shared/beanstalk/round.ts) and has a plain phrase for every kind.

const KINDS: MistakeKind[] = ['over', 'under', 'close', 'digit'];

/** Every pair right first time, after one wrong pair on the first go if `wobble`. */
function tapsFor(round: Round, wobble: boolean): Tap[] {
  const taps: Tap[] = [];
  for (let r = replay(round, taps); !r.done; r = replay(round, taps)) {
    const [a] = r.onScreen;
    const wrong = r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] !== targetOf(round, a));
    if (wobble && taps.length === 0 && wrong !== undefined) taps.push({ a, b: wrong, ms: 4000 });
    taps.push({ a, b: r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] === targetOf(round, a))!, ms: 12_000 });
  }
  return taps;
}

async function started() {
  // 9 pm NZ time on 4 Nov 2026 (8 am UTC).
  let seed = 0.1;
  const services = memoryServices({ now: () => Date.UTC(2026, 10, 4, 8), random: () => (seed += 0.137) % 1 });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (body: object) => {
    const res = await handler(new Request('https://x/beanstalk', { method: 'POST', headers: { Authorization: 'Bearer pupil-a' }, body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  await send({ action: 'choose', child: 'jill' });
  const { seed: roundSeed, round } = (await send({ action: 'start' })).body as { seed: number; round: Round };
  return { services, send, round, roundSeed };
}

describe('the kind of slip Kiwi’s Beanstalk saves (S34)', () => {
  it('has nothing for goes right first time, and the kind of the first wrong pair for a go that began wrong', async () => {
    const { round } = await started();
    expect(replay(round, tapsFor(round, false)).slips.every((s) => s === null)).toBe(true);
    const taps = tapsFor(round, true);
    const slips = replay(round, taps).slips;
    expect(slips).toHaveLength(10);
    const [{ a, b }] = taps;
    expect(slips[0]).toBe(mistakeKind(round.leaves[a] + round.leaves[b], targetOf(round, a)));
    expect(slips[0]).not.toBeNull();
    expect(slips.slice(1).every((s) => s === null)).toBe(true);
  });

  it('saves the slips with the finished round', async () => {
    const { round, send, services, roundSeed } = await started();
    const taps = tapsFor(round, true);
    expect((await send({ action: 'finish', seed: roundSeed, taps })).status).toBe(200);
    const saved = services.data.rounds.find((r) => r.seed === roundSeed)!;
    expect(saved.slips).toEqual(replay(round, taps).slips);
  });

  it('has a short plain phrase for every kind of slip', () => {
    expect(Object.keys(SLIP_WORDS).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) {
      expect(SLIP_WORDS[kind].trim().length).toBeGreaterThan(3);
      expect(SLIP_WORDS[kind].length).toBeLessThanOrEqual(60);
    }
  });
});
