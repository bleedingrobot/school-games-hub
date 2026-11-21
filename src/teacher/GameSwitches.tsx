/**
 * Game switches on Today (James, 22 Nov 2026: "get them onto that main page with the rest of the switches"): every on/off
 * switch that used to be found only in a game's drawer on the Games table, grouped by game. The drawers still have them
 * too; both save the same setting. Gem Keep's maths choices and Dragon Maths' whole-school holiday pause stay in their drawers.
 */
import type { ReactNode } from 'react';
import { fetchArcheryDuels, saveArcheryDuels } from '../data/archerySwitch';
import { fetchBeanstalkSettings, saveBeanstalkSetting } from '../data/beanstalk';
import { fetchClanLiveDuels, fetchClanRaidsEnabled, fetchClanTypedNames, saveClanLiveDuels, saveClanRaidsEnabled, saveClanTypedNames } from '../data/clans';
import { fetchHopSettings, saveHopSetting } from '../data/hop';
import { fetchIslesSettings, saveIslesSetting } from '../data/isles';
import { fetchLordSettings, saveLordLiveArena } from '../data/lord';
import { fetchMarbleSwitches, saveMarbleRescue } from '../data/marble';
import { fetchPipiSettings, savePipiSetting } from '../data/pipi';
import { fetchToonFlapSettings, saveToonFlapSetting } from '../data/toonflap';
import { FORGE_TYPING_ABOUT, saveForge, saveForgeTyping, saveTraderLoans, useTraderClassSettings, useTraderForge, useTraderForgeTyping } from '../games/trader/teacher';
import { PUPILS_SEE_IT, SettingToggle, useSetting } from './Settings';

type Loaded<T> = { value: T | null; failed: boolean };

/** One switch, reading its value out of a game's loaded settings. */
function Switch<T>({ label, about, from, read, save }: { label: string; about: string; from: Loaded<T>; read: (s: T) => boolean | null; save: (on: boolean) => Promise<unknown> }) {
  return (
    <SettingToggle
      label={label}
      about={about}
      value={from.value === null ? null : read(from.value)}
      savedText={PUPILS_SEE_IT}
      loadFailed={from.failed}
      save={async (on) => {
        await save(on);
      }}
    />
  );
}

function Game({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="game-switches__game">
      <h3 className="game-switches__name">{name}</h3>
      <div className="lesson-controls__grid">{children}</div>
    </div>
  );
}

