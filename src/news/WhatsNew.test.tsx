import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HUB_NEWS, newsToShow, type NewsItem } from './hubNews';
import { WhatsNew } from './WhatsNew';

const news: NewsItem[] = [
  { id: 'old', date: '2026-10-01', emoji: '1', title: 'Old', text: 'x' },
  { id: 'chess', date: '2026-11-18', emoji: '2', title: 'Chess', text: 'x', game: 'chess' },
  { id: 'all', date: '2026-11-17', emoji: '3', title: 'All', text: 'x' },
  { id: 'later', date: '2026-11-30', emoji: '4', title: 'Later', text: 'x' },
];

describe('newsToShow', () => {
  it('keeps recent lines for games the class can see, newest first', () => {
    expect(newsToShow('2026-11-18', () => true, news).map((n) => n.id)).toEqual(['chess', 'all']);
    expect(newsToShow('2026-11-18', () => false, news).map((n) => n.id)).toEqual(['all']);
  });

  it('every real line has a unique id, a YYYY-MM-DD date and short words', () => {
    expect(new Set(HUB_NEWS.map((n) => n.id)).size).toBe(HUB_NEWS.length);
    for (const n of HUB_NEWS) {
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.text.length).toBeLessThanOrEqual(90);
    }
  });
});

describe('WhatsNew', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows new lines, and ✕ hides them on this device', () => {
    const view = () => (
      <MemoryRouter>
        <WhatsNew me="p1" today="2026-11-18" canSee={() => true} />
      </MemoryRouter>
    );
    const { unmount } = render(view());
    expect(screen.getByRole('heading', { name: /what’s new/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('heading', { name: /what’s new/i })).toBeNull();
    unmount();
    render(view());
    expect(screen.queryByRole('heading', { name: /what’s new/i })).toBeNull();
  });
});
