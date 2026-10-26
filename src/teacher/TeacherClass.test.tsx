import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as classes from '../data/classes';
import * as space from '../data/spaceGames';
import * as teacher from '../data/teacher';
import { MathsSwitchPanel } from '../pages/Teacher';
import { TeacherClassPicker, TeacherClassProvider } from './TeacherClass';

vi.mock('../data/classes', async (importOriginal) => ({ ...(await importOriginal<typeof import('../data/classes')>()), fetchClasses: vi.fn() }));
vi.mock('../data/spaceGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/spaceGames')>()),
  fetchMathsSwitch: vi.fn(),
}));
vi.mock('../data/teacher', async (importOriginal) => ({ ...(await importOriginal<typeof import('../data/teacher')>()), setSpaceMaths: vi.fn() }));

const room = (id: string, name: string, teaching = true): classes.ClassSummary => ({
  id, name, school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'on', members: 2, teaching, groups: 0, waiting: 0,
});

function show(ui = <MathsSwitchPanel />) {
  return render(
    <MemoryRouter>
      <TeacherClassProvider>
        <TeacherClassPicker />
        {ui}
      </TeacherClassProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(classes.fetchClasses).mockResolvedValue([room('c12', 'Room 12'), room('c14', 'Room 14')]);
  vi.mocked(space.fetchMathsSwitch).mockReset();
  vi.mocked(space.fetchMathsSwitch).mockResolvedValue('choose');
  vi.mocked(teacher.setSpaceMaths).mockReset();
  vi.mocked(teacher.setSpaceMaths).mockResolvedValue();
});

describe('the class picker on the Teacher page', () => {
  it('lets a teacher with several classes pick one, and the switches follow it and change only that class', async () => {
    const user = userEvent.setup();
    show();
    const picker = await screen.findByRole('combobox', { name: /Switches below are for the class/ });
    expect(picker).toHaveValue('c12');
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeChecked();
    expect(space.fetchMathsSwitch).toHaveBeenLastCalledWith('c12');
    vi.mocked(space.fetchMathsSwitch).mockResolvedValue('on');
    await user.selectOptions(picker, 'c14');
    expect(space.fetchMathsSwitch).toHaveBeenLastCalledWith('c14');
    expect(await screen.findByRole('radio', { name: /On for everyone/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /^Off/ }));
    expect(teacher.setSpaceMaths).toHaveBeenCalledWith('off', 'c14');
  });
});
