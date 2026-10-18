import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { QUESTS, buildPuzzle, questById, todaysQuest, type QuestDef } from '../../../shared/clans/quests';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion, type YearBand } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import { questPuzzle } from './places';
import { makeClan, newSession, startingDrafts, type Session } from './session';

const SEED = 12345;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

function session(change: (s: Session) => void = () => {}): Session {
  const s = newSession(makeClan('Test Clan', startingDrafts(SEED)), SEED);
  change(s);
  return s;
}
const show = (s: Session) => render(<ClanQuest seed={SEED} initial={s} />);
const picked = (id: number, change: (s: Session) => void = () => {}) => session((s) => { s.questPick = id; change(s); });
const charming = (s: Session, value = 20) => { s.clan.members[0].stats.charisma = value; };

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}
const wrongFor = (q: PracticalQuestion) => (q.choices ? q.choices.find((c) => c.value !== q.answer)!.value : q.answer + 7);

/** Read the story to the end. */
async function readOn(u: ReturnType<typeof user>, q: QuestDef) {
  for (let i = 1; i < q.story.length; i++) await u.click(btn('Read on'));
}
const choiceButton = (i: number) => screen.getByRole('button', { name: new RegExp(`^${'ABC'[i]} `) });

/** Take one route through a quest by clicking. Returns what was on screen at the end. */
async function takeRoute(q: QuestDef, choice: number, right: boolean | null, change: (s: Session) => void = () => {}) {
  const u = user();
  const s = picked(q.id, (x) => { charming(x); change(x); });
  show(s);
  await u.click(btn('Quest'));
  await readOn(u, q);
  await u.click(choiceButton(choice));
  if (right !== null) {
    const puzzle = buildPuzzle(questPuzzle(s, q, choice)!);
    await answer(u, puzzle, right ? puzzle.answer : wrongFor(puzzle));
    if (!right) expect(screen.getByText(/Here is how it works/)).toBeTruthy();
    await u.click(btn('See what happens'));
  }
  return u;
}

