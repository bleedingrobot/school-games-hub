import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { GameDefinition } from '../games/types';
import { Activities } from './ActivitiesPage';

vi.mock('../data/classSwitches', () => ({ useClassSwitches: () => new Set(['on-one']) }));

const make = (id: string, teacherSwitch: boolean): GameDefinition => ({
  id,
  name: `Activity ${id}`,
  tagline: 'Practise a skill',
  colours: ['#123456', '#654321'],
  Icon: () => null,
  activity: true,
  teacherSwitch,
});

describe('Activities page', () => {
  it('shows activities that are on for the class with a Start button, and says so when none are', () => {
    render(
      <MemoryRouter>
        <Activities activities={[make('always', false), make('on-one', true), make('off-one', true)]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Start Activity always' })).toHaveAttribute('href', '/always');
    expect(screen.getByRole('link', { name: 'Start Activity on-one' })).toBeInTheDocument();
    expect(screen.queryByText('Activity off-one')).not.toBeInTheDocument();
    cleanup();
    render(
      <MemoryRouter>
        <Activities activities={[make('off-one', true)]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('No activities are on for your class yet.')).toBeInTheDocument();
  });
});
