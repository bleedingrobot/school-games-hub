import { expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HelpPanel } from './HelpPanel';

it('lists pupils who used Help me with the skills they asked about, and says so when nobody did', async () => {
  render(
    <HelpPanel
      classId="c1"
      load={async () => [{ id: 'a', name: 'Ana', realName: 'ana', helped: 4, right: 3, days: 2, topKeys: ['mul:7x8', 'mul:8x7'], lastAt: null }]}
    />,
  );
  expect(await screen.findByText('Ana')).toBeTruthy();
  expect(screen.getByText('3 of 4')).toBeTruthy();
  expect(screen.getByRole('table').textContent).toMatch(/Times tables|7|8/);
  cleanup();

  render(<HelpPanel classId="c1" load={async () => []} />);
  expect(await screen.findByText('Nobody has used Help me in the last 7 days.')).toBeTruthy();
});
