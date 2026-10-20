import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld } from '../../../shared/mine/engine';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
import { SoundProvider } from '../../sound';
import { LEVELS } from './levels';
import { MinePlay, MinePreview } from './MinePlay';
import { loadBests, saveBests } from './prefs';
import type { MineSession } from './session';

// There is no WebGL in the test browser: the picture is replaced by one that does nothing.
const view = { draw: vi.fn(), resize: vi.fn(), react: vi.fn(), highlight: vi.fn(), stats: () => ({ calls: 0, triangles: 0, pixelRatio: 1 }), setQuality: (n: number) => n, dispose: vi.fn() };
vi.mock('./renderer', () => ({ createView: () => view }));

const pupil = {
  status: 'signed-in', message: null, profile: { id: 'pilot-1', display_name: 'Pilot', role: 'student' },
  signIn: async () => {}, signOut: async () => {}, refreshProfile: async () => {},
} as unknown as AuthState;

const wrap = (ui: React.ReactElement) => (
  <AuthContext.Provider value={pupil}>
    <SoundProvider>{ui}</SoundProvider>
  </AuthContext.Provider>
);

const session = () => (window as unknown as { __mineSession: MineSession }).__mineSession;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/?debug=1');
  Object.values(view).forEach((f) => typeof f === 'function' && 'mockClear' in f && (f as ReturnType<typeof vi.fn>).mockClear());
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { __mineSession?: MineSession }).__mineSession;
});

async function start(name: string, ui = <MinePreview />) {
  const u = userEvent.setup();
  render(wrap(ui));
  await u.click(screen.getByRole('button', { name: `Play ${name}` }));
  await waitFor(() => expect(session()).toBeTruthy());
  await waitFor(() => expect(screen.queryByText('Starting the mine…')).toBeNull());
  return u;
}

