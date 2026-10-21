import { describe, expect, it } from 'vitest';
import { startFight, takeShot } from '../../../shared/archery/fight';
import { copyLand } from '../../../shared/archery/land';
import { createFightView } from './renderer';

describe('the fight view without a 2D canvas (tests, very old browsers)', () => {
  it('never throws and every promise resolves straight away', async () => {
    const canvas = document.createElement('canvas');
    const view = createFightView(canvas, { lessMotion: false, simple: false, names: ['You', 'Bolt'] });
    const run = startFight(3, { world: 'snow', players: [{ quiver: {}, shield: 0 }, { quiver: {}, shield: 0 }] });
    view.resize(800, 400, { top: 40, right: 0, bottom: 80, left: 0 });
    view.setRound(run.round);
    view.setAim(0, 50, 0.5);
    view.setTurn(0);
    await view.aimTo(0, 60, 1, 500);
    const landBefore = copyLand(run.round.land);
    const archersBefore: [typeof run.round.archers[0], typeof run.round.archers[1]] = [{ ...run.round.archers[0] }, { ...run.round.archers[1] }];
    const taken = takeShot(run, { angle: 60, power: 60, arrow: 'plain' }, true);
    await view.playShot({ player: 0, record: taken.record!, landBefore, landAfter: copyLand(run.round.land), archersBefore });
    view.celebrate(0);
    view.setOptions({ simple: true, lessMotion: true });
    expect(view.archerOnScreen(0)).toBeNull();
    expect(view.stats().particles).toBe(0);
    view.dispose();
  });
});
