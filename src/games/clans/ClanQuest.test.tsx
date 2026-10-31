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

// The fight loops look for buttons by their words with a plain look-up: asking by role is slow on the fight page, and a
// fight is dozens of steps, which made the look-ups most of each fight's time.
const button = (name: string | RegExp) =>
  [...document.querySelectorAll('button')].find((b) => {
    const label = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
    return typeof name === 'string' ? label === name : name.test(label);
  });

/** Click through a whole fight with the suggested plan. */
async function playOut(u: ReturnType<typeof user>) {
  for (let i = 0; i < 120; i++) {
    const done = button('See how everyone did');
    if (done) return done;
    const next = button('No thanks') ?? button('Carry on') ?? button(/Skip\s*Show the whole round/) ?? button(/Next round/) ?? button(/Fight with this plan/);
    if (!next) throw new Error('No button to press in the fight');
    await u.click(next);
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
    // The clan's best hit, and (the first fight of the day) a new best, remembered on this device.
    expect(screen.getByText(/^Best hit: .+ for \d+\./)).toBeInTheDocument();
    expect(screen.getByText('★ Your best hit today!')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('clans-best-hit')!).amount).toBeGreaterThan(0);
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
    expect(screen.getByText('The plan for this round')).toBeInTheDocument();
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
    expect(screen.getByText('The plan for this round')).toBeInTheDocument();
  });

  it('"No thanks" skips the question and still shows how it works', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await intoFight(u);
    await u.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(screen.getByText(/No problem/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Carry on' }));
    expect(screen.getByText('The plan for this round')).toBeInTheDocument();
  });

  it('can be played with the keyboard alone', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} />);
    // the maths off, so only fight keys are needed
    await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
    for (const box of screen.getAllByRole('checkbox')) if ((box as HTMLInputElement).checked) await u.click(box);
    await intoFight(u);
    // from here: keys only. Every other round: 1 to change the first member, a to attack (then 1 for the first enemy
    // if asked); Enter fights with the plan.
    for (let i = 0; i < 60 && !button('See how everyone did'); i++) {
      if (i % 2 === 0) {
        await u.keyboard('1');
        await u.keyboard('a');
        if (screen.queryByText(/attack…/)) await u.keyboard('1');
      }
      await u.keyboard('{Enter}');
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

describe('the place paintings (Clans art Stage A.4)', () => {
  const sceneShown = () => document.querySelector<HTMLImageElement>('.cq-scene')?.dataset.scene;

  it('the creator, then each place, shows its own painting, hidden from screen readers', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} />);
    expect(sceneShown()).toBe('creator');
    await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
    expect(sceneShown()).toBe('village');
    expect(document.querySelector('.cq-scene')?.getAttribute('alt')).toBe('');
    for (const [place, scene] of [['The Market', 'market'], ['The Training Hall', 'training'], ['The Church', 'church'], ['Scoreboard', 'scoreboard']]) {
      await u.click(screen.getByRole('button', { name: place }));
      expect(sceneShown(), place).toBe(scene);
      await u.click(screen.getByRole('button', { name: /^Back/ }));
    }
  });

  it('a fight keeps to one screen: no painting across the top (Stage A.6)', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await intoFight(u);
    expect(sceneShown()).toBeUndefined();
  });
});

describe('the fight, painted (Clans art Stage A.6)', () => {
  it('shows each monster and member painted, the mine zone behind the monsters, and a painting for how it went', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await intoFight(u);
    const enemies = screen.getByRole('list', { name: 'Enemies' });
    const monsters = enemies.querySelectorAll('img.cq-monster-art');
    expect(monsters.length).toBe(within(enemies).getAllByRole('listitem').length);
    for (const m of monsters) expect(m.getAttribute('src')).toMatch(/\/monsters\//);
    expect(enemies.dataset.zone).toBe('Meadow');
    expect(enemies.style.getPropertyValue('--cq-zone')).toMatch(/zone-meadow/);
    const clan = screen.getByRole('list', { name: 'Your clan' });
    expect(clan.querySelectorAll('.cq-portrait--painted img')).toHaveLength(4);
    await u.click((await playOut(u))!);
    expect(['victory', 'rest', 'mines']).toContain(document.querySelector<HTMLImageElement>('.cq-scene')?.dataset.scene);
  });
});