describe('the picker', () => {
  it('puts focus on the heading and lists the practice mine and six mines', () => {
    render(wrap(<MinePreview />));
    expect(screen.getByRole('heading', { name: 'Mine Runner', level: 2 })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Play Practice mine' })).toBeEnabled();
    for (const l of LEVELS) expect(screen.getByRole('button', { name: `Play ${l.name}` })).toBeEnabled();
    expect(screen.getByText(/trial questions/i)).toBeInTheDocument();
  });

  it('only offers the practice mine until the server’s questions arrive (the real, not-yet-live game)', () => {
    render(wrap(<MinePlay />));
    expect(screen.getByRole('button', { name: 'Play Practice mine' })).toBeEnabled();
    for (const l of LEVELS) expect(screen.getByRole('button', { name: `Play ${l.name}` })).toBeDisabled();
    expect(screen.getAllByText(/question server/i).length).toBe(LEVELS.length);
    expect(screen.queryByText(/trial questions/i)).toBeNull();
  });

  it('shows best times saved on this device', () => {
    saveBests({ l2: 30 * 75 }, 'pilot-1');
    render(wrap(<MinePreview />));
    expect(screen.getByText('Best on this device: 1:15.0 (gold medal)')).toBeInTheDocument();
  });

  it('shows the medal times on every mine', () => {
    render(wrap(<MinePreview />));
    expect(screen.getAllByText(/^Medals: gold/).length).toBe(LEVELS.length);
    expect(screen.getByText('Medals: gold 1:35.0, silver 2:10.0, bronze 3:20.0')).toBeInTheDocument();
  });

  it('hard mode swaps every mine for its hard version, with its own times', async () => {
    saveBests({ l2: 30 * 75, 'l2:hard': 30 * 150 }, 'pilot-1');
    const u = userEvent.setup();
    render(wrap(<MinePreview />));
    await u.click(screen.getByRole('checkbox', { name: /hard mode/i }));
    for (const l of LEVELS) expect(screen.getByRole('button', { name: `Play ${l.name} (hard)` })).toBeEnabled();
    expect(screen.getByText('Best on this device: 2:30.0 (silver medal)')).toBeInTheDocument();
    expect(screen.queryByText(/1:15.0/)).toBeNull();
    await u.click(screen.getByRole('checkbox', { name: /hard mode/i }));
    expect(screen.getByRole('button', { name: `Play ${LEVELS[0].name}` })).toBeEnabled();
  });

  it('moves focus to the heading of the how-to-play and controls screens, and back', async () => {
    const u = userEvent.setup();
    render(wrap(<MinePreview />));
    await u.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('heading', { name: 'How to play Mine Runner', level: 2 })).toHaveFocus();
    await u.click(screen.getByRole('button', { name: 'Back to the mines' }));
    await u.click(screen.getByRole('button', { name: 'Controls' }));
    expect(screen.getByRole('heading', { name: 'Controls', level: 2 })).toHaveFocus();
    expect(screen.getByText('Fire the laser')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Back to the mines' }));
    expect(screen.getByRole('heading', { name: 'Mine Runner', level: 2 })).toHaveFocus();
  });

  it('remembers settings for this pupil', async () => {
    const u = userEvent.setup();
    const { unmount } = render(wrap(<MinePreview />));
    await u.click(screen.getByText('Settings', { selector: 'summary' }));
    await u.click(screen.getByLabelText(/Steady flight/));
    await u.selectOptions(screen.getByLabelText('Which hand steers?'), 'left');
    unmount();
    render(wrap(<MinePreview />));
    await u.click(screen.getByText('Settings', { selector: 'summary' }));
    expect(screen.getByLabelText(/Steady flight/)).not.toBeChecked();
    expect(screen.getByLabelText('Which hand steers?')).toHaveValue('left');
  });
});

describe('flying', () => {
  it('shows the heads-up display and starts the clock', async () => {
    await start('Practice mine');
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.getByText('Energy')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('0:00.0');
    expect(screen.getByText(/blue key/i)).toBeInTheDocument();
    expect(view.draw).toHaveBeenCalled();
    // Time runs while the ship flies.
    await waitFor(() => expect(session().state.steps).toBeGreaterThan(3));
  });

  it('flies forward when W is held and records the input', async () => {
    await start('Practice mine');
    const y0 = session().state.py;
    fireEvent.keyDown(window, { code: 'KeyW' });
    await waitFor(() => expect(session().state.steps).toBeGreaterThan(8));
    fireEvent.keyUp(window, { code: 'KeyW' });
    expect(Math.abs(session().state.py - y0) + Math.abs(session().state.px) + Math.abs(session().state.pz)).toBeGreaterThan(0);
    expect(session().runs.length).toBeGreaterThan(0);
  });

  it('stops the game while paused, and moves focus to the Paused heading', async () => {
    const u = await start('Practice mine');
    await u.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('heading', { name: 'Paused' })).toHaveFocus();
    const steps = session().state.steps;
    await act(() => new Promise((r) => setTimeout(r, 250)));
    expect(session().state.steps).toBe(steps);
    await u.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(session().state.steps).toBeGreaterThan(steps));
  });

  it('pauses with Escape and the P key', async () => {
    await start('Practice mine');
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(await screen.findByRole('heading', { name: 'Paused' })).toBeInTheDocument();
  });

  it('opens the map with M, showing the room you are in, and the game waits', async () => {
    await start('Practice mine');
    fireEvent.keyDown(window, { code: 'KeyM' });
    const heading = await screen.findByRole('heading', { name: 'Map' });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('img', { name: /1 rooms visited/ })).toBeInTheDocument();
    const steps = session().state.steps;
    await act(() => new Promise((r) => setTimeout(r, 250)));
    expect(session().state.steps).toBe(steps);
    await userEvent.click(screen.getByRole('button', { name: 'Back to the game' }));
    expect(screen.queryByRole('heading', { name: 'Map' })).toBeNull();
  });

  it('can switch the goal arrow off in settings', async () => {
    localStorage.setItem('mine-runner-prefs-v1:pilot-1', JSON.stringify({ arrow: false }));
    await start('Practice mine');
    expect(screen.queryByText(/blue key/i)).toBeNull();
  });

  it('shows the thumb sticks and buttons when asked, and fires from the big button', async () => {
    localStorage.setItem('mine-runner-prefs-v1:pilot-1', JSON.stringify({ touch: 'on', hand: 'left' }));
    await start('Practice mine');
    expect(document.querySelector('.mn-touch')).toHaveAttribute('data-hand', 'left');
    const fire = screen.getByRole('button', { name: 'Laser' });
    fireEvent.pointerDown(fire, { pointerId: 1 });
    await waitFor(() => expect(session().state.shots.some((s) => s.k === 0) || session().state.energy < 100).toBe(true));
    fireEvent.pointerUp(fire, { pointerId: 1 });
    expect(screen.getByRole('button', { name: 'Missile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rise' })).toBeInTheDocument();
  });

  it('hides the sticks on a computer', async () => {
    await start('Practice mine');
    expect(document.querySelector('.mn-touch')).toBeNull();
  });
});

