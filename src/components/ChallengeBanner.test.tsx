import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { AskGame, HeardAsk, HubAsk, HubAskLink } from '../data/hubAsks';
import { ChallengeBanner } from './ChallengeBanner';

const soon = () => new Date(Date.now() + 30_000).toISOString();

/** A pretend server: `ask` is what's waiting now; `hear` sends a new one live. */
function fakeLink(ask: HubAsk) {
  let heard: ((h: HeardAsk) => void) | null = null;
  const link: HubAskLink = {
    checkIn: vi.fn(async () => [ask.game] as AskGame[]),
    asksIn: vi.fn(async (game: AskGame) => (game === ask.game ? [ask] : [])),
    decline: vi.fn(async () => {}),
    accept: vi.fn(async (a: HubAsk): Promise<{ path: string } | { problem: string }> =>
      a.id === 99 ? { problem: 'That invite has gone. Ask your friend to send another.' } : { path: `/play/game-${a.id}` },
    ),
    watch: (_me, on) => {
      heard = on;
      return () => (heard = null);
    },
    clockOffset: async () => 0,
  };
  return { link, hear: (a: HubAsk) => act(() => heard?.({ ask: a })) };
}

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function show(link: HubAskLink, page = 'home') {
  return render(
    <MemoryRouter initialEntries={[`/${page}`]}>
      <ChallengeBanner link={link} me="me" page={page} inGame={page !== 'home'} />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const archery: HubAsk = { game: 'archery', id: 7, from: 'Aroha', deadline: soon() };

describe('the challenge banner anywhere in the hub', () => {
  it('shows a friend’s challenge or invite: Yes opens it, No says no, Not now waits for the next, never inside its own game', async () => {
    // Shows, and Yes opens that game at the challenge.
    const first = show(fakeLink(archery).link);
    expect(await screen.findByText(/Aroha challenges you to an Archery Challenge fight!/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes!' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/archery?ask=7');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    first.unmount();

    // No says no through the game's own step.
    const saidNo = fakeLink(archery);
    const second = show(saidNo.link);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(saidNo.link.decline).toHaveBeenCalledWith(archery);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    second.unmount();

    // Not now hides it until the next new challenge.
    const later = fakeLink(archery);
    const third = show(later.link);
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    later.hear({ game: 'dragon-maths', id: 3, from: 'Mere', deadline: soon() });
    expect(await screen.findByText(/Mere challenges you to a Dragon Maths arena clash!/)).toBeInTheDocument();
    third.unmount();

    // Never inside the game it's from.
    const inArchery = fakeLink({ ...archery, id: 8 });
    const fourth = show(inArchery.link, 'archery');
    await act(async () => {});
    expect(inArchery.link.asksIn).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fourth.unmount();

    // An invite by name (stage 4): Yes makes the game then opens it, a gone invite says so, No says no.
    const chess: HubAsk = { game: 'chess', id: 5, from: 'Mia', deadline: soon() };
    // Shows even on the chess page (invites have no pop-up of their own), and Yes opens the private game.
    const yes = fakeLink(chess);
    const fifth = show(yes.link, 'chess');
    fireEvent.click(await screen.findByRole('button', { name: /Invite!/ }));
    expect(screen.getByText(/Mia invites you to play Chess!/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes!' }));
    expect(yes.link.accept).toHaveBeenCalledWith(chess);
    await act(async () => {});
    expect(screen.getByTestId('where')).toHaveTextContent('/play/game-5');
    fifth.unmount();

    // An invite that has gone says so.
    const gone = fakeLink({ ...chess, game: 'space', id: 99 });
    const sixth = show(gone.link);
    expect(await screen.findByText(/Mia invites you to play Wormholes & Black Holes!/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes!' }));
    expect(await screen.findByText('That invite has gone. Ask your friend to send another.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    sixth.unmount();

    // No says no.
    const no = fakeLink({ ...chess, game: '101', id: 6 });
    show(no.link);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(no.link.decline).toHaveBeenCalledWith(expect.objectContaining({ game: '101', id: 6 }));
  });
});