describe('picking a look in the creator (Clans art Stage A.5)', () => {
  it('each member shows the four looks; the pick changes the portrait and goes with the clan', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} />);
    const first = screen.getAllByRole('article')[0];
    const picker = within(first).getByRole('group', { name: 'Look' });
    expect(within(picker).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Girl 1', 'Girl 2', 'Boy 1', 'Boy 2']);
    await u.click(within(picker).getByRole('button', { name: 'Girl 2' }));
    expect(within(picker).getByRole('button', { name: 'Girl 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(first.querySelector('.cq-portrait--painted img')?.getAttribute('src')).toContain('female-2');
    await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
    expect(screen.getAllByRole('article')[0].querySelector('.cq-portrait--painted img')?.getAttribute('src')).toContain('female-2');
  });
});

describe('items and quests (Clans art Stage A.7)', () => {
  it('the Market shelf shows each item painted, and the quest shows its own painting', async () => {
    const u = user();
    await makeClanOnScreen(u);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    const shelf = screen.getByRole('list', { name: 'On the shelf' });
    const items = within(shelf).getAllByRole('button');
    expect(items.length).toBeGreaterThan(0);
    for (const b of items) expect(b.querySelector('img.cq-item-art')?.getAttribute('src')).toMatch(/\/items\//);
    await u.click(screen.getByRole('button', { name: /^Back/ }));
    await u.click(screen.getByRole('button', { name: /^Quest/ }));
    expect(document.querySelector<HTMLImageElement>('.cq-scene')?.dataset.scene).toMatch(/^quest-\d+$/);
    expect(document.querySelector('.cq-scene')?.getAttribute('src')).toMatch(/\/quests\//);
  });
});

describe('clan banners (Clans art Stage A.8)', () => {
  it('the clan home shows the banner that matches the second word of the clan name, and so does the Scoreboard', async () => {
    const u = user();
    await makeClanOnScreen(u);
    const name = screen.getByRole('heading', { level: 2 }).textContent!;
    const noun = name.split(' ').pop()!.toLowerCase();
    expect(document.querySelector('.cq-clanbanner')?.getAttribute('src')).toContain(`/banners/${noun}`);
    await u.click(screen.getByRole('button', { name: 'Scoreboard' }));
    const mine = screen.getByRole('rowheader', { name: new RegExp(name) });
    expect(mine.querySelector('img.cq-rowbanner')?.getAttribute('src')).toContain(`/banners/${noun}`);
  });
});

describe('made-up hero names', () => {
  it('only offers them when the teacher has switched them on', () => {
    render(<ClanQuest seed={SEED} />);
    expect(screen.queryByRole('button', { name: 'Make up my own name' })).toBeNull();
  });

  it('keeps the list as the default, takes a typed name, and holds back a rude or repeated one', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} typedNames />);
    const start = screen.getByRole('button', { name: 'Start the adventure' });
    expect(screen.getAllByRole('combobox', { name: 'Name' })).toHaveLength(4);
    await u.click(screen.getAllByRole('button', { name: 'Make up my own name' })[0]);
    const box = screen.getByRole('textbox', { name: 'Name' });
    expect(start).toBeDisabled();
    await u.type(box, 'poop');
    expect(screen.getByText('Please pick a kinder name.')).toBeInTheDocument();
    expect(start).toBeDisabled();
    await u.clear(box);
    await u.type(box, startingDrafts(SEED)[1].name.toLowerCase());
    expect(screen.getByText('Another member has this name.')).toBeInTheDocument();
    await u.clear(box);
    await u.type(box, 'te ahi');
    expect(start).toBeEnabled();
    await u.click(start);
    expect(await screen.findByText(/Te Ahi/)).toBeInTheDocument();
  });

  it("keeps the member's look while a name is typed", async () => {
    const u = user();
    render(<ClanQuest seed={SEED} typedNames />);
    const looks = () => screen.getAllByRole('group', { name: 'Look' })[1];
    const shown = () => within(looks()).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')!.getAttribute('aria-label');
    const before = shown();
    await u.click(screen.getAllByRole('button', { name: 'Make up my own name' })[1]);
    for (const letter of 'kaia') {
      await u.type(screen.getByRole('textbox', { name: 'Name' }), letter);
      expect(shown()).toBe(before);
    }
  });

  it('can go back to the list', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} typedNames />);
    await u.click(screen.getAllByRole('button', { name: 'Make up my own name' })[2]);
    await u.click(screen.getByRole('button', { name: 'Pick from the list instead' }));
    expect(screen.getAllByRole('combobox', { name: 'Name' })).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Start the adventure' })).toBeEnabled();
  });
});
