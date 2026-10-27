import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as classes from '../data/classes';
import * as space from '../data/spaceGames';
import * as teacher from '../data/teacher';
import { MathsSwitchPanel } from '../pages/Teacher';
import { TeacherClassPicker, TeacherClassProvider, useTeacherClass } from './TeacherClass';

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

describe('the class switcher in the teacher header', () => {
  it('lets a teacher with several classes pick one, and the switches follow it', async () => {
    const user = userEvent.setup();
    show();
    const picker = await screen.findByRole('combobox', { name: 'Class' });
    expect(picker).toHaveValue('c12');
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeChecked();
    expect(space.fetchMathsSwitch).toHaveBeenLastCalledWith('c12');
    vi.mocked(space.fetchMathsSwitch).mockResolvedValue('on');
    await user.selectOptions(picker, 'c14');
    expect(space.fetchMathsSwitch).toHaveBeenLastCalledWith('c14');
    expect(await screen.findByRole('radio', { name: /On for everyone/ })).toBeChecked();
  });

  it('changes only the picked class', async () => {
    const user = userEvent.setup();
    show();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Class' }), 'c14');
    await user.click(await screen.findByRole('radio', { name: /^Off/ }));
    expect(teacher.setSpaceMaths).toHaveBeenCalledWith('off', 'c14');
  });

  it('does not read or change any switch before it knows which class', async () => {
    let finish!: (list: classes.ClassSummary[]) => void;
    vi.mocked(classes.fetchClasses).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    show();
    await Promise.resolve();
    expect(space.fetchMathsSwitch).not.toHaveBeenCalled();
    finish([room('c12', 'Room 12')]);
    await screen.findByRole('radio', { name: /Students choose/ });
    expect(space.fetchMathsSwitch).toHaveBeenCalledWith('c12');
  });

  it('remembers the pick for the visit', async () => {
    const user = userEvent.setup();
    const { unmount } = show();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Class' }), 'c14');
    unmount();
    show();
    expect(await screen.findByRole('combobox', { name: 'Class' })).toHaveValue('c14');
  });

  it('forgets a remembered class that is no longer in the list', async () => {
    sessionStorage.setItem('sgh-teacher-class', 'gone');
    show();
    expect(await screen.findByRole('combobox', { name: 'Class' })).toHaveValue('c12');
  });

  it('puts the classes I teach first, and marks the rest', async () => {
    vi.mocked(classes.fetchClasses).mockResolvedValue([room('c1', 'Admin sees this', false), room('c12', 'Room 12')]);
    show();
    const picker = await screen.findByRole('combobox', { name: 'Class' });
    expect(picker).toHaveValue('c12');
    expect([...picker.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Room 12', 'Admin sees this (not mine)']);
  });

  it('offers no dropdown when there is one class (the header names it)', async () => {
    vi.mocked(classes.fetchClasses).mockResolvedValue([room('c12', 'Room 12')]);
    show();
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    // The switch panel asks once it knows the class, which can be just after the name shows.
    await waitFor(() => expect(space.fetchMathsSwitch).toHaveBeenCalledWith('c12'));
  });

  it('leaves the switches as they always were for a teacher with no class (the shell asks them to make one)', async () => {
    vi.mocked(classes.fetchClasses).mockResolvedValue([]);
    show();
    await waitFor(() => expect(space.fetchMathsSwitch).toHaveBeenCalledWith(null));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('gives the switches no class at all when there is no picker (the way they always worked)', async () => {
    function Probe() {
      const { classId, ready } = useTeacherClass();
      return <p>{ready ? `ready:${classId}` : 'waiting'}</p>;
    }
    render(<Probe />);
    expect(screen.getByText('ready:null')).toBeInTheDocument();
  });
});
