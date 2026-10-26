import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
import { SoundProvider } from '../../sound';
import { MinePreview } from './MinePlay';
import type { MineSession } from './session';

// There is no WebGL in the test browser: the picture is replaced by one that does nothing.
const view = { draw: vi.fn(), resize: vi.fn(), react: vi.fn(), highlight: vi.fn(), showGate: vi.fn(), stats: () => ({ calls: 0, triangles: 0, pixelRatio: 1 }), setQuality: (n: number) => n, dispose: vi.fn() };
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
  const u = userEvent.setup({ delay: null });
  render(wrap(ui));
  await u.click(screen.getByRole('button', { name: `Play ${name}` }));
  await waitFor(() => expect(session()).toBeTruthy());
  await waitFor(() => expect(screen.queryByText('Starting the mine…')).toBeNull());
  return u;
}

it('shows the heads-up display, flies forward when W is held and records the input', async () => {
  await start('Practice mine');
  expect(screen.getByText('Shield')).toBeInTheDocument();
  expect(view.draw).toHaveBeenCalled();
  const y0 = session().state.py;
  fireEvent.keyDown(window, { code: 'KeyW' });
  await waitFor(() => expect(session().state.steps).toBeGreaterThan(8));
  fireEvent.keyUp(window, { code: 'KeyW' });
  expect(Math.abs(session().state.py - y0) + Math.abs(session().state.px) + Math.abs(session().state.pz)).toBeGreaterThan(0);
  expect(session().runs.length).toBeGreaterThan(0);
});
