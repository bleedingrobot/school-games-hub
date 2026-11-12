import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { newEmpire } from '../../../shared/clans/empire';
import { VILLAGE_BUILDINGS, type VillageBuilding } from '../../../shared/clans/types';
import { VillageScene } from './VillageScene';

// My Village as a scene: every building (the Walls by their gate) is a button that says its level and price, and tapping picks it.
describe('VillageScene', () => {
  it('has a labelled button for each of the 8 buildings, and tapping one picks it', async () => {
    const e = newEmpire();
    e.levels.tower = 3;
    e.levels.smithy = 6;
    const states = Object.fromEntries(VILLAGE_BUILDINGS.map((b) => [b, { ok: b !== 'smithy' }])) as Record<VillageBuilding, { ok: boolean }>;
    const onPick = vi.fn();
    render(<VillageScene e={e} states={states} onPick={onPick} />);
    expect(screen.getAllByRole('button')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Smithy, level 6 of 6, fully built' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Church, not built yet, you can upgrade to level 1 for 50 gold' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Tower, level 3 of 5, you can upgrade to level 4 for 200 gold/ }));
    expect(onPick).toHaveBeenCalledWith('tower');
  });
});