export function GameSwitches({ classId }: { classId: string }) {
  const archery = useSetting(() => fetchArcheryDuels(classId), [classId]);
  const heroNames = useSetting(() => fetchClanTypedNames(classId), [classId]);
  const raids = useSetting(() => fetchClanRaidsEnabled(classId), [classId]);
  const duels = useSetting(() => fetchClanLiveDuels(classId), [classId]);
  const lord = useSetting(() => fetchLordSettings(classId), [classId]);
  const isles = useSetting(() => fetchIslesSettings(classId), [classId]);
  const trader = useTraderClassSettings(classId);
  const forge = useTraderForge(classId);
  const typing = useTraderForgeTyping(classId);
  const toon = useSetting(() => fetchToonFlapSettings(classId), [classId]);
  const marble = useSetting(() => fetchMarbleSwitches(classId), [classId]);
  const beanstalk = useSetting(() => fetchBeanstalkSettings(classId), [classId]);
  const hop = useSetting(() => fetchHopSettings(classId), [classId]);
  const pipi = useSetting(() => fetchPipiSettings(classId), [classId]);
  const own = (b: boolean) => b;

  return (
    <section className="panel lesson-controls game-switches" aria-labelledby="game-switches-title">
      <h2 id="game-switches-title" className="panel__title">
        Game switches
      </h2>
      <p className="this-week__line">The extra switches inside each game. A game’s own on/off is on the Games page.</p>
      <Game name="Clan Quest">
        <Switch label="Live duels" from={duels} read={own} save={(on) => saveClanLiveDuels(on, classId)}
          about="Two classmates’ clans duel live, round by round, with a maths question each round. Clan names only, no chat. Nobody loses anything." />
        <Switch label="Village Raids on classmates" from={raids} read={own} save={(on) => saveClanRaidsEnabled(on, classId)}
          about="Clans raid a computer-played copy of a classmate’s village, 3 times a day. Nobody ever loses anything." />
        <Switch label="Made-up hero names" from={heroNames} read={own} save={(on) => saveClanTypedNames(on, classId)}
          about="On: pupils can type their own hero name (letters only, rude words refused). Off: names come from the list." />
      </Game>
      <Game name="Dragon Maths">
        <Switch label="Classmate clashes" from={lord} read={(s) => s.liveArena === true} save={(on) => saveLordLiveArena(on, classId)}
          about="Live arena clashes with a classmate: Hammer, Sword or Net, then a maths question. No chat. Practice clashes against computer heroes are always on." />
      </Game>
      <Game name="Archery Challenge">
        <Switch label="Classmate fights" from={archery} read={own} save={(on) => saveArcheryDuels(on, classId)}
          about="Students can challenge someone who has the game open to a one-round fight. Off leaves fights against the bots." />
      </Game>
      <Game name="Sky Isles">
        <Switch label="Sky Races" from={isles} read={(s) => s.races ?? null} save={(on) => saveIslesSetting({ races: on }, classId)}
          about="Race a sky-boat against the Gull Riders or a classmate’s island, twice a day. Nobody loses anything." />
      </Game>
      <Game name="Star Trader">
        <Switch label="Bank" from={trader} read={(s) => s.loans ?? null} save={(on) => saveTraderLoans(on, classId)}
          about="Students can borrow up to 500 credits at 10% a week, and nothing bad happens if they take a while to pay it back." />
        <Switch label="Star Forge" from={forge} read={own} save={(on) => saveForge(on, classId)}
          about="Off hides the Forge for this class. Ships already made are kept." />
        <Switch label="Pupils can type names in the Forge" from={typing} read={own} save={(on) => saveForgeTyping(on, classId)} about={FORGE_TYPING_ABOUT} />
      </Game>
      <Game name="Toon Flap">
        <Switch label="Maths in flight" from={toon} read={(s) => s.maths !== 'off'} save={(on) => saveToonFlapSetting({ maths: on ? 'on' : 'off' }, classId)}
          about="Questions on the perches and answer gaps from level 3. Off: plain rests and arrows." />
        <Switch label="Read time at answer signs" from={toon} read={(s) => s.readTime ?? null} save={(readTime) => saveToonFlapSetting({ readTime }, classId)}
          about="Levels 3 to 5 pause at each answer sign until the student taps Go, so slower readers aren’t rushed." />
      </Game>
      <Game name="Marble Rush">
        <Switch label="Rescue questions" from={marble} read={(s) => (s.maths === 'off' ? false : s.rescue ?? null)} save={(on) => saveMarbleRescue(on, classId)}
          about="After a fall, a right answer takes back the time it cost. Only happens while Marble Rush maths is on." />
      </Game>
      <Game name="Help in the junior games">
        <Switch label="Kiwi’s Beanstalk" from={beanstalk} read={(s) => s.dots ?? null} save={(on) => saveBeanstalkSetting({ dots: on }, classId)}
          about="Ten-frame dots on the leaves, fading as each student shows they know them." />
        <Switch label="Hop’s Glow-worm Pond" from={hop} read={(s) => s.labels ?? null} save={(on) => saveHopSetting({ labels: on }, classId)}
          about="Step labels (like +2) over each hop, fading fact by fact." />
        <Switch label="Pipi’s Hidden Shells" from={pipi} read={(s) => s.help ?? null} save={(on) => savePipiSetting({ help: on }, classId)}
          about="Outlines in the sand where the hiding shells are, fading split by split." />
      </Game>
    </section>
  );
}
