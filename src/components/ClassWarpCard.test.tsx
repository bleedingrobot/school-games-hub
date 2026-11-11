import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as classes from '../data/classes';
import { ClassWarpCard } from './ClassWarpCard';

vi.mock('../data/classes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classes')>()),
  fetchMyClass: vi.fn(),
}));

function show() {
  return render(
    <MemoryRouter>
      <ClassWarpCard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(classes.fetchMyClass).mockResolvedValue({ className: null, groupName: null, waitingFor: null });
});

describe('the "Join your class" step on the home page', () => {
  it('shows for a student with no class, and links to Class Warp', async () => {
    show();
    expect(await screen.findByRole('link', { name: 'Join' })).toHaveAttribute('href', '/warp');
  });

});
