import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, type ServerState } from '../../../shared/clans/actions';
import { CONFIG } from '../../../shared/clans/config';
import { empireOf, kingdomById, lootGold } from '../../../shared/clans/empire';
import { startingDrafts } from '../../../shared/clans/create';
import { lootShare } from '../../../shared/clans/moments';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { publicState } from '../../../supabase/functions/clans/handler';
import { ClanQuest } from './ClanQuest';
import { armyToLose, armyToWin, barracksAndFill } from './places';
import type { ClanServer, ServerReply } from './remote';
import { makeClan, newSession, type Session } from './session';

afterEach(cleanup);
const SEED = 12345;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

function session(change: (s: Session) => void = () => {}): Session {
  const s = newSession(makeClan('Test Clan', startingDrafts(SEED)), SEED);
  change(s);
  return s;
}
const show = (s: Session) => render(<ClanQuest seed={SEED} initial={s} />);

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}
const wrongFor = (q: PracticalQuestion) => (q.choices ? q.choices.find((c) => c.value !== q.answer)!.value : q.answer + 7);
const toRaid = async (u: ReturnType<typeof user>) => { await u.click(btn('My Village')); await u.click(btn('Raid a kingdom / Practice battle')); };
const toClassRaid = async (u: ReturnType<typeof user>) => { await u.click(btn('My Village')); await u.click(btn('Raid a classmate')); };

