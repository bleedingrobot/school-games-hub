import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { MarblePlay } from './MarblePlay';

vi.mock('./RunScreen', () => ({
  RunScreen: ({ course, mode, onDone, onExit }: { course: { def: { id: string } }; mode: string; onDone: (r: unknown) => unknown; onExit: () => void }) => (
    <div>
      <p>Running {course.def.id} in {mode}</p>
      <button onClick={() => onDone({ courseId: course.def.id, mode, outcome: 'finished', steps: 200, falls: 0, checkpoints: 0, inputs: [] })}>finish</button>
      <button onClick={onExit}>exit</button>
    </div>
  ),
}));

beforeEach(() => localStorage.clear());
const open = () => render(<SoundProvider><MarblePlay /></SoundProvider>);

describe('course picker', () => {
  it('shows the six New Zealand courses as coming soon, with a Did you know card', () => {
    open();
    for (const name of ['Boulder Beach', 'Crown Range Zig-Zag', 'Geyser Valley', 'Glacier Run', 'Windy Welly', 'Alpine Crossing']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Coming soon')).toHaveLength(6);
    expect(screen.getAllByText('Did you know?')).toHaveLength(6);
    expect(screen.getByText(/1,076 metres/)).toBeInTheDocument();
  });

  it('plays a practice course, remembers the best time and then offers hard mode', async () => {
    open();
    const card = screen.getByRole('heading', { name: 'Wide Hill' }).closest('li')!;
    expect(within(card).queryByRole('button', { name: /Hard mode/ })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Play Wide Hill' }));
    expect(await screen.findByText('Running test-easy in up')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'exit' }));
    const after = screen.getByRole('heading', { name: 'Wide Hill' }).closest('li')!;
    expect(within(after).getByText(/Best: 0:03.33/)).toBeInTheDocument();
    fireEvent.click(within(after).getByRole('button', { name: /Hard mode/ }));
    expect(await screen.findByText('Running test-easy in down')).toBeInTheDocument();
  });
});