describe('the Quest screen', () => {
  it('shows the story one paragraph at a time, then the choices, then a plain result', async () => {
    const u = user();
    const q = questById(6)!;
    show(picked(6, charming));
    await u.click(btn('Quest'));
    expect(screen.getByText(q.story[0])).toBeTruthy();
    expect(screen.queryByText(q.story[1])).toBeNull();
    expect(screen.queryByRole('button', { name: /^A / })).toBeNull();
    await u.click(btn('Read on'));
    expect(screen.getByText(q.story[1])).toBeTruthy();
    await u.click(choiceButton(0));
    expect(screen.getByText(q.choices[0].win.text)).toBeTruthy();
    expect(screen.getByText(/You got: /)).toBeTruthy();
    await u.click(btn('Carry on'));
    expect(btn('Quest (done for today)')).toBeTruthy();
  });

  it('can be finished by every route, with the prize on the clan and the day used up', async () => {
    for (const q of QUESTS) {
      for (let i = 0; i < q.choices.length; i++) {
        for (const right of q.choices[i].puzzle ? [true, false] : [null]) {
          const { unmount } = render(<div />);
          unmount();
          const u = await takeRoute(q, i, right);
          const outcome = right === false ? (q.choices[i].lose ?? q.choices[i].win) : q.choices[i].win;
          expect(screen.getByText(new RegExp(outcome.text.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))), `${q.title} ${i} ${right}`).toBeTruthy();
          expect(screen.getByText(/You got: /)).toBeTruthy();
          await u.click(btn('Carry on'));
          expect(btn('Quest (done for today)')).toBeTruthy();
          document.body.innerHTML = '';
        }
      }
    }
  }, 120000);

  it('says kindly that the quest is done, and cannot be done twice; a new day brings a new one', async () => {
    const u = user();
    show(session((s) => { s.clan.questDay = s.day; }));
    await u.click(btn('Quest (done for today)'));
    expect(screen.getByText(/already done its quest today/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^A / })).toBeNull();
    await u.click(btn('Back to the clan'));
    await u.click(btn('Skip a day'));
    expect(btn('Quest')).toBeTruthy();
    await u.click(btn('Quest'));
    expect(screen.queryByText(/already done its quest today/)).toBeNull();
    expect(screen.getByRole('heading', { name: todaysQuest(SEED, 2, DEFAULT_PRACTICAL_SETTINGS)!.title })).toBeTruthy();
  });

  it('can be allowed again with the test button', async () => {
    const u = user();
    show(session((s) => { s.clan.questDay = s.day; }));
    await u.click(btn('Allow another quest today (test only)'));
    await u.click(btn('Quest'));
    expect(screen.queryByText(/already done its quest today/)).toBeNull();
  });

  it('lets James try a quest by number', async () => {
    const u = user();
    show(session());
    await u.selectOptions(screen.getByLabelText('Try quest number'), '4');
    await u.click(btn('Quest'));
    expect(screen.getByRole('heading', { name: questById(4)!.title })).toBeTruthy();
  });

  it('greys a charm choice with the reason, and does nothing when it is pressed', async () => {
    const u = user();
    const q = questById(6)!;
    show(picked(6, (s) => s.clan.members.forEach((m) => { m.stats.charisma = 1; })));
    await u.click(btn('Quest'));
    await readOn(u, q);
    const locked = choiceButton(2);
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/needs a charming member/)).toBeTruthy();
    expect(locked.getAttribute('aria-describedby')).toBeTruthy();
    await u.click(locked);
    expect(screen.queryByText(/You got: /)).toBeNull();
    await u.keyboard('c');
    expect(screen.queryByText(/You got: /)).toBeNull();
    await u.click(choiceButton(0));
    expect(screen.getByText(/You got: /)).toBeTruthy();
  });

  it('opens the charm choice once the clan is charming enough', async () => {
    const u = user();
    const q = questById(6)!;
    show(picked(6, charming));
    await u.click(btn('Quest'));
    await readOn(u, q);
    expect(choiceButton(2).getAttribute('aria-disabled')).toBeNull();
    await u.click(choiceButton(2));
    expect(screen.getByText(q.choices[2].win.text)).toBeTruthy();
  });

  it('works with the keyboard only: letters pick, digits answer', async () => {
    const u = user();
    const q = questById(2)!;
    const s = picked(2);
    show(s);
    await u.click(btn('Quest'));
    await u.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /^A / })).toBeTruthy();
    await u.keyboard('a');
    const puzzle = buildPuzzle(questPuzzle(s, q, 0)!);
    await u.keyboard(String(puzzle.answer));
    await u.keyboard('{Enter}');
    expect(screen.getByText('Right! Well done.')).toBeTruthy();
    await u.keyboard('{Enter}');
    expect(screen.getByText(q.choices[0].win.text)).toBeTruthy();
    expect(s.clan.gold).toBeLessThan(10000);
  });

  it('puts a right and a wrong puzzle answer on the screen and carries on both ways', async () => {
    const q = questById(10)!;
    await takeRoute(q, 0, true);
    expect(screen.getByText(/You solved the puzzle/)).toBeTruthy();
    document.body.innerHTML = '';
    await takeRoute(q, 0, false);
    expect(screen.getByText(/did not quite work out, but the story carries on/)).toBeTruthy();
    expect(screen.getByText(/You got: /)).toBeTruthy();
  });

  it('adds the prize to the clan: gold shows in the header', async () => {
    const u = user();
    show(picked(1, charming));
    const before = Number(screen.getByText(/gold ·/).textContent!.match(/(\d+) gold/)![1]);
    await u.click(btn('Quest'));
    await readOn(u, questById(1)!);
    await u.click(choiceButton(0));
    const got = Number(screen.getByText(/You got: /).textContent!.match(/(\d+) gold/)![1]);
    expect(Number(screen.getByText(/gold ·/).textContent!.match(/(\d+) gold/)![1])).toBe(before + got);
  });

  it('keeps the below-zero quest for Year 6 with the topic on', async () => {
    const u = user();
    const y6 = (year: YearBand, integers: boolean) => (s: Session) => { s.settings = { ...s.settings, yearBand: year, enabledTopics: integers ? [...s.settings.enabledTopics, 'integers'] : s.settings.enabledTopics.filter((t) => t !== 'integers') }; };
    // Picking the quest by number for testing shows it, but today's quest is never it for other years.
    for (let day = 1; day <= 10; day++) expect(todaysQuest(SEED, day, { ...DEFAULT_PRACTICAL_SETTINGS, yearBand: 5 })!.id).not.toBe(5);
    const s = picked(5, (x) => { y6(6, true)(x); charming(x); });
    show(s);
    await u.click(btn('Quest'));
    await readOn(u, questById(5)!);
    await u.click(choiceButton(0));
    const puzzle = buildPuzzle(questPuzzle(s, questById(5)!, 0)!);
    expect(puzzle.answer).toBeLessThan(0);
    expect(screen.getAllByText(/degrees/).length).toBeGreaterThan(0);
    await u.keyboard('-');
    await u.keyboard(String(-puzzle.answer));
    await u.keyboard('{Enter}');
    expect(screen.getByText('Right! Well done.')).toBeTruthy();
  });
});
