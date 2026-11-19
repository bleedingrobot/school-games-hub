import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { HubAsk } from '../data/hubAsks';
import type { HerePlayer } from '../data/lobbyHere';
import { ChallengesForYou, WhosHere } from './LobbyFriends';

const kid = (name: string, games: HerePlayer['games'], sameClass = true): HerePlayer => ({
  id: name, name, avatar: null, clan: null, games, sameClass, className: sameClass ? null : 'Room 9',
});

describe('the new Lobby', () => {
  it('lists the challenges for me with Yes and No', async () => {
    const ask: HubAsk = { game: 'dragon-maths', id: 7, from: 'Mia', deadline: new Date(Date.now() + 30_000).toISOString() };
    const onYes = vi.fn();
    const onNo = vi.fn();
    render(<ChallengesForYou asks={[ask]} serverNow={Date.now} onYes={onYes} onNo={onNo} />);
    const box = within(screen.getByRole('region', { name: /Challenges for you/ }));
    expect(box.getByText('Mia challenges you to a Dragon Maths arena clash!')).toBeInTheDocument();
    await userEvent.click(box.getByRole('button', { name: 'Yes!' }));
    expect(onYes).toHaveBeenCalledWith(ask);
    await userEvent.click(box.getByRole('button', { name: 'No' }));
    expect(onNo).toHaveBeenCalledWith(ask);
  });

  it('finds a kid who’s here, says why a game can’t be played, and sends a challenge or an invite', async () => {
    const online = [
      kid('Ari', { 'dragon-maths': 'ok' }), kid('Ben', {}), kid('Cal', {}), kid('Dee', {}), kid('Eve', {}), kid('Fin', {}),
      kid('Mia', { 'dragon-maths': 'none', archery: 'ok', 'clan-quest': 'busy', chess: 'ok', space: 'busy', 'power-clash': 'off' }, false),
    ];
    const onSend = vi.fn();
    render(
      <MemoryRouter>
        <WhosHere
          online={online}
          me={{ archery: 'ready', 'dragon-maths': 'ready', 'clan-quest': 'ready', isles: 'ready', raid: 'ready' }}
          games={['archery', 'dragon-maths', 'clan-quest']}
          boards={['chess', 'space', 'power-clash']}
          focus={null}
          onClearFocus={() => {}}
          sending={false}
          problem=""
          onSend={onSend}
        />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a name' }), 'mi');
    expect(screen.queryByText('Ari')).not.toBeInTheDocument();
    expect(screen.getByText('Room 9')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Play with Mia' }));
    expect(screen.getByText('Mia hasn’t made a Dragon Maths hero yet')).toBeInTheDocument();
    expect(screen.getByText('Mia is busy in a game right now')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archery fight' }));
    expect(onSend).toHaveBeenCalledWith('archery', online[6]);
    // Board games are invites by name.
    expect(screen.getByText('Mia has another invite waiting')).toBeInTheDocument();
    expect(screen.getByText('Mia’s class has paused Power Clash')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Chess' }));
    expect(onSend).toHaveBeenCalledWith('chess', online[6]);
  });
});
