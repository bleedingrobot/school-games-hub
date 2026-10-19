import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { cryQuestion } from '../../../shared/clans/battleCry';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { nextSeed, newSession, makeClan, startingDrafts, draftMember, MAX_ROLLS, rollAgain, headline } from './session';
import { ClanQuest } from './ClanQuest';

const SEED = 12345;
const user = () => userEvent.setup();

async function makeClanOnScreen(u: ReturnType<typeof user>) {
  render(<ClanQuest seed={SEED} />);
  await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
}

/** The first Battle Cry question the first fight will ask (the seed is fixed, so we can work it out). */
function firstQuestion(): PracticalQuestion {
  const session = newSession(makeClan('X', startingDrafts(SEED)), SEED);
  return cryQuestion(nextSeed(session), 1, DEFAULT_PRACTICAL_SETTINGS)!;
}

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}

async function intoFight(u: ReturnType<typeof user>) {
  await u.click(screen.getByRole('button', { name: 'Go to the Mines' }));
  await u.click(screen.getByRole('button', { name: 'Into the Mines!' }));
}

/** Click through a whole fight with the default action. */
async function playOut(u: ReturnType<typeof user>) {
  for (let i = 0; i < 120; i++) {
    const done = screen.queryByRole('button', { name: 'See how everyone did' });
    if (done) return done;
    const no = screen.queryByRole('button', { name: 'No thanks' });
    if (no) await u.click(no);
    else if (screen.queryByRole('button', { name: 'Carry on' })) await u.click(screen.getByRole('button', { name: 'Carry on' }));
    else await u.click(screen.getByRole('button', { name: /Default action/ }));
  }
  throw new Error('The fight never ended');
}

describe('the clan creator', () => {
  it('shows four members with only the short stats until "More details" is pressed', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} />);
    expect(screen.getAllByRole('article')).toHaveLength(4);
    const card = screen.getAllByRole('article')[0];
    expect(within(card).getByText('Attack')).toBeInTheDocument();
    expect(within(card).queryByText('Dexterity')).not.toBeInTheDocument();
    await u.click(within(card).getByRole('button', { name: 'More details' }));
    expect(within(card).getByText('Dexterity')).toBeInTheDocument();
  });

  it('allows three rolls and then stops', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} />);
    const card = screen.getAllByRole('article')[1];
    const roll = within(card).getByRole('button', { name: /Roll again/ });
    for (let i = 0; i < MAX_ROLLS; i++) await u.click(roll);
    expect(roll).toBeDisabled();
    expect(roll).toHaveTextContent('0 left');
  });

  it('makes a clan from the picks and goes to the clan page', async () => {
    const u = user();
    await makeClanOnScreen(u);
    expect(screen.getByRole('heading', { name: /Red|Silver|Brave|Golden|Swift|Jolly|Mighty|Clever|Misty|Bold|Lucky|Iron/ })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getByText(/Practising: /)).toBeInTheDocument();
    // no accuracy figures anywhere
    expect(screen.queryByText(/%|accuracy/i)).not.toBeInTheDocument();
  });

  it('rolls the same member for the same slot and roll number, and a re-roll can differ', () => {
    const d = startingDrafts(SEED)[2];
    expect(draftMember(d, 2)).toEqual(draftMember({ ...d }, 2));
    const rolled = [0, 1, 2, 3].map((n) => JSON.stringify(headline(draftMember({ ...d, rolls: n }, 2))));
    expect(new Set(rolled).size).toBeGreaterThan(1);
    expect(rollAgain({ ...d, rolls: MAX_ROLLS }).rolls).toBe(MAX_ROLLS);
  });
});

describe('a fight', () => {
  it('can be won with no maths at all, and shows the results', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await intoFight(u);
    expect(screen.getByText(/Fights today: 8 of 8/)).toBeInTheDocument();
    const done = await playOut(u);
    expect(screen.getByText(/enemies are beaten/)).toBeInTheDocument();
    await u.click(done);
    expect(screen.getByRole('heading', { name: 'Victory!' })).toBeInTheDocument();
    expect(screen.getAllByText(/experience/)).toHaveLength(4);
    await u.click(screen.getByRole('button', { name: 'Back to the clan' }));
    expect(screen.getByRole('heading', { name: /Red|Silver|Brave|Golden|Swift|Jolly|Mighty|Clever|Misty|Bold|Lucky|Iron/ })).toBeInTheDocument();
    // one fight used
    await u.click(screen.getByRole('button', { name: 'Go to the Mines' }));
    expect(screen.getByText('7 of 8')).toBeInTheDocument();
  });

  it('keeps going round after round when scrollIntoView gives back a promise (newer Chrome did, and the page went blank)', async () => {
    const had = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = function () {
      return Promise.resolve() as unknown as void;
    };
    try {
      const u = user();
      await makeClanOnScreen(u);
      await intoFight(u);
      await playOut(u);
      expect(screen.getByText(/enemies are beaten/)).toBeInTheDocument();
    } finally {
      if (had) Object.defineProperty(Element.prototype, 'scrollIntoView', had);
      else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('a right Battle Cry answer lets you pick damage or healing, with the key too', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await intoFight(u);
    const q = firstQuestion();
    expect(screen.getByText(q.text)).toBeInTheDocument();
    await answer(u, q, q.answer);
    expect(screen.getByText(/Right! Spend your Battle Cry on/)).toBeInTheDocument();
    await u.keyboard('d');
    expect(screen.getByText(/what will they do\?/)).toBeInTheDocument();
  });

  it('a wrong Battle Cry answer shows the working and carries on, with nothing lost', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await intoFight(u);
    const q = firstQuestion();
    const wrong = q.choices ? q.choices.find((c) => c.value !== q.answer)!.value : q.answer + 7;
    await answer(u, q, wrong);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(q.working[0])).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Carry on' }));
    expect(screen.getByText(/what will they do\?/)).toBeInTheDocument();
  });

  it('"No thanks" skips the question and still shows how it works', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await intoFight(u);
    await u.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(screen.getByText(/No problem/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Carry on' }));
    expect(screen.getByText(/what will they do\?/)).toBeInTheDocument();
  });

  it('can be played with the keyboard alone', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} />);
    // the maths off, so only fight keys are needed
    await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
    for (const box of screen.getAllByRole('checkbox')) if ((box as HTMLInputElement).checked) await u.click(box);
    await intoFight(u);
    // from here: keys only. Enter = default action for each member; a, then 1 = attack the first enemy.
    for (let i = 0; i < 60 && !screen.queryByRole('button', { name: 'See how everyone did' }); i++) {
      await u.keyboard(i % 3 === 0 ? 'a' : '{Enter}');
      if (screen.queryByText(/Which enemy|attack…/)) await u.keyboard('1');
    }
    expect(screen.getByRole('button', { name: 'See how everyone did' })).toBeInTheDocument();
  });

  it('the Mines show a hint, and deeper is flagged as harder', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await u.click(screen.getByRole('button', { name: 'Go to the Mines' }));
    expect(screen.getByText('Too easy')).toBeInTheDocument();
    for (let i = 0; i < 8; i++) await u.click(screen.getByRole('button', { name: 'Go deeper' }));
    expect(screen.getByText('Too hard')).toBeInTheDocument();
  });

  it('"Skip a day" brings the fights back', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await intoFight(u);
    await u.click(await playOut(u));
    await u.click(screen.getByRole('button', { name: 'Back to the clan' }));
    await u.click(screen.getByRole('button', { name: 'Skip a day' }));
    expect(screen.getByText('Day 2')).toBeInTheDocument();
  });
});