describe('Raid a kingdom', () => {
  const winning = (s: Session) => { Object.assign(s, armyToWin(s)); };

  it('the plan is one choice: Careful, Steady or Bold, each with a short line. No rounds, no loot pickers', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    const how = within(screen.getByRole('group', { name: 'How hard' }));
    expect(how.getAllByRole('button').map((b) => b.textContent)).toEqual(['Careful', 'Steady', 'Bold']);
    expect(how.getByRole('button', { name: 'Steady' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/^Steady: /)).toBeInTheDocument();
    await u.click(how.getByRole('button', { name: 'Bold' }));
    expect(screen.getByText(/^Bold: Your troops hit harder, but more of them are hurt\./)).toBeInTheDocument();
    await u.click(how.getByRole('button', { name: 'Careful' }));
    expect(screen.getByText(/^Careful: Your troops hit softer, but fewer of them are hurt\./)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Rounds' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Loot' })).toBeNull();
    expect(screen.getByText(new RegExp(`${CONFIG.empire.battle.rounds} rounds`))).toBeInTheDocument();
  });

  it('a won raid: the loot answer equals what lands in the purse', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    await u.click(btn(/Raid Bunny Hollow/));
    const q = lootShare(S, kingdomById('bunny-hollow')!.treasury, CONFIG.empire.battle.loot)!;
    expect(q.answer).toBe(lootGold(300, 10));
    await answer(u, q, q.answer);
    await u.click(btn('Send the army!'));
    expect(screen.getByText(/The defenders give way!/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`You won ${q.answer} gold of loot. It is in your purse.`);
    await u.click(btn('Carry on'));
    await u.click(btn('Back to My Village'));
    expect(screen.getByText(/Clan purse/).closest('p')!).toHaveTextContent(`Clan purse: ${CONFIG.startGold + q.answer} gold`);
  });

  it('a wrong loot answer still gives the right loot', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    await u.click(btn(/Raid Bunny Hollow/));
    await answer(u, lootShare(S, 300, 10)!, wrongFor(lootShare(S, 300, 10)!));
    await u.click(btn('Send the army!'));
    expect(screen.getByRole('status')).toHaveTextContent('You won 30 gold');
  });

  it('a lost raid wins nothing and shows the troops that did not come home', async () => {
    const u = user();
    show(session((s) => { Object.assign(s, armyToLose(s)); }));
    await toRaid(u);
    await u.click(btn(/Dragon's Rest/));
    await u.click(btn(/Raid Dragon's Rest/));
    await u.click(btn('Show me how'));
    await u.click(btn('Send the army!'));
    expect(screen.getByText(/Your army falls back/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You did not win any loot this time.');
    expect(screen.getByText(/Troops that did not come home:/)).toBeInTheDocument();
  });

  it('a practice battle changes nothing and does not use up the raid', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    expect(screen.queryByText(/Friendly War/)).toBeNull();
    await u.click(btn(/Practice battle with Bunny Hollow/));
    expect(screen.getByText(/Practice battle on Bunny Hollow/)).toBeInTheDocument();
    expect(screen.getByText(/Nobody lost anything and nobody won anything/)).toBeInTheDocument();
    await u.click(btn('Carry on'));
    expect(btn(/Raid Bunny Hollow/)).toBeEnabled();
    await u.click(btn('Back to My Village'));
    expect(screen.getByText(/Clan purse/).closest('p')!).toHaveTextContent(`Clan purse: ${CONFIG.startGold} gold`);
  });

  it('one raid a day: after a raid the button is off and says so; a new day brings it back', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    await u.click(btn(/Raid Bunny Hollow/));
    await u.click(btn('Show me how'));
    await u.click(btn('Send the army!'));
    await u.click(btn('Carry on'));
    expect(btn(/Raid Bunny Hollow/)).toBeDisabled();
    expect(screen.getByText(/already raided 1 times today/)).toBeInTheDocument();
    expect(btn(/Practice battle with Bunny Hollow/)).toBeEnabled();
    await u.click(btn('Allow another raid today (test only)'));
    expect(btn(/Raid Bunny Hollow/)).toBeEnabled();
  });

  it('with no troops nothing can be sent', async () => {
    const u = user();
    show(session());
    await toRaid(u);
    expect(btn(/Raid Bunny Hollow/)).toBeDisabled();
    expect(btn(/Practice battle with Bunny Hollow/)).toBeDisabled();
    expect(screen.getByText('You need some troops to send.')).toBeInTheDocument();
  });

  it('shows a traffic light on each kingdom', async () => {
    const u = user();
    show(session((s) => { empireOf(s.clan).levels.barracks = 3; empireOf(s.clan).troops.footman = 40; }));
    await toRaid(u);
    expect(screen.getByRole('button', { name: /Bunny Hollow.*You should win/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pebble Bridge.*A close fight/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dragon's Rest.*Too strong for now/ })).toBeInTheDocument();
  });

  it('can be reached and used with the keyboard only', async () => {
    const u = user();
    show(session(winning));
    btn('My Village').focus();
    await u.keyboard('{Enter}');
    btn('Raid a kingdom / Practice battle').focus();
    await u.keyboard('{Enter}');
    btn(/Practice battle with Bunny Hollow/).focus();
    await u.keyboard('{Enter}');
    expect(screen.getByText(/Practice battle on Bunny Hollow/)).toBeInTheDocument();
  });
});

describe('Raid a classmate (test page, with pretend classmates)', () => {
  const army = (s: Session) => { Object.assign(s, barracksAndFill(s)); };

  it('says the one-a-day and shield rules plainly', async () => {
    const u = user();
    show(session(army));
    await toClassRaid(u);
    await screen.findByRole('button', { name: /Swift Foxes: a fair match/ });
    expect(screen.getByText(/You can raid/)).toHaveTextContent('You can raid one classmate a day, and a clan that was raided rests behind a shield the next day too.');
  });

  it('lists who can be raided and why the others cannot', async () => {
    const u = user();
    show(session(army));
    await toClassRaid(u);
    expect(await screen.findByRole('button', { name: /Swift Foxes: a fair match/ })).toBeEnabled();
    expect(btn(/Iron Wolves/)).toBeDisabled();
    expect(screen.getByText(/not a fair match/)).toBeInTheDocument();
    expect(btn(/Lucky Stars/)).toBeDisabled();
    expect(screen.getByText(/brand new and is still protected/)).toBeInTheDocument();
  });

  it('the plan is one choice, and the take is Gold or Buildings only', async () => {
    const u = user();
    show(session(army));
    await toClassRaid(u);
    await screen.findByRole('button', { name: /^Swift Foxes/ });
    expect(within(screen.getByRole('group', { name: 'What to take' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Gold', 'Buildings']);
    expect(screen.getByRole('button', { name: 'Gold' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('group', { name: 'How hard' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Careful', 'Steady', 'Bold']);
    expect(screen.queryByRole('group', { name: 'Rounds' })).toBeNull();
    expect(screen.queryByRole('group', { name: /Loot|Share/ })).toBeNull();
    expect(screen.queryByText(/land|vault/i)).toBeNull();
    await u.click(btn('Buildings'));
    expect(btn('Buildings')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/knock a level or two off their buildings/)).toBeInTheDocument();
  });

  it('sends the army, shows how it went, then shows the shield and allows only one raid a day', async () => {
    const u = user();
    show(session(army));
    await toClassRaid(u);
    await u.click(await screen.findByRole('button', { name: /Swift Foxes: a fair match/ }));
    await u.click(btn('Raid the Swift Foxes clan'));
    const result = screen.getByRole('group', { name: 'How it went' });
    expect(within(result).getByRole('heading')).toHaveTextContent('Raid on the Swift Foxes clan');
    expect(within(result).getByText(/shield for a day/)).toBeInTheDocument();
    await u.click(btn('Carry on'));
    expect((await screen.findAllByText(/already raided once today/)).length).toBeGreaterThan(0);
    expect(btn(/Brave Owls/)).toBeDisabled();
  });

  it('a raided pretend clan shows its shield day', async () => {
    const u = user();
    show(session((s) => { army(s); Object.assign(s, { pretendShield: ['pretend-owls'] }); }));
    await toClassRaid(u);
    await screen.findByRole('button', { name: /^Swift Foxes/ });
    const owls = btn(/Brave Owls/);
    expect(owls).toBeDisabled();
    expect(owls.parentElement).toHaveTextContent(/resting behind its shield\. Safe from raids until the end of (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\./);
  });

  it('a won raid for buildings says which levels came off', async () => {
    const u = user();
    show(session((s) => { army(s); Object.assign(s, armyToWin(s)); empireOf(s.clan).troops = { footman: 100, axeman: 0, knight: 0 }; }));
    await toClassRaid(u);
    await u.click(await screen.findByRole('button', { name: /Swift Foxes: a fair match/ }));
    await u.click(btn('Buildings'));
    await u.click(btn('Bold'));
    await u.click(btn('Raid the Swift Foxes clan'));
    const result = screen.getByRole('group', { name: 'How it went' });
    expect(within(result).getByRole('status')).toHaveTextContent(/You did not win anything this time\.|Their buildings were too strong|You knocked/);
  });

  it('is switched off by the teacher', async () => {
    const u = user();
    show(session((s) => { army(s); s.raidsOn = false; }));
    await toClassRaid(u);
    expect(screen.getByText(/switched raids on classmates off/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// With a server
// ---------------------------------------------------------------------------

const DAY0 = 20_000;

function made(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: DAY0 });
  if (!out.ok || !out.state) throw new Error('create failed');
  out.state.createdNzDay = DAY0 - 14;
  out.state.day = 15;
  const e = empireOf(out.state.clan);
  e.day = 15;
  e.levels.barracks = 3;
  e.troops.footman = 40;
  return out.state;
}
const defender = () => ({ id: 'pid-2', name: 'Swift Foxes', createdNzDay: DAY0 - 14, gold: 500, empire: structuredClone(empireOf(made().clan)) });

function box() {
  const t = { saved: made(), sent: [] as { type: string; [k: string]: unknown }[], notes: ['A raider from the Swift Foxes clan attacked, and your defenders drove them off!'] };
  const server: ClanServer = {
    async send(action) {
      t.sent.push(action);
      const out = applyAction(t.saved, action, {
        seed: SEED, today: DAY0, self: 'pid-1', raidsOn: true, target: action.type === 'raidClass' && action.target === 'pid-2' ? defender() : null,
        mates: [{ id: 'pid-2', name: 'Swift Foxes', createdNzDay: DAY0 - 14, shieldUntil: 0, troops: { footman: 40, axeman: 0, knight: 0 } }],
      });
      const shown = (s: ServerState) => structuredClone(publicState(s, DEFAULT_PRACTICAL_SETTINGS, { news: ['The Swift Foxes clan upgraded its Walls!'], raidsOn: true, notes: t.notes }));
      if (!out.ok) return { ok: false, why: out.why, say: out.say, seed: SEED, state: shown(t.saved) } satisfies ServerReply;
      if (out.changed && out.state) t.saved = out.state;
      return { ok: true, replayed: false, seed: SEED, state: out.state && shown(out.state), result: out.result } satisfies ServerReply;
    },
  };
  return { t, server };
}

describe('My Village with a server', () => {
  it('shows what raiders did while you were away, and the news', async () => {
    const u = user();
    const { server } = box();
    render(<ClanQuest server={server} />);
    expect(await screen.findByText('While you were away')).toBeInTheDocument();
    expect(screen.getByText(/Swift Foxes clan attacked/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'News' })).toHaveTextContent('The Swift Foxes clan upgraded its Walls!');
    expect(screen.queryByText(/village week|chest|vote/i)).toBeNull();
    await u.click(btn('News'));
    expect(screen.getByRole('heading', { name: 'News', level: 2 })).toBeInTheDocument();
  });

  it('sends an upgrade as an action, and shows what the server answered', async () => {
    const u = user();
    const { server, t } = box();
    render(<ClanQuest server={server} />);
    await u.click(await screen.findByRole('button', { name: 'My Village' }));
    await u.click(btn('Upgrade Smithy to level 1 for 50 gold'));
    await u.click(btn('Show me how'));
    await u.click(btn('Next question'));
    await u.click(btn('Show me how'));
    await u.click(btn('Upgrade for 50 gold'));
    await u.click(btn('Carry on'));
    await screen.findByText('Level 1 of 6');
    expect(t.sent).toEqual([{ type: 'load' }, { type: 'upgrade', building: 'smithy' }]);
    expect(empireOf(t.saved.clan).levels.smithy).toBe(1);
    expect(t.saved.clan.gold).toBe(CONFIG.startGold - 50);
  });

  it('sends a kingdom raid with just the push', async () => {
    const u = user();
    const { server, t } = box();
    render(<ClanQuest server={server} />);
    await u.click(await screen.findByRole('button', { name: 'My Village' }));
    await u.click(btn('Raid a kingdom / Practice battle'));
    await u.click(btn('Bold'));
    await u.click(btn('Practice battle with Bunny Hollow'));
    await screen.findByText(/Practice battle on Bunny Hollow/);
    expect(t.sent[1]).toEqual({ type: 'war', kingdom: 'bunny-hollow', push: 'bold' });
  });

  it('asks the server who can be raided, sends the raid with a push, and shows the answer', async () => {
    const u = user();
    const { server, t } = box();
    render(<ClanQuest server={server} />);
    await u.click(await screen.findByRole('button', { name: 'My Village' }));
    await u.click(btn('Raid a classmate'));
    await u.click(await screen.findByRole('button', { name: /Swift Foxes: a fair match/ }));
    await u.click(btn('Careful'));
    await u.click(btn('Raid the Swift Foxes clan'));
    const result = await screen.findByRole('group', { name: 'How it went' });
    expect(within(result).getByRole('heading')).toHaveTextContent('Raid on the Swift Foxes clan');
    expect(t.sent.map((a) => a.type)).toEqual(['load', 'raidTargets', 'raidClass']);
    expect(t.sent[2]).toEqual({ type: 'raidClass', target: 'pid-2', take: 'gold', push: 'careful' });
    expect(empireOf(t.saved.clan).raidsToday).toBe(1);
  });
});
