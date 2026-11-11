import { describe, expect, it } from 'vitest';
import { memoryServices } from '../../../shared/hop/memoryServices';
import { type Tap } from '../../../shared/hop/play';
import { showRound, type Round } from '../../../shared/hop/round';
import { makeHandler } from './handler';

// S34: Hop saves the kind of each go's first wrong choice (slipsOf in shared/hop/play.ts) and has a plain phrase for every kind.


async function started() {
  // 9 pm NZ time on 4 Nov 2026 (8 am UTC).
  let seed = 0.1;
  const services = memoryServices({ now: () => Date.UTC(2026, 10, 4, 8), random: () => (seed += 0.137) % 1 });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (body: object) => {
    const res = await handler(new Request('https://x/hop', { method: 'POST', headers: { Authorization: 'Bearer pupil-a' }, body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const round = (await send({ action: 'start' })).body.round as Round;
  return { services, send, round };
}

describe('the kind of slip Hop saves (S34)', () => {
  it('saves the slips with the finished round, null for a go that was right first time', async () => {
    const { round, send, services } = await started();
    const [first] = showRound(round);
    const taps: Tap[] = showRound(round).flatMap((go, i) => [...(i === 0 ? [{ pick: first.wrongs[0].n, ms: 4000 }] : []), { pick: go.answer, ms: 2500 }]);
    expect((await send({ action: 'finish', seed: round.seed, taps })).status).toBe(200);
    const saved = services.data.rounds.find((r) => r.round.seed === round.seed)!;
    expect(saved.slips).toEqual([first.wrongs[0].kind, ...showRound(round).slice(1).map(() => null)]);
  });

});
