import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrashScreen } from './CrashScreen';

function Broken(): never {
  throw new Error('members[i] is undefined');
}

describe('CrashScreen', () => {
  it('shows the page when nothing is wrong', () => {
    render(<CrashScreen><p>All good</p></CrashScreen>);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a kind message, a way to carry on, and the error for the teacher, instead of a blank page', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CrashScreen><Broken /></CrashScreen>);
    quiet.mockRestore();
    expect(screen.getByRole('alert')).toHaveTextContent('Oops, something went wrong.');
    expect(screen.getByRole('button', { name: 'Carry on' })).toBeInTheDocument();
    expect(screen.getByText(/members\[i\] is undefined/)).toBeInTheDocument();
  });
});
