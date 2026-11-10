import { describe, expect, it } from 'vitest';
import { SLIP_WORDS } from '../../../src/games/weka/words';
import { memoryServices } from '../../../shared/weka/memoryServices';
import { slipsOf, type Tap } from '../../../shared/weka/play';
import { showRound, type LandKind, type Round } from '../../../shared/weka/round';
import { makeHandler } from './handler';

// S34: Weka saves the kind of each go's first wrong choice (slipsOf in shared/weka/play.ts) and has a plain phrase for every kind.

const KINDS: LandKind[] = ['rock',  'double',  'part',  'off1',  'add'];

/** One wrong choice on every go (the first one listed), then the right one. */
const wobblyTaps = (round: Round): Tap[] =>
  showRound(round).flatMap((go) => [{ pick: go.wrongs[0].n, ms: 4000 }, { pick: go.answer, ms: 2000 }]);
const rightTaps = (round: Round): Tap[] => showRound(round).map((go) => ({ pick: go.answer, ms: 2500 }));

async function started() {
  // 9 pm NZ time on 4 Nov 2026 (8 am UTC).
  let seed = 0.1;
  const services = memoryServices({ now: () => Date.UTC(2026, 10, 4, 8), random: () => (seed += 0.137) % 1 });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (body: object) => {
    const res = await handler(new Request('https://x/weka', { method: 'POST', headers: { Authorization: 'Bearer pupil-a' }, body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const round = (await send({ action: 'start' })).body.round as Round;
  return { services, send, round };
}

describe('the kind of slip Weka saves (S34)', () => {
  it('names the kind of the first wrong choice on each go', async () => {
    const { round } = await started();
    const goes = showRound(round);
    expect(slipsOf(round, wobblyTaps(round))).toEqual(goes.map((go) => go.wrongs[0].kind));
  });

  it('has nothing for a go right first time, and counts only the first wrong choice of a go', async () => {
    const { round } = await started();
    expect(slipsOf(round, rightTaps(round)).every((s) => s === null)).toBe(true);
    const [go] = showRound(round);
    const other = go.wrongs.find((w) => w.n !== go.wrongs[0].n);
    const taps: Tap[] = [{ pick: go.wrongs[0].n, ms: 3000 }, ...(other ? [{ pick: other.n, ms: 3000 }] : []), { pick: go.answer, ms: 2000 }];
    expect(slipsOf(round, taps)[0]).toBe(go.wrongs[0].kind);
  });

  it('saves the slips with the finished round, null for a go that was right first time', async () => {
    const { round, send, services } = await started();
    const [first] = showRound(round);
    const taps: Tap[] = showRound(round).flatMap((go, i) => [...(i === 0 ? [{ pick: first.wrongs[0].n, ms: 4000 }] : []), { pick: go.answer, ms: 2500 }]);
    expect((await send({ action: 'finish', seed: round.seed, taps })).status).toBe(200);
    const saved = services.data.rounds.find((r) => r.round.seed === round.seed)!;
    expect(saved.slips).toEqual([first.wrongs[0].kind, ...showRound(round).slice(1).map(() => null)]);
  });

  it('has a short plain phrase for every kind of slip', () => {
    expect(Object.keys(SLIP_WORDS).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) {
      expect(SLIP_WORDS[kind].trim().length).toBeGreaterThan(3);
      expect(SLIP_WORDS[kind].length).toBeLessThanOrEqual(60);
    }
  });
});
