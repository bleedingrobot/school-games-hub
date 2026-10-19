import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ladderData from '../data/ladder';
import { AUTO_FOCUS, type MathsFocus } from '../../shared/maths/focus';
import { LADDER } from '../../shared/maths/ladder';
import { newStats, type FactStats } from '../../shared/maths/leitner';
import MathsPathCard from './MathsPathCard';

vi.mock('../data/ladder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/ladder')>()),
  fetchMyLadder: vi.fn(),
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'student-1', role: 'student' } }) }));

const built = LADDER.filter((s) => s.built);
const secure = (ids: string[]): FactStats[] => built.filter((s) => ids.includes(s.id)).flatMap((s) => s.keys.map((k) => ({ ...newStats(k), attempts: 3, correct: 3, box: 3 })));
const on = (over: Partial<NonNullable<MathsFocus['ladder']>> = {}): MathsFocus => ({
  ...AUTO_FOCUS,
  ladder: { on: true, placed: 'done', placement: 'facts-10', furthest: null, ...over },
});
const show = (focus: MathsFocus, facts: FactStats[] = []) => {
  vi.mocked(ladderData.fetchMyLadder).mockResolvedValue({ facts, settings: {}, focus });
  return render(
    <MemoryRouter>
      <MathsPathCard />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.mocked(ladderData.fetchMyLadder).mockReset();
  localStorage.clear();
});

