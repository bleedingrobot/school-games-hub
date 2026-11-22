import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in picture (the real one draws on a canvas, which this test browser doesn't have).
const calls = { warps: 0, scenes: [] as string[] };
vi.mock('./renderer', () => ({
  createSpaceView: () => ({
    setScene: (s: { kind: string; planet: string }) => { calls.scenes.push(`${s.kind}:${s.planet}`); },
    warp: async () => { calls.warps++; },
    shoot: async () => {},
    raiseShields: () => {},
    setHull: () => {},
    explode: async () => {},
    flee: async () => {},
    robbed: async () => {},
    resetFight: () => {},
    setOptions: () => {},
    stats: () => ({ simple: false, slowSwitches: 0, frames: 0, particles: 0 }),
    destroy: () => {},
  }),
}));

// The 3D viewer needs WebGL, which this test browser doesn't have: the Forge shows its flat picture instead.
vi.mock('./forge/loadViewer', () => ({ loadViewer: async () => null }));

import { traderApi } from '../../data/trader';
import { TraderGame } from './TraderGame';
import { QuestLog } from './QuestsPanel';
import { FIRST_SET, QUESTS } from '../../../shared/trader/quests';
import { SHIPS, WATER } from '../../../shared/trader/config';
import { nameText } from '../../../shared/trader/system';
import { trialBackend, type Trial } from './trialBackend';

// These screens do a lot per step; on a busy CI runner the default 1s wait ran out (twice on 4 Nov 2026).
configure({ asyncUtilTimeout: 5000 });

const NOW = Date.UTC(2026, 9, 22, 1, 0, 0);
const ALL_TIPS = ['maths', 'junk', 'trader', 'pirates', 'pirates-nolaser', 'customs', 'wrecked', 'robbed', 'shipyard', 'noyard', 'bank', 'borrow', 'news', 'jumps'];

beforeEach(() => {
  calls.warps = 0;
  calls.scenes = [];
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  HTMLCanvasElement.prototype.toDataURL = (() => '') as never;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
  // First Flight and the first-time tips have their own tests below; the rest of the game is tested as a pupil who has
  // skipped First Flight and seen every tip.
  localStorage.setItem('sgh-trader-coach', JSON.stringify({ flight: 'skipped', run: null, tips: ALL_TIPS }));
});
afterEach(() => cleanup());

function play(trial: Trial = trialBackend({ seed: 'screen-test', now: () => NOW }), startAt: 'title' | 'planet' = 'planet') {
  const api = traderApi(trial.transport);
  const sent: Record<string, unknown>[] = [];
  const spy: typeof trial.transport = async (body, o) => {
    sent.push(body);
    return trial.transport(body, o);
  };
  render(<TraderGame api={traderApi(spy)} startAt={startAt} />);
  void api;
  return { trial, sent };
}
const market = () => screen.findByRole('heading', { name: 'Market' });

describe('Star Trader screen (talking to the real server logic on a pretend database)', () => {

  it('a trade is sent with the next jump, not on its own, and the server saves it; the hold card finds where to sell on the star chart', async () => {
    const { trial, sent } = play();
    await market();
    const hud = screen.getByTitle('Your credits');
    const before = Number(within(hud).getByText(/\d/).textContent?.replace(/,/g, ''));
    const row = screen.getAllByRole('row').find((r) => within(r).queryByLabelText(/^Buy one Water$/));
    if (!row) throw new Error('no water row');
    fireEvent.click(within(row).getByLabelText('Buy one Water'));
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    await waitFor(() => {
      // A maths check can come up (it can open a moment after Trade); skip it.
      const skip = screen.queryByText('No thanks');
      if (skip) fireEvent.click(skip);
      const after = Number(within(screen.getByTitle('Your credits')).getByText(/\d/).textContent?.replace(/,/g, ''));
      expect(after).toBeLessThan(before);
      // GitHub's test machines are slower than a laptop: give the trade a few seconds to land.
    }, { timeout: 12000 });
    // Nothing but the opening request has gone to the server yet.
    expect(sent.filter((b) => b.action === 'act')).toHaveLength(0);
    expect(trial.data.game?.game.t.credits).toBe(100);

    // The hold card (H.2 to H.4): tap the Water in the hold, see what you paid, and find the best place on the star chart.
    fireEvent.click((await screen.findAllByRole('button', { name: /^Water, 1 in hold/ }))[0]);
    await screen.findByText(/You paid/);
    fireEvent.click((await screen.findAllByRole('button', { name: /Show on star chart/ }))[0]);
    await screen.findByRole('heading', { name: 'Star chart' });
    expect(document.querySelectorAll('.st-planet--pulse')).toHaveLength(1);

    // Keyboard keys (20 Nov 2026): T and M switch screens; typing x and y then Enter jumps, which sends the trade.
    fireEvent.keyDown(window, { key: 't' });
    await market();
    fireEvent.keyDown(window, { key: 'm' });
    await screen.findByRole('heading', { name: 'Star chart' });
    const near = screen.getAllByRole('button', { name: /, x -?\d+, y -?\d+\. Tap/ }).find((b) => !b.className.includes('st-planet--far') && !b.className.includes('--here'));
    const [, x, y] = near?.getAttribute('aria-label')?.match(/, x (-?\d+), y (-?\d+)/) ?? [];
    fireEvent.change(screen.getByLabelText('x (across)'), { target: { value: x } });
    fireEvent.change(screen.getByLabelText('y (up)'), { target: { value: y } });
    fireEvent.keyDown(screen.getByLabelText('y (up)'), { key: 'Enter' });
    await waitFor(() => expect(sent.filter((b) => b.action === 'act').length).toBeGreaterThan(0), { timeout: 5000 });
  }, 30000);

});





describe('The Star Forge (S.4)', () => {

  it('quests (Q.2, Q.3, Q.4, R.2, R.3): taking one plays its first 3 pages in the giver\'s voice, the gold landing card picks up, the hold shows gold, Q ticks the step, the chart rings the rest, finishing plays the last 2 pages then the reward, and the 📖 shelf reads them again; Lumi\'s clue + Show me and Vex\'s pirate fight with the Navy laser; Q.6 daily jobs taken, picked up and delivered; R.2: quests 6-10 under More quests, water per dry planet for Mayor Puddle, the Comet Cup lamps, fuel sum and refuel reset, the Gorbo card, Rust-Beard; R.3: Pip and Pop take turns reading, the Comet Cup finish plays before its last pages. Then the Forge: a locked sun is only a look; planning a sun is free; building it sends a forge action, shows the price first, and the card turns built', async () => {
    const trial = trialBackend({ seed: 'screen-test', now: () => NOW });
    const api = traderApi(trial.transport);
    expect((await api.load()).ok).toBe(true);
    trial.tools.give(5000);

    // Taking a quest (Q.3): pages 1 to 3 of Grandma Zuzu's story, skippable with Esc, then the Quests tab and its 📖 shelf.
    play(trial);
    await market();
    fireEvent.keyDown(window, { key: 'q' });
    await screen.findByRole('heading', { name: 'Quests' });
    expect(document.querySelector('.stq-board')).toBeTruthy();
    expect(screen.queryByText('📖 Quest stories')).toBeNull();
    // R.2: quests 6 to 10 wait under "More quests" till the first five are done.
    expect(screen.getByText('✨ More quests')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Quest 10' })).toBeTruthy();
    expect(screen.getByText('Finish the first five quests to open this one.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Take quest' }));
    const book = await screen.findByRole('dialog', { name: "Grandma Zuzu's Big Party" });
    expect(within(book).getByText('Page 1 of 3')).toBeTruthy();
    expect(within(book).getByRole('heading', { name: 'A party to plan' })).toBeTruthy();
    fireEvent.keyDown(book, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trial.data.game?.game.quests?.open).toBe('zuzu');
    expect(screen.getByRole('button', { name: "Read Grandma Zuzu's Big Party again" }).textContent).toMatch(/The story so far/);
    cleanup();

    trial.tools.toQuestStop();
    const { sent } = play(trial);
    await market();

    // Landing on a quest planet: one gold card, one tap, sent to the server at once.
    expect(await screen.findByText(/for Grandma Zuzu$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Pick up/ }));
    await waitFor(() => expect(trial.data.game?.game.quests?.done).toHaveLength(1));
    expect(JSON.stringify(sent)).toMatch(/"type":"quest-pickup"/);
    expect((await screen.findAllByText(/Gold boxes are quest cargo/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/for Grandma Zuzu$/)).toBeNull();
    // Q opens the Quests tab: the step is ticked and the next ones say where and how far.
    fireEvent.keyDown(window, { key: 'q' });
    await screen.findByRole('heading', { name: 'Quests' });
    expect(document.querySelectorAll('.stq-step--done')).toHaveLength(1);
    expect(screen.getAllByText(/fuel from here/).length).toBeGreaterThan(0);
    // The star chart rings the quest planets and sets the jump to the next stop in one tap.
    fireEvent.keyDown(window, { key: 'm' });
    await screen.findByRole('heading', { name: 'Star chart' });
    expect(document.querySelectorAll('.st-planet--quest').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'Set jump' }));
    expect((screen.getByLabelText('x (across)') as HTMLInputElement).value).not.toBe('');

    fireEvent.click(screen.getByRole('tab', { name: /Forge/ }));
    expect(await screen.findByRole('heading', { name: /Star Forge/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Sun: Choose a sun/ }));
    // a locked sun can be tapped for a look in the view, but isn't planned
    fireEvent.click(screen.getByRole('button', { name: /Two suns.*locked.*Tap to see how it looks/ }));
    expect(screen.getByText(/Just a look at/).parentElement?.textContent).toMatch(/Two suns/);
    expect(screen.getByRole('button', { name: /^Sun: Choose a sun/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Yellow star/ }));
    expect(screen.queryByText(/Just a look at/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Sun: Yellow star, planned/ })).toBeTruthy();
    expect(sent.some((b) => b.type === 'act')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build it' }));
    expect(await screen.findByText(/Total: 3,000 cr/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: /Build Yellow star/ })).getByRole('button', { name: 'Build it' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Sun: Yellow star, built/ })).toBeTruthy());
    expect(JSON.stringify(sent)).toMatch(/"type":"forge"/);
    cleanup();

    // Finishing (Q.3): the other two pick-ups (whichever is the next stop), then handing over at Zuzu's plays pages 4 and 5, then the server's reward.
    for (let n = 0; n < 2; n++) {
      trial.tools.toQuestStop();
      const loaded = await api.load();
      if (!loaded.ok) throw new Error('no game');
      const done = trial.data.game?.game.quests?.done.length;
      for (const step of [0, 1, 2]) if ((await api.act(loaded.value.version, [{ type: 'quest-pickup', step }])).ok) break;
      expect(trial.data.game?.game.quests?.done.length).toBe((done ?? 0) + 1);
    }
    trial.tools.toQuestStop();
    play(trial);
    await market();
    fireEvent.click(await screen.findByRole('button', { name: 'Hand them over' }));
    const end = await screen.findByRole('dialog', { name: "Grandma Zuzu's Big Party" });
    expect(within(end).getByText('Page 1 of 2')).toBeTruthy();
    expect(within(end).getByRole('heading', { name: 'Party time!' })).toBeTruthy();
    fireEvent.click(within(end).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(end).getByRole('button', { name: 'My reward' }));
    expect(await screen.findByText('+300 credits')).toBeTruthy();
    // Q.5: the keepsake goes into the Quest Log (the pretend database keeps it, as trader_save does). The try-out shows no hub points.
    expect(screen.getByText(/New keepsake in your Quest Log/).textContent).toMatch(/Party balloon/);
    expect(screen.queryByText(/hub points/)).toBeNull();
    expect(trial.data.questLog).toEqual(['zuzu']);
    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }));
    fireEvent.keyDown(window, { key: 'q' });
    expect((await screen.findByText('🎈 Party balloon')).closest('.stq-keep--got')).toBeTruthy();
    expect(screen.queryByText(/Star Quest Master/)).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: "Read Grandma Zuzu's Big Party again" }));
    expect(within(await screen.findByRole('dialog')).getByText('Page 1 of 5')).toBeTruthy();
    cleanup();
    // All five keepsakes: the Star Quest Master line with its trophy.
    render(<QuestLog keepsakes={QUESTS.map((q) => q.id)} />);
    expect(screen.getByText('🌟 Star Quest Master!')).toBeTruthy();
    expect(document.querySelectorAll('.stq-keep--got')).toHaveLength(5);
    cleanup();

    // Lumi's trail (Q.4): Ranger Kai says the move from here, the chart doesn't ring the planet, and Show me lights it up.
    const saved = trial.data.game!;
    saved.game.quests = { open: 'kai', done: [], finished: ['zuzu', 'sprocket', 'nettle', 'vex'], lastDay: 1 };
    play(trial);
    await market();
    const clue = (await screen.findByText("⭐ Lumi's trail")).closest('.stq-land') as HTMLElement;
    expect(clue.textContent).toMatch(/Ranger Kai: “(From here, go \d+ (right|left|up|down).*|Lumi is right here!)”/);
    fireEvent.click(within(clue).getByRole('button', { name: 'Show me' }));
    await screen.findByRole('heading', { name: 'Star chart' });
    expect(document.querySelectorAll('.st-planet--quest').length).toBeGreaterThan(0);
    cleanup();

    // Commander Vex's pirates (Q.4): at a pirate stop the card says fight, and the fight has Vex's Navy laser and a gentle loss.
    saved.game.quests = { open: 'vex', done: [], finished: ['zuzu', 'sprocket', 'nettle'], lastDay: 1 };
    trial.tools.toQuestStop();
    const vex = play(trial);
    await market();
    fireEvent.click(await screen.findByRole('button', { name: '⚔️ Fight them' }));
    await waitFor(() => expect(trial.data.game?.game.pending?.kind).toBe('fight'));
    expect((await screen.findByText(/One of the Rust Raiders/)).textContent).toMatch(/Commander Vex's Navy laser is fitted/);
    expect(JSON.stringify(vex.sent)).toMatch(/"type":"quest-fight"/);
    cleanup();

    // R.2, Mayor Puddle: the water is handed out at each dry planet, "3 Water here (you have 9)" (a Flea's smaller order).
    // The saved game is replaced on each save, so always edit the latest one.
    const g = () => trial.data.game!.game;
    g().pending = null;
    g().quests = { open: 'puddle', done: [], small: true, finished: [...FIRST_SET], lastDay: 1 };
    g().t.cargo[WATER] = 9;
    trial.tools.toQuestStop();
    play(trial);
    await market();
    expect(await screen.findByText('Hand out 3 Water here for Mayor Puddle (you have 9)')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '⭐ Quests' }));
    expect((await screen.findAllByText('3 Water here (you have 9)')).length).toBe(3);
    expect(screen.getByText(/Mayor Puddle pays/).textContent).toMatch(/900 cr when it's all handed out/);
    cleanup();

    // R.2, the Comet Cup: the race sum, the lamps and GO! at the start line, "Fuel left / Still to fly", and buying fuel
    // after the start sends it back to the start line, gently. Chef Gorbo's card says 400 + what he pays for the goods.
    g().quests = { open: 'zip', done: [], finished: [...FIRST_SET, 'puddle', 'gorbo'], lastDay: 1 };
    g().t.cargo[WATER] = 0;
    const tank = SHIPS[g().t.ship].fuelTank;
    g().t.fuel = tank;
    trial.tools.toQuestStop();
    play(trial);
    await market();
    fireEvent.click(await screen.findByRole('button', { name: '🚦 Start the race!' }));
    expect((await screen.findByRole('status', { name: /^GO!/ })).dataset.fx).toBe('start');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(trial.data.game?.game.quests?.fuelAtStart).toBe(tank);
    fireEvent.click(screen.getByRole('tab', { name: '⭐ Quests' }));
    expect((await screen.findByText(/^Fuel left:/)).textContent).toMatch(new RegExp(`^Fuel left: ${tank}\\. Still to fly: \\d+`));
    expect(screen.getByText(/what he pays for the goods/).textContent).toMatch(/400 cr \+ what he pays for the goods \(1,[\d,]+ cr\)/);
    cleanup();
    trial.data.game!.game.t.fuel -= 4;
    play(trial);
    await market();
    fireEvent.click(screen.getByRole('tab', { name: 'Ship' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Fill the tank/ }));
    expect(await screen.findByText(/You refuelled, so it's back to the start line/)).toBeTruthy();
    cleanup();

    // R.2, Captain Sable: after the three map marks, Rust-Beard's card and his painted entrance before the fight.
    trial.data.game!.game.quests = { open: 'sable', done: [0, 1, 2], finished: [...FIRST_SET, 'puddle', 'gorbo', 'zip', 'pippop'], lastDay: 1 };
    trial.tools.toQuestStop();
    play(trial);
    await market();
    expect(await screen.findByText("Rust-Beard's ship is still here.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '⚔️ Fight them' }));
    expect(await screen.findByRole('heading', { name: 'Rust-Beard attacks! ☠️' })).toBeTruthy();
    expect(screen.getByText('🏴‍☠️ Rust-Beard!')).toBeTruthy();
    expect(trial.data.game?.game.pending).toMatchObject({ kind: 'fight', tier: 2, quest: 3 });
    cleanup();
    trial.data.game!.game.pending = null;

    // R.3, Pip and Pop's story: taking it plays pages 1 to 3, the twins taking turns to read (a tag says whose turn).
    trial.data.game!.game.quests = { open: null, done: [], finished: [...FIRST_SET, 'puddle', 'gorbo', 'zip'], lastDay: null };
    play(trial);
    await market();
    fireEvent.click(screen.getByRole('tab', { name: 'Quests' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Take quest' }));
    const twins = await screen.findByRole('dialog', { name: "Pip and Pop's Runaway Pets" });
    expect([within(twins).getByText('Page 1 of 3'), within(twins).getByText('Pip reads')]).toBeTruthy();
    fireEvent.click(within(twins).getByRole('button', { name: 'Next' }));
    expect(within(twins).getByRole('heading', { name: 'Lost pets' })).toBeTruthy();
    expect(within(twins).getByText('Pop reads')).toBeTruthy();
    fireEvent.keyDown(twins, { key: 'Escape' });
    await waitFor(() => expect(trial.data.game?.game.quests?.open).toBe('pippop'));
    cleanup();

    // R.3, the Comet Cup's finish: the chequered-flag moment plays first, then Zip's last two pages (same painting), then the reward.
    trial.data.game!.game.quests = { open: 'zip', done: [0, 1], fuelAtStart: tank, finished: [...FIRST_SET, 'puddle', 'gorbo'], lastDay: 1 };
    trial.tools.toQuestStop();
    play(trial);
    await market();
    fireEvent.click(await screen.findByRole('button', { name: '🏁 Cross the line!' }));
    await waitFor(() => expect(document.querySelector('[data-fx="finish"]')).toBeTruthy());
    expect(trial.data.game?.game.quests?.finished).toContain('zip');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    const cup = await screen.findByRole('dialog', { name: 'The Comet Cup' });
    expect(within(cup).getByRole('heading', { name: 'Across the line!' })).toBeTruthy();
    cleanup();

    // Q.6 daily jobs: after all five quests, 📦 Today's jobs on the Quests tab; take one (no story), pick up the crates at the
    // gold stop, deliver for the pay, and the card says delivered.
    trial.tools.moveTo(trial.data.game!.game.t.location);
    trial.tools.finishAllQuests();
    play(trial);
    await market();
    fireEvent.keyDown(window, { key: 'q' });
    expect(await screen.findByText("📦 Today's jobs")).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Take job' })[0]);
    await waitFor(() => expect(trial.data.game?.game.quests?.open).toBe('job-0'));
    expect(screen.queryByRole('dialog')).toBeNull();
    const job = trial.data.game!.game.quests!.jobs!.list[0];
    cleanup();
    trial.tools.toQuestStop();
    play(trial);
    await market();
    expect(await screen.findByText(/crates? of .* for the Star Post$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Pick up/ }));
    await waitFor(() => expect(trial.data.game?.game.t.questCargo).toBe(job.qty));
    cleanup();
    trial.tools.toQuestStop();
    play(trial);
    await market();
    const credits = trial.data.game!.game.t.credits;
    fireEvent.click(await screen.findByRole('button', { name: 'Deliver' }));
    expect(await screen.findByText(/Job done! \+[\d,]+ credits/)).toBeTruthy();
    expect(trial.data.game!.game.t.credits).toBe(credits + job.pay);
    fireEvent.keyDown(window, { key: 'q' });
    expect(await screen.findByText('✓ Delivered')).toBeTruthy();
    void nameText;
  }, 30000);
});

