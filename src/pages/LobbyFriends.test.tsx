import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { HubAsk } from '../data/hubAsks';
import type { HerePlayer } from '../data/lobbyHere';
import { starPlayer } from '../data/lobbyStars';
import { speak } from '../speech';
import { ChallengesForYou, WhosHere } from './LobbyFriends';

vi.mock('../data/lobbyStars', () => ({ starPlayer: vi.fn() }));
vi.mock('../speech', () => ({ speak: vi.fn() }));

const kid = (name: string, games: HerePlayer['games'], sameClass = true): HerePlayer => ({
  id: name, name, avatar: null, clan: null, games, sameClass, className: sameClass ? null : 'Room 9', here: true,
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

  it('finds a kid who’s here, says why a game can’t be played, sends a challenge or an invite, and keeps my stars on top', async () => {
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

    // Stars (stage 8): my stars on top, the ones who aren't here greyed, star a kid, Played recently, and the hint once.
    cleanup();
    localStorage.clear();
    vi.mocked(speak).mockClear();
    vi.mocked(starPlayer).mockResolvedValue(null);
    const near = [kid('Ari', {}), { ...kid('Ben', {}), starred: true }, kid('Cal', {}, false)];
    const away = { id: 'Gus', name: 'Gus', avatar: null, sameClass: true, className: null, starred: true };
    const recent = [kid('Ari', {}), { ...kid('Zed', {}, false), here: false }];
    const screenWith = () => (
      <MemoryRouter>
        <WhosHere online={near} starsAway={[away]} recent={recent} me={null} games={[]} boards={[]} focus={null}
          onClearFocus={() => {}} sending={false} problem="" onSend={() => {}} />
      </MemoryRouter>
    );
    const first = render(screenWith());
    expect(screen.getByRole('status')).toHaveTextContent('Tap ☆ to keep your friends at the top');
    expect(speak).toHaveBeenCalledTimes(1);

    const stars = within(screen.getByRole('list', { name: 'Kids here now: your stars' }));
    expect(stars.getByText('Ben')).toBeInTheDocument();
    expect(stars.getByRole('img', { name: 'here now' })).toBeInTheDocument();
    const gone = within(screen.getByRole('list', { name: 'Your stars who aren’t here' })).getByText('Gus').closest('li')!;
    expect(gone).toHaveClass('school-list__item--away');
    expect(gone).toHaveTextContent('Not here right now');

    // Starring Cal moves Cal up into Your stars; taking it off moves Cal back.
    await userEvent.click(within(screen.getByRole('list', { name: 'Kids here now: rest of the school' })).getByRole('button', { name: 'Star Cal' }));
    expect(starPlayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'Cal' }), true);
    await userEvent.click(stars.getByRole('button', { name: 'Take the star off Cal' }));
    expect(starPlayer).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'Cal' }), false);
    expect(stars.queryByText('Cal')).not.toBeInTheDocument();

    const played = within(screen.getByRole('list', { name: 'Played recently' }));
    expect(played.getByRole('button', { name: 'Play with Ari' })).toBeInTheDocument();
    expect(played.getByText('Zed').closest('li')).toHaveTextContent('Not here right now');
    expect(played.queryByRole('button', { name: 'Play with Zed' })).not.toBeInTheDocument();

    // The hint shows only once.
    first.unmount();
    render(screenWith());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(speak).toHaveBeenCalledTimes(1);
  });
});