describe('My maths path on the home page', () => {
  it('shows nothing when the class has not turned auto on', async () => {
    const { container } = show({ ...AUTO_FOCUS });
    await vi.waitFor(() => expect(ladderData.fetchMyLadder).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing, and does not break the home page, when it cannot load', async () => {
    vi.mocked(ladderData.fetchMyLadder).mockRejectedValue(new Error('down'));
    const { container } = render(
      <MemoryRouter>
        <MathsPathCard />
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(ladderData.fetchMyLadder).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows how many skills are secure, where they are, and no year levels', async () => {
    show(on(), secure(['facts-10', 'dbl-half-10', 'ten-and']));
    expect(await screen.findByRole('heading', { name: /My maths path/ })).toBeInTheDocument();
    expect(screen.getByText(`3 of ${built.length}`)).toBeInTheDocument();
    expect(screen.getByText(/skills secure/)).toBeInTheDocument();
    expect(screen.getByText(/You are here:/).parentElement).toHaveTextContent('Number facts to 20');
    expect(document.body.textContent).not.toMatch(/Year \d/);
  });

  it('opens into the whole path, with the tables inside the times-table skills', async () => {
    const user = userEvent.setup();
    show(on(), secure(['facts-10', 'dbl-half-10', 'ten-and', 'facts-20', 'dbl-half-20']));
    const open = await screen.findByRole('button', { name: 'See my whole path' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await user.click(open);
    expect(screen.getByRole('button', { name: 'Hide my whole path' })).toHaveAttribute('aria-expanded', 'true');
    const rows = screen.getAllByRole('listitem').filter((li) => li.classList.contains('ladder-path__row'));
    expect(rows).toHaveLength(built.length);
    const tables = rows.find((r) => r.textContent?.includes('Times tables: ×2, ×5, ×10'))!;
    expect(within(tables).getByText(/You are here/)).toBeInTheDocument();
    expect(within(tables).getByLabelText('Tables in this skill')).toHaveTextContent('×2');
    expect(within(tables).getByLabelText('Tables in this skill')).toHaveTextContent('×10');
    expect(within(rows[0]).getByText('Secure')).toBeInTheDocument();
  });

  it('marks tables inside a skill that are secure', async () => {
    const user = userEvent.setup();
    const two = built.find((s) => s.id === 'tables-2-5-10')!;
    const only2 = two.keys.filter((k) => /^mul:(\d+)x(\d+)$/.test(k) && k.startsWith('mul:2x')).map((k) => ({ ...newStats(k), attempts: 3, correct: 3, box: 3 }));
    show(on(), [...secure(['facts-10', 'dbl-half-10', 'ten-and', 'facts-20', 'dbl-half-20']), ...only2]);
    await user.click(await screen.findByRole('button', { name: 'See my whole path' }));
    const list = screen.getAllByLabelText('Tables in this skill')[0];
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('×2 secure');
    expect(items[1]).toHaveTextContent('×5 not yet');
  });

  it('while a teacher focus runs, still shows the place and marks the teacher’s pick', async () => {
    const user = userEvent.setup();
    show({ ...on(), source: 'teacher-class', skills: ['tables-6-9'], endsAt: '2099-01-01T00:00:00Z' }, secure(['facts-10']));
    expect(await screen.findByText(/Your teacher’s pick:/)).toHaveTextContent('×6, ×9');
    expect(screen.getByText(/You are here:/).parentElement).toHaveTextContent('Doubles and halves to 10');
    await user.click(screen.getByRole('button', { name: 'See my whole path' }));
    expect(screen.getAllByText(/Your teacher’s pick/).length).toBeGreaterThanOrEqual(2);
  });

  it('offers the warm-up until it is done or skipped, and then does not', async () => {
    const { unmount } = show(on({ placed: null, placement: null }));
    expect(await screen.findByRole('link', { name: 'Find my starting place' })).toHaveAttribute('href', '/placement');
    unmount();
    vi.mocked(ladderData.fetchMyLadder).mockResolvedValue({ facts: [], settings: {}, focus: on({ placed: 'skipped', placement: null }) });
    render(
      <MemoryRouter>
        <MathsPathCard />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: /My maths path/ });
    expect(screen.queryByRole('link', { name: 'Find my starting place' })).not.toBeInTheDocument();
  });

  it('starts from the placement, not the first skill', async () => {
    const user = userEvent.setup();
    show(on({ placed: 'done', placement: 'tables-3-4-8' }));
    expect(await screen.findByText(/You are here:/)).toBeInTheDocument();
    expect(screen.getByText(/You are here:/).parentElement).toHaveTextContent('Times tables: ×3, ×4, ×8');
    // Nothing is proven yet, so nothing is counted secure; the skills before it show as moved past.
    expect(screen.getByText(/skills secure/).parentElement).toHaveTextContent(`0 of ${built.length}`);
    await user.click(screen.getByRole('button', { name: 'See my whole path' }));
    expect(screen.getAllByText('Moved past')).toHaveLength(built.findIndex((s) => s.id === 'tables-3-4-8'));
  });

  it('says so when every skill is secure', async () => {
    show(on(), secure(built.map((s) => s.id)));
    expect(await screen.findByText(/every skill on the path secure/)).toBeInTheDocument();
  });

  describe('you moved up!', () => {
    it('says nothing the first time (it just remembers), and nothing when they have not moved', async () => {
      const { unmount } = show(on(), secure(['facts-10']));
      await screen.findByRole('heading', { name: /My maths path/ });
      expect(screen.queryByText(/You moved up/)).not.toBeInTheDocument();
      await vi.waitFor(() => expect(localStorage.getItem('maths-path-seen:student-1')).toBe('facts-10'));
      unmount();
      show(on(), secure(['facts-10']));
      await screen.findByRole('heading', { name: /My maths path/ });
      expect(screen.queryByText(/You moved up/)).not.toBeInTheDocument();
    });

    it('says it once they get a skill secure, and goes away when they tap Great', async () => {
      localStorage.setItem('maths-path-seen:student-1', 'facts-10');
      const user = userEvent.setup();
      show(on(), secure(['facts-10', 'dbl-half-10', 'ten-and', 'facts-20']));
      const message = await screen.findByRole('status');
      expect(message).toHaveTextContent('You moved up!');
      expect(message).toHaveTextContent('Doubles and halves to 10 and more');
      await user.click(screen.getByRole('button', { name: 'Great!' }));
      expect(screen.queryByText(/You moved up/)).not.toBeInTheDocument();
      expect(localStorage.getItem('maths-path-seen:student-1')).toBe('facts-10,dbl-half-10,ten-and,facts-20');
    });

    it('names a single skill', async () => {
      localStorage.setItem('maths-path-seen:student-1', 'facts-10');
      show(on(), secure(['facts-10', 'dbl-half-10']));
      expect(await screen.findByRole('status')).toHaveTextContent('Doubles and halves to 10 is secure now.');
    });

    it('is not shown for a jump to a new starting place, or for a place that only fell', async () => {
      localStorage.setItem('maths-path-seen:student-1', 'facts-10,dbl-half-10');
      show(on({ placed: 'done', placement: 'tables-3-4-8' }), secure(['facts-10']));
      await screen.findByRole('heading', { name: /My maths path/ });
      expect(screen.queryByText(/You moved up/)).not.toBeInTheDocument();
    });

    it('copes with a browser that will not store anything', async () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      show(on(), secure(['facts-10']));
      expect(await screen.findByRole('heading', { name: /My maths path/ })).toBeInTheDocument();
      spy.mockRestore();
    });
  });
});