describe('finishing', () => {
  async function flyTheBot(name: string, id: string) {
    const u = await start(name);
    const s = session();
    const bot = flyLevel(makeWorld(s.world.level, { steady: true }));
    act(() => {
      for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) s.step(code);
    });
    return { u, id };
  }

  it('shows the time, the bests and the next steps; focus goes to the heading', async () => {
    const { u } = await flyTheBot('Practice mine', 'practice');
    const heading = await screen.findByRole('heading', { name: 'You made it out!' });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/Practice times are not saved/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fly it again' })).toBeInTheDocument();
    expect(loadBests('pilot-1')).toEqual({});
    await u.click(screen.getByRole('button', { name: 'Back to the mines' }));
    expect(screen.getByRole('heading', { name: 'Mine Runner', level: 2 })).toBeInTheDocument();
  });

  it('keeps a best time for a real level on this device and offers the next mine', async () => {
    await flyTheBot('Greenstone Hollow', 'l1');
    await screen.findByRole('heading', { name: 'You made it out!' });
    expect(screen.getByText('A new best time on this device!')).toBeInTheDocument();
    expect(loadBests('pilot-1').l1).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Next mine' })).toBeInTheDocument();
  });

  it('starts a fresh run for “Fly it again”', async () => {
    const { u } = await flyTheBot('Practice mine', 'practice');
    await screen.findByRole('heading', { name: 'You made it out!' });
    const old = session();
    await u.click(screen.getByRole('button', { name: 'Fly it again' }));
    await waitFor(() => expect(session()).not.toBe(old));
    expect(session().state.steps).toBeLessThan(5);
  });
});

describe('question doors and pads (trial questions in the preview)', () => {
  /** Flies the bot until a question door or pad is in reach. */
  async function toTheDoor() {
    const u = await start('Otago Diggings');
    const s = session();
    const bot = flyLevel(makeWorld(s.world.level, { steady: true }));
    act(() => {
      outer: for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) {
        s.step(code);
        const t = s.target();
        if (t && t.kind === 'door') break outer;
      }
    });
    expect(s.target()?.kind).toBe('door');
    return { u, s };
  }

  function answerOf(): number {
    const text = screen.getByLabelText(/equals what/).getAttribute('aria-label') ?? '';
    const m = /(\d+) (plus|minus|times) (\d+)/.exec(text)!;
    const [a, b] = [Number(m[1]), Number(m[3])];
    return m[2] === 'plus' ? a + b : m[2] === 'minus' ? a - b : a * b;
  }

  it('asks a clearly-marked trial question, and a right answer opens the door', async () => {
    const { u, s } = await toTheDoor();
    await u.click(await screen.findByRole('button', { name: /Answer to open the door/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Question door' });
    expect(within(dialog).getByText(/Trial question \(preview only\)/)).toBeInTheDocument();
    const id = s.target()!.id;
    await u.keyboard(`${answerOf()}{Enter}`);
    await waitFor(() => expect(s.state.doorsOpen[id]).toBe(1), { timeout: 3000 });
    expect(s.state.doorsByAnswer).toBe(1);
    expect(s.state.badGrants).toBe(0);
    expect(screen.queryByRole('dialog', { name: 'Question door' })).toBeNull();
  });

  it('a wrong answer costs shield and time and leaves the door shut', async () => {
    const { u, s } = await toTheDoor();
    const shield = s.state.shield;
    const clock = s.clock;
    const id = s.target()!.id;
    fireEvent.keyDown(window, { code: 'Enter' });
    await screen.findByRole('dialog', { name: 'Question door' });
    await u.keyboard(`${answerOf() + 1}{Enter}`);
    await waitFor(() => expect(s.state.wrongAnswers).toBe(1), { timeout: 4000 });
    expect(s.state.doorsOpen[id]).toBe(0);
    expect(s.state.shield).toBeLessThan(shield);
    expect(s.clock).toBeGreaterThan(clock);
    expect(await screen.findByText(/Not quite/)).toBeInTheDocument();
  });

  it('the game waits while a question is showing, and Escape lets you leave it with no penalty', async () => {
    const { s } = await toTheDoor();
    fireEvent.keyDown(window, { code: 'Enter' });
    const dialog = await screen.findByRole('dialog', { name: 'Question door' });
    const steps = s.state.steps;
    await act(() => new Promise((r) => setTimeout(r, 250)));
    expect(s.state.steps).toBe(steps);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Question door' })).toBeNull());
    expect(s.state.wrongAnswers).toBe(0);
  });
});
