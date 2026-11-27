/**
 * One Maths Monsters battle, as a normal web page (not canvas). The rules come from the
 * N.2 engine (`play`); this screen asks the maths question, plays the engine's events one
 * at a time with short animations, big flashing callouts and a message box. The events play on
 * by themselves (a tap, Enter or Skip hurries them along), so the student only chooses things.
 *
 * Flow: menu (the moves, plus Team / Bag / Run) → question → events play → back to the menu,
 * a forced "choose your next monster", or the Victory celebration. Enter always picks the best
 * choice: the strongest move, the healthiest monster, the most hurt one to heal, Continue.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Question, SkillPack } from '../../../shared/maths/skillPack';
import { makePack, type TopicId } from '../../../shared/maths/skillPacks';
import {
  activeFoe, activeMonster, healTeam, isOver, judgeAnswer, newBattle, play, questionFor,
  type Bag, type BattleAction, type BattleEvent, type BattleSetup, type BattleState, type ItemId,
} from '../../../shared/monsters/engine';
import { bandFor } from '../../../shared/monsters/bands';
import { speciesOf } from '../../../shared/monsters/monsterBook';
import type { BattleStep } from '../../../shared/monsters/save/check';
import { quickMsOfReport, type QuestionReport } from '../../../shared/monsters/save/verify';
import { effectiveTopic } from '../../../shared/monsters/topics';
import { maxHpOf, type AnswerResult, type Monster } from '../../../shared/monsters/rules';
import { TYPE_LABEL, typeMultiplier, type TypeId } from '../../../shared/monsters/types';
import { areaInfo } from '../../../shared/monsters/world/areas';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { useSound } from '../../sound';
import { playSound, type GameSound } from '../sounds';
import { AttackEffect, CriticalPop, DamageNumber, EFFECT_MS, HitFlash } from './art/Effects';
import { MonsterArt, type MonsterState } from './art/MonsterArt';
import { lookPic, monsterPic, personPic, preload, scenePic } from './art/painted';
import { loadMonsterSettings, saveMonsterSettings, type MonsterSettings } from './settings';
import { beatsFor, ITEM_LABEL, nameOf, type Beat } from './text';
import { ArrivalBanner, ArrivalBurst, arrivalOf } from './RareArrival';
import { TypeChart } from './TypeChart';
import { BagList, NameCard, Sheet, summarise, TeamList } from './ui';
import { Victory } from './Victory';
import './art/monster-art.css';
import './monsters.css';
import './rare-arrival.css';

export interface BattleResult {
  outcome: 'won' | 'lost' | 'ran' | 'caught';
  state: BattleState;
  /** The team to carry on with: healed if the battle was lost ("your team is tired"). */
  team: Monster[];
  box: Monster[];
  bag: Bag;
  questions: number;
  /** What happened, step by step, with each maths question and the random numbers drawn: what gets saved. */
  steps: BattleStep[];
}

export interface BattleScreenProps {
  setup: BattleSetup;
  /** Student settings. Leave out to use (and keep) this device's saved ones. */
  settings?: MonsterSettings;
  onSettingsChange?: (settings: MonsterSettings) => void;
  onFinish: (result: BattleResult) => void;
  /** 0 to 1 random numbers. Tests pass a fixed source. */
  random?: () => number;
  /** Where the questions come from (tests pass a fake pack). */
  packFor?: (topic: TopicId) => SkillPack;
  /**
   * The student's maths ladder (James, 26 Nov 2026): every question comes from here, the same as the other games, and the
   * monster's type no longer picks a topic. Left out (the test page, or the ladder could not be loaded), the old topic packs ask.
   */
  ladder?: LadderMaths;
  /** Tests set 0 to skip animation pauses. */
  timeScale?: number;
  /** The topics the teacher left on: a switched-off topic's questions come from the nearest topic that is on. */
  enabledTopics?: readonly TopicId[];
  /** The map the battle is on, for its painted background (a Tower's rooms share one). Leave out to use the area's outdoor map. */
  place?: string;
  /** A trainer battle: the trainer's name, so their picture can say hello before their first monster comes out. */
  trainer?: string;
  /** One "Power up!" question with the first attack, then attacks ask nothing (every battle in the game since 27 Nov 2026). Off: every attack asks. */
  powerUp?: boolean;
  /** The player's chosen look, shown opposite the trainer while they say hello. */
  look?: string;
  /** What a finished battle earns (bits, a trainer's items, a badge, quest news), shown on the Victory page. Leave out for none. */
  prizeFor?: (result: BattleResult) => string[];
  /** Monsters already in the book as owned: the foe's card says whether you have caught one yet. Leave out to say nothing. */
  owned?: readonly string[];
}

type Mode = 'playing' | 'menu' | 'team' | 'replace' | 'bag' | 'target' | 'question' | 'end';

/** How long a message stays before the next one plays by itself: long enough to read, longer for a wrong answer's fact. */
export function beatMs(beat: Beat): number {
  const base = beat.sub === 'evolving' ? 1800 : beat.event.kind === 'attack' ? 1500 : 1200;
  return Math.min(4200, Math.max(base, 700 + beat.text.length * 40));
}

/** The big word that flashes over the battle for a beat, if it earns one. */
export function calloutFor(beat: Beat | undefined): { text: string; tone: string } | null {
  const e = beat?.event;
  if (!e) return null;
  switch (e.kind) {
    case 'attack':
      if (e.side === 'you' && e.answer === 'quick-right') return { text: 'Critical hit!', tone: 'crit' };
      if (e.effect === 'strong') return { text: 'Super effective!', tone: 'strong' };
      if (e.side === 'you' && e.answer === 'wrong') return { text: 'Small hit', tone: 'weak' };
      return { text: 'Hit!', tone: 'hit' };
    case 'power-up':
      return e.answer === 'wrong' ? null : { text: e.answer === 'quick-right' ? 'Super power up!' : 'Power up!', tone: 'power' };
    case 'faint':
      return e.side === 'foe' ? { text: 'Beaten!', tone: 'ko' } : { text: 'Tired out!', tone: 'weak' };
    case 'catch-try':
      return e.success ? { text: 'Gotcha!', tone: 'power' } : { text: 'Broke free!', tone: 'weak' };
    case 'caught':
      return { text: 'Caught!', tone: 'win' };
    case 'level-up':
      return { text: 'Level up!', tone: 'power' };
    case 'evolved':
      return beat?.sub === 'evolving' ? { text: 'Evolving…', tone: 'evo' } : { text: 'Evolved!', tone: 'evo' };
    case 'won':
      return { text: 'Victory!', tone: 'win' };
    case 'switch':
      return { text: 'Go!', tone: 'hit' };
    default:
      return null;
  }
}

/** Enter's move: the hardest hit on this foe (power × strong/weak). */
export function bestAttack(attacks: readonly { power: number; anim: string }[], foeType: TypeId): number {
  let best = 0;
  attacks.forEach((a, i) => {
    const score = (x: { power: number; anim: string }) => x.power * typeMultiplier(x.anim.split('-')[0] as TypeId, foeType);
    if (score(a) > score(attacks[best])) best = i;
  });
  return best;
}
type Side = 'you' | 'foe';
type FoeLook = MonsterState | 'gone';

interface Shown {
  team: Monster[];
  foes: Monster[];
  active: number;
  foeActive: number;
}

/** The ladder pack for a visit, and the class's question settings. */
export interface LadderMaths {
  pack: SkillPack;
  enabledTables?: number[];
  division?: boolean;
}

interface Asking {
  question: Question;
  topic: TopicId | 'ladder';
  band: number;
  title: string;
  note?: string;
  action: { kind: 'fight'; attack: number } | { kind: 'catch'; ball?: 'ball' | 'great-ball' } | { kind: 'power-up'; attack: number };
  back: Mode;
}

interface Pop {
  id: number;
  side: Side;
  kind: 'num' | 'heal' | 'crit';
  amount?: number;
  effect?: 'strong' | 'weak' | 'normal';
}

const clone = <T,>(v: T): T => structuredClone(v);
const shownFrom = (s: BattleState): Shown => ({ team: clone(s.team), foes: clone(s.foes), active: s.active, foeActive: s.foeActive });

export function BattleScreen({ setup, settings: given, onSettingsChange, onFinish, random = Math.random, packFor, ladder, timeScale = 1, enabledTopics, place, trainer, look, owned, powerUp = false, prizeFor }: BattleScreenProps) {
  const { soundOn } = useSound();
  const [ownSettings, setOwnSettings] = useState(loadMonsterSettings);
  const settings = given ?? ownSettings;
  const changeSettings = (next: MonsterSettings) => {
    if (!given) {
      setOwnSettings(next);
      saveMonsterSettings(next);
    }
    onSettingsChange?.(next);
  };

  const start = useMemo(() => newBattle(setup), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [battle, setBattle] = useState<BattleState>(start.state);
    const [shown, setShown] = useState<Shown>(() => shownFrom(start.state));
  const [mode, setMode] = useState<Mode>('playing');
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [myLook, setMyLook] = useState<MonsterState>('idle');
  const [foeLook, setFoeLook] = useState<FoeLook>('idle');
  const [fx, setFx] = useState<{ id: number; anim: string; side: Side } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [ball, setBall] = useState<null | 'shake' | 'caught'>(null);
  const [evolving, setEvolving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const chartButton = useRef<HTMLButtonElement>(null);
  // Opening the chart puts the keyboard on its Back button, so Enter or Escape closes it.
  useEffect(() => {
    if (showChart) document.querySelector<HTMLElement>('[aria-label="Strong and weak"] button')?.focus({ preventScroll: true });
  }, [showChart]);
  const closeChart = () => {
    setShowChart(false);
    window.setTimeout(() => chartButton.current?.focus({ preventScroll: true }), 0);
  };
  const [pendingItem, setPendingItem] = useState<ItemId | null>(null);

  const log = useRef(start.events.slice());
  const move = useRef<{ before: BattleState; next: BattleState; action?: BattleAction }>({ before: start.state, next: start.state });
  const ids = useRef(0);
  const timers = useRef<number[]>([]);
  const packs = useRef(new Map<TopicId, SkillPack>());
  const judged = useRef<AnswerResult>('right');
  /** The record of the battle for saving: every step, the question behind it, and the random numbers it drew. */
  const steps = useRef<BattleStep[]>([]);
  const answered = useRef<QuestionReport | null>(null);
  const nextButton = useRef<HTMLButtonElement>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms * timeScale);
    timers.current.push(t);
  }, [timeScale]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const play_ = useCallback((sound: GameSound) => {
    if (soundOn) playSound(sound);
  }, [soundOn]);

  const hurt = useCallback((side: Side) => {
    if (side === 'you') {
      setMyLook('hurt');
      later(() => setMyLook((l) => (l === 'hurt' ? 'idle' : l)), 520);
    } else {
      setFoeLook('hurt');
      later(() => setFoeLook((l) => (l === 'hurt' ? 'idle' : l)), 520);
    }
  }, [later]);
  const pop = useCallback((p: Omit<Pop, 'id'>) => {
    const id = ++ids.current;
    setPops((all) => [...all, { ...p, id }]);
    later(() => setPops((all) => all.filter((x) => x.id !== id)), 1500);
  }, [later]);

  /** Shows what one beat of the move looks like and changes the picture to match. */
  const showBeat = useCallback((beat: Beat) => {
    const { before, next, action } = move.current;
    const e = beat.event;
    const memberOf = (species: string) =>
      Math.max(0, before.team.findIndex((m, i) => m.species === species || next.team[i]?.species === species));
    setEvolving(beat.sub === 'evolving');
    switch (e.kind) {
      case 'attack': {
        const target: Side = e.side === 'you' ? 'foe' : 'you';
        const id = ++ids.current;
        setFx({ id, anim: e.anim, side: target });
        later(() => setFx((f) => (f?.id === id ? null : f)), EFFECT_MS[Number(e.anim.split('-')[1]) - 1] ?? 900);
        play_('zap');
        later(() => {
          hurt(target);
          play_('capture');
          pop({ side: target, kind: 'num', amount: e.damage, effect: e.side === 'you' ? e.effect : 'normal' });
          if (e.answer === 'quick-right') pop({ side: target, kind: 'crit' });
          setShown((s) => {
            const n = clone(s);
            if (e.side === 'you') n.foes[n.foeActive].hp = Math.max(0, n.foes[n.foeActive].hp - e.damage);
            else n.team[n.active].hp = Math.max(0, n.team[n.active].hp - e.damage);
            return n;
          });
        }, 300);
        break;
      }
      case 'power-up':
        if (e.answer !== 'wrong') play_('item');
        break;
      case 'faint':
        (e.side === 'you' ? setMyLook : setFoeLook)('faint');
        play_('end');
        break;
      case 'foe-sent':
        setFoeLook('idle');
        setShown((s) => ({ ...clone(s), foeActive: next.foeActive }));
        break;
      case 'switch':
        setMyLook('idle');
        setShown((s) => ({ ...clone(s), active: next.active }));
        play_('tap');
        break;
      case 'item': {
        const target = action?.kind === 'item' ? action.target ?? before.active : before.active;
        play_('item');
        pop({ side: 'you', kind: 'heal', amount: e.healed });
        setShown((s) => {
          const n = clone(s);
          n.team[target].hp += e.healed ?? 0;
          return n;
        });
        break;
      }
      case 'catch-try':
        setBall('shake');
        play_('hop');
        if (e.success) later(() => setBall('caught'), 600);
        else later(() => setBall(null), 900);
        break;
      case 'caught':
        setFoeLook('gone');
        play_('win');
        break;
      case 'exp':
        setShown((s) => {
          const n = clone(s);
          n.team[memberOf(e.monster)].exp += e.amount;
          return n;
        });
        break;
      case 'level-up':
        setShown((s) => {
          const n = clone(s);
          n.team[memberOf(e.monster)].level = e.level;
          return n;
        });
        play_('item');
        break;
      case 'evolved':
        // "What? Digibud is changing!": fetch the grown form's picture while it flashes.
        if (beat.sub === 'evolving') preload(monsterPic(e.to, next.team[memberOf(e.to)]?.shiny));
        if (beat.sub === 'evolved') {
          setShown((s) => {
            const n = clone(s);
            n.team[memberOf(e.to)].species = e.to;
            return n;
          });
          play_('cosmic');
        }
        break;
      case 'won':
        play_('win');
        break;
      case 'ran':
        setFoeLook('gone');
        break;
    }
  }, [hurt, later, play_, pop]);

  /** After the last message: line the picture up with the engine and go to the next menu. */
  const finishMove = useCallback(() => {
    const { next } = move.current;
    setBattle(next);
    setShown(shownFrom(next));
    setEvolving(false);
    setFx(null);
    setBall(null);
    if (isOver(next)) setMode('end');
    else if (next.phase === 'replace') setMode('replace');
    else setMode('menu');
  }, []);

  const startBeats = useCallback((list: Beat[]) => {
    setBeats(list);
    setBeatIdx(0);
    setMode('playing');
    if (list.length) showBeat(list[0]);
  }, [showBeat]);

  // A trainer with a painted picture says hello first ("Ranger Kiri wants to battle!"), then sends out their monster.
  const trainerPic = setup.kind === 'trainer' && trainer ? personPic(trainer) : undefined;
  const [intro, setIntro] = useState(!!trainerPic);
  const playerPic = trainerPic && look ? lookPic(look) : undefined;

  const arrival = useMemo(() => (setup.kind === 'wild' ? arrivalOf(start.state.foes[0]) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [fanfare, setFanfare] = useState(false);

  // The opening message ("A wild Digibud appeared!").
  useEffect(() => {
    const opening = beatsFor(start.events, setup.kind);
    if (trainerPic && opening.length) {
      const first = opening[0];
      opening.splice(0, 1, { ...first, text: `${trainer} wants to battle!` }, { ...first, text: `${trainer} sends out ${nameOf(start.state.foes[0].species)}!` });
    }
    startBeats(opening);
    // A rare, ultra rare or shiny wild monster: the big fuss (banner, flash, sparkles, sound).
    if (arrival) {
      later(() => {
        setFanfare(true);
        play_(arrival.sound);
      }, 120);
      later(() => setFanfare(false), 120 + arrival.ms);
    }
    // A trainer's other monsters come out later: fetch their pictures now, so they don't pop in.
    preload(...start.state.foes.slice(1).map((m) => monsterPic(m.species, m.shiny)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advance() {
    setIntro(false);
    if (beatIdx + 1 < beats.length) {
      setBeatIdx(beatIdx + 1);
      showBeat(beats[beatIdx + 1]);
    } else finishMove();
  }
  function skip() {
    setIntro(false);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMyLook('idle');
    setFoeLook((l) => (l === 'gone' ? l : 'idle'));
    setPops([]);
    // Jump to the end, keeping the faint look for a monster that was beaten.
    const { next } = move.current;
    setFoeLook(next.foes[next.foeActive].hp <= 0 || next.phase === 'caught' ? (next.phase === 'caught' || next.phase === 'ran' ? 'gone' : 'faint') : 'idle');
    setMyLook(next.team[next.active].hp <= 0 ? 'faint' : 'idle');
    finishMove();
  }

  /** Runs the engine for one action and starts playing what happened. */
  /** `then` is played straight after (the attack that comes after a power up), with its messages following on. */
  function run(action: BattleAction, fact?: string, then?: BattleAction) {
    const before = battle;
    let next = before;
    const events: BattleEvent[] = [];
    for (const a of then ? [action, then] : [action]) {
      if (isOver(next)) break;
      const draws: number[] = [];
      const step = play(next, a, () => {
        const n = random();
        draws.push(n);
        return n;
      });
      const asked = a.kind === 'catch' || a.kind === 'power-up' || (a.kind === 'fight' && a.answer !== undefined);
      steps.current.push({ action: a, ...(answered.current && asked ? { q: answered.current } : {}), randoms: draws });
      answered.current = null;
      next = step.state;
      events.push(...step.events);
    }
    move.current = { before, next, action };
    log.current.push(...events);
    setAsking(null);
    setPendingItem(null);
    setShown(shownFrom(before));
    let list = beatsFor(events, before.kind, fact);
    // A win's exp and levels are shown on the Victory celebration, not read out one by one first.
    if (next.phase === 'won' || next.phase === 'caught') list = list.filter((b) => b.event.kind !== 'exp' && b.event.kind !== 'level-up');
    startBeats(list);
  }

  /** The attack a power up was asked for, played straight after it. */
  const thenOf = (a: Asking['action']): BattleAction | undefined => (a.kind === 'power-up' ? { kind: 'fight', attack: a.attack } : undefined);

  function packOf(topic: TopicId) {
    let pack = packs.current.get(topic);
    if (!pack) {
      pack = (packFor ?? ((t) => makePack(t)))(topic);
      packs.current.set(topic, pack);
    }
    return pack;
  }

  /** Asks the question for a fight, catch or power-up action (the topic and band come from the engine). */
  function ask(action: Asking['action'], back: Mode) {
    // A battle asks once, with its first attack ("Power up!"); after that attacks go straight in.
    if (action.kind === 'fight' && powerUp) {
      if (battle.powerUp !== undefined) return run({ kind: 'fight', attack: action.attack });
      action = { kind: 'power-up', attack: action.attack };
    }
    const wanted = questionFor(battle, action);
    if (!wanted) return;
    const title = action.kind === 'fight' ? speciesOf(activeMonster(battle).species).attacks[action.attack].name
      : action.kind === 'power-up' ? 'Power up!' : `Catch ${nameOf(activeFoe(battle).species)}`;
    const note = action.kind === 'catch' ? 'A right answer makes the catch much more likely'
      : action.kind === 'power-up' ? `Get it right and every attack hits harder this battle${settings.calm ? '' : ' (even harder if you’re quick)'}`
      : settings.calm ? undefined : 'A quick right answer hits extra hard';
    const answerless = (r: AnswerResult) => ({ ...action, answer: r }) as BattleAction;
    if (ladder) {
      // The student's own place on the maths ladder, whatever the monster's type.
      const question = ladder.pack.nextQuestion({ multipleChoice: settings.multipleChoice, enabledTables: ladder.enabledTables, division: ladder.division });
      if (!question) return run(answerless('right'), undefined, thenOf(action));
      setAsking({ question, topic: 'ladder', band: 0, title, note, action, back });
      setMode('question');
      return;
    }
    // A topic the teacher switched off is swapped for the nearest one that is on (and asked at that topic's band for this place).
    const topic = effectiveTopic(wanted.topic, enabledTopics);
    const spec = topic === wanted.topic ? wanted : { topic, band: bandFor(topic, battle.area, battle.far) };
    const question = packOf(spec.topic).nextQuestion({ level: spec.band, multipleChoice: settings.multipleChoice });
    if (!question) return run(answerless('right'), undefined, thenOf(action)); // nothing can be asked: never block the battle
    setAsking({ question, topic: spec.topic, band: spec.band, title, note, action, back });
    setMode('question');
  }

  const mine = shown.team[shown.active];
  const foe = shown.foes[shown.foeActive];
  const foeIsTrainer = battle.kind === 'trainer';
  const message = mode === 'playing' ? beats[beatIdx]?.text ?? '' : mode === 'menu' ? `What will ${nameOf(mine.species)} do?` : mode === 'replace' ? 'Choose your next monster.' : '';
  const popsFor = (side: Side) => pops.filter((p) => p.side === side);
  const beat = mode === 'playing' ? beats[beatIdx] : undefined;
  const callout = calloutFor(beat);

  // Keep the Next button ready for the Enter or Space key.
  useEffect(() => {
    if (mode === 'playing') nextButton.current?.focus({ preventScroll: true });
  }, [mode, beatIdx]);

  // The messages play on by themselves (tests, with timeScale 0, tap through instead).
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    if (mode !== 'playing' || timeScale === 0 || !beat) return;
    const t = window.setTimeout(() => advanceRef.current(), beatMs(beat) * timeScale);
    return () => window.clearTimeout(t);
  }, [mode, beatIdx, beats, beat, timeScale]);

  // Team, Bag and Run sit under the moves; letters and number keys pick them, Escape goes back.
  const menuItems = useMemo(
    () => [
      { id: 'team', label: 'Team', key: 't' },
      { id: 'bag', label: 'Bag', key: 'b' },
      ...(foeIsTrainer ? [] : [{ id: 'run', label: 'Run', key: 'r' }]),
    ],
    [foeIsTrainer],
  );
  const attacks = speciesOf(activeMonster(battle).species).attacks;
  const best = bestAttack(attacks, speciesOf(activeFoe(battle).species).type);
  /** Enter's monster to send out: the healthiest one still standing. */
  const healthiest = () => {
    let pick = -1;
    battle.team.forEach((m, i) => {
      if (m.hp > 0 && i !== battle.active && (pick < 0 || m.hp / maxHpOf(m) > battle.team[pick].hp / maxHpOf(battle.team[pick]))) pick = i;
    });
    return pick;
  };
  /** Enter's monster to heal: the most hurt one still standing. */
  const mostHurt = () => {
    let pick = -1;
    battle.team.forEach((m, i) => {
      if (m.hp > 0 && m.hp < maxHpOf(m) && (pick < 0 || m.hp / maxHpOf(m) < battle.team[pick].hp / maxHpOf(battle.team[pick]))) pick = i;
    });
    return pick;
  };
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    // The chart is on top: the battle's keys wait until it is closed.
    if (showChart) {
      if (e.key === 'Escape') closeChart();
      return;
    }
    const n = Number(e.key);
    // Space works like Enter (James, 28 Nov 2026).
    const enter = e.key === 'Enter' || e.key === ' ';
    // Enter or Space on a focused button presses that button (the browser does it); otherwise it takes the best choice.
    const onButton = enter && (e.target as HTMLElement | null)?.tagName === 'BUTTON';
    if (mode === 'playing' && enter && !onButton) {
      // The Next button lost the keyboard (a tap somewhere else): the key still moves the battle on.
      e.preventDefault();
      advance();
    } else if (mode === 'menu') {
      const item = menuItems.find((m) => m.key === e.key.toLowerCase());
      if (n >= 1 && n <= attacks.length) {
        e.preventDefault();
        ask({ kind: 'fight', attack: n - 1 }, 'menu');
      } else if (item) {
        e.preventDefault();
        pickMenu(item.id);
      } else if (enter && !onButton) {
        e.preventDefault();
        ask({ kind: 'fight', attack: best }, 'menu');
      }
    } else if (mode === 'replace' && enter && !onButton) {
      const pick = healthiest();
      if (pick >= 0) {
        e.preventDefault();
        run({ kind: 'switch', to: pick });
      }
    } else if (mode === 'target' && enter && !onButton && pendingItem) {
      const pick = mostHurt();
      if (pick >= 0) {
        e.preventDefault();
        run({ kind: 'item', item: pendingItem, target: pick });
      }
    } else if (mode === 'end' && enter && !onButton) {
      e.preventDefault();
      finish();
    } else if ((mode === 'team' || mode === 'bag' || mode === 'target') && e.key === 'Escape') {
      setMode(mode === 'target' ? 'bag' : 'menu');
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  function pickMenu(id: string) {
    if (id === 'team') setMode('team');
    else if (id === 'bag') setMode('bag');
    else if (id === 'run') run({ kind: 'run' });
  }

  function pickItem(item: ItemId) {
    if (item === 'ball' || item === 'great-ball') ask({ kind: 'catch', ball: item }, 'bag');
    else {
      setPendingItem(item);
      setMode('target');
    }
  }

  const resultOf = (): BattleResult => {
    const outcome = battle.phase as BattleResult['outcome'];
    return {
      outcome,
      state: battle,
      team: outcome === 'lost' ? healTeam(battle.team) : battle.team,
      box: battle.box,
      bag: battle.bag,
      questions: battle.questions,
      steps: steps.current,
    };
  };
  function finish() {
    onFinish(resultOf());
  }

  // Running away needs no results page: straight back to the map.
  useEffect(() => {
    if (mode === 'end' && battle.phase === 'ran') finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const sum = mode === 'end' ? summarise(log.current) : null;
  // Worked out once when the battle ends, so the Victory page can show the prizes (the map then gives them).
  const loot = useMemo(() => (mode === 'end' && prizeFor && battle.phase !== 'ran' && battle.phase !== 'lost' ? prizeFor(resultOf()) : []), [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const bagCount = (battle.bag.potion ?? 0) + (battle.bag['super-potion'] ?? 0) + (battle.bag.ball ?? 0) + (battle.bag['great-ball'] ?? 0);
  // The painted landscape of the place or Tower, over the colour wash (which stays as the fallback). Decoration only, so a CSS background.
  const scene = scenePic(place ?? areaInfo(battle.area)?.map ?? '');
  const sceneStyle = (scene.wide ? { '--arena-wide': `url("${scene.wide}")`, '--arena-small': `url("${scene.small}")` } : undefined) as CSSProperties | undefined;

  return (
    <section className={`mb mb--area${battle.area}`} aria-label="Battle">
      {/* A tap on the battle hurries the messages along (the Next button does the same for keyboards). */}
      <div
        className={`mb-arena${scene.wide ? ' has-art' : ''}${callout && (callout.tone === 'crit' || callout.tone === 'strong' || callout.tone === 'ko') ? ' is-shaking' : ''}${fanfare && arrival ? ` is-rare-l${arrival.level}` : ''}`}
        style={sceneStyle}
        onClick={(e) => {
          if (mode === 'playing' && !(e.target as HTMLElement).closest('button, .mb-settings')) advance();
        }}
      >
        {callout && (
          <div key={`${beatIdx}-${beats.length}-${callout.text}`} className={`mb-callout mb-callout--${callout.tone}`} aria-hidden="true">
            <span>{callout.text}</span>
          </div>
        )}
        {fanfare && arrival && <ArrivalBanner arrival={arrival} />}
        {!intro && (
          <div className="mb-foe-card">
            <NameCard monster={foe} side="foe" caught={owned?.includes(foe.species)} />
          </div>
        )}
        {/* Decorative: the message already names the trainer. */}
        {intro && <img className="mb-trainer" src={trainerPic} alt="" decoding="async" draggable={false} />}
        {intro && playerPic && <img className="mb-trainer mb-trainer--you" src={playerPic} alt="" decoding="async" draggable={false} />}
        <div className={`mb-foe${foeLook === 'gone' || intro ? ' is-gone' : ''}${ball ? ' has-ball' : ''}${fanfare ? ' is-rare' : ''}`}>
          {fanfare && arrival && <ArrivalBurst arrival={arrival} />}
          <MonsterArt species={foe.species} shiny={foe.shiny} state={foeLook === 'gone' ? 'idle' : foeLook} flip />
          {ball && <span className={`mb-ball mb-ball--${ball}`} aria-hidden="true" />}
          {fx?.side === 'foe' && <AttackEffect key={fx.id} anim={fx.anim} />}
          {popsFor('foe').map((p) => (p.kind === 'crit' ? <CriticalPop key={p.id} /> : <DamageNumber key={p.id} amount={p.amount ?? 0} effect={p.effect} heal={p.kind === 'heal'} />))}
          {pops.some((p) => p.side === 'foe' && p.kind === 'num') && <HitFlash key={pops.filter((p) => p.side === 'foe').at(-1)!.id} />}
        </div>
        <div className={`mb-me${evolving ? ' is-evolving' : ''}${playerPic && intro ? ' is-gone' : ''}`}>
          <MonsterArt species={mine.species} shiny={mine.shiny} state={myLook} />
          {fx?.side === 'you' && <AttackEffect key={fx.id} anim={fx.anim} />}
          {popsFor('you').map((p) => (p.kind === 'crit' ? <CriticalPop key={p.id} /> : <DamageNumber key={p.id} amount={p.amount ?? 0} effect={p.effect} heal={p.kind === 'heal'} />))}
          {pops.some((p) => p.side === 'you' && p.kind === 'num') && <HitFlash key={pops.filter((p) => p.side === 'you').at(-1)!.id} />}
        </div>
        <div className="mb-me-card">
          <NameCard monster={mine} mine side="you" />
        </div>
        <button type="button" className="mb-gear" aria-expanded={showSettings} onClick={() => setShowSettings((s) => !s)}>
          Settings
        </button>
        {showSettings && (
          <div className="mb-settings" role="group" aria-label="Battle settings">
            <label>
              <input type="checkbox" checked={settings.calm} onChange={(e) => changeSettings({ ...settings, calm: e.target.checked })} /> Calm (no quick bonus)
            </label>
            <label>
              <input type="checkbox" checked={settings.multipleChoice} onChange={(e) => changeSettings({ ...settings, multipleChoice: e.target.checked })} /> Multiple choice
            </label>
            <button ref={chartButton} type="button" className="mb-btn mb-btn--small" onClick={() => setShowChart(true)}>
              Who is strong against who?
            </button>
          </div>
        )}
      </div>

      <div className="mb-panel">
        <p className="mb-msg" role="status" aria-live="polite" data-testid="message">
          {message}
        </p>
        {mode === 'playing' && (
          <div className="mb-actions mb-actions--next">
            {/* The bar runs down while the message plays on by itself; pressing it goes on now. */}
            <button ref={nextButton} type="button" className="mb-btn mb-btn--primary mb-next" onClick={advance}>
              {beat && timeScale > 0 && <span key={`${beatIdx}-${beats.length}`} className="mb-next__timer" style={{ animationDuration: `${beatMs(beat) * timeScale}ms` }} aria-hidden="true" />}
              <span className="mb-next__label">Next ▸</span>
            </button>
            {beats.length - beatIdx > 1 && (
              <button type="button" className="mb-btn mb-btn--small" onClick={skip}>
                Skip
              </button>
            )}
          </div>
        )}
        {mode === 'menu' && (
          <div className="mb-actions mb-actions--moves" role="group" aria-label="Choose a move">
            {attacks.map((a, i) => {
              const type = a.anim.split('-')[0];
              return (
                <button
                  key={a.name}
                  type="button"
                  className={`mb-btn mb-move mb-move--${type}${i === best ? ' is-best' : ''}`}
                  onClick={() => ask({ kind: 'fight', attack: i }, 'menu')}
                  aria-keyshortcuts={i === best ? `${i + 1} Enter Space` : String(i + 1)}
                  data-best={i === best || undefined}
                >
                  <kbd aria-hidden="true">{i + 1}</kbd>
                  {i === best && <span className="mb-move__enter" aria-hidden="true">Enter<span className="mb-move__space"> / Space</span></span>}
                  <span className="mb-move__name">{a.name}</span>
                  <span className="mb-move__power">
                    {TYPE_LABEL[type as keyof typeof TYPE_LABEL]} · power {a.power}
                  </span>
                </button>
              );
            })}
            <div className="mb-actions--menu mb-menu-row" role="group" aria-label="More">
              {menuItems.map((item) => (
                <button key={item.id} type="button" className={`mb-btn mb-btn--small mb-btn--${item.id}`} onClick={() => pickMenu(item.id)} aria-keyshortcuts={item.key.toUpperCase()}>
                  <kbd aria-hidden="true">{item.key.toUpperCase()}</kbd> {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {(mode === 'team' || mode === 'replace') && (
        <Sheet title={mode === 'replace' ? 'Choose your next monster' : 'Your team'} onBack={mode === 'team' ? () => setMode('menu') : undefined}>
          <TeamList
            team={battle.team}
            active={battle.active}
            action={(m, i) => ({ label: mode === 'replace' ? 'Send out' : 'Switch to', enabled: m.hp > 0 && (mode === 'replace' || i !== battle.active) })}
            onPick={(i) => run({ kind: 'switch', to: i })}
          />
        </Sheet>
      )}
      {mode === 'bag' && (
        <Sheet title="Your bag" onBack={() => setMode('menu')}>
          <BagList bag={battle.bag} wild={battle.kind === 'wild'} onPick={pickItem} />
          {bagCount === 0 && <p className="mb-empty">Your bag is empty.</p>}
        </Sheet>
      )}
      {mode === 'target' && pendingItem && (
        <Sheet title={`Use ${ITEM_LABEL[pendingItem]} on…`} onBack={() => setMode('bag')}>
          <TeamList
            team={battle.team}
            active={battle.active}
            action={(m) => ({ label: 'Heal', enabled: m.hp > 0 && m.hp < maxHpOf(m) })}
            onPick={(i) => run({ kind: 'item', item: pendingItem, target: i })}
          />
        </Sheet>
      )}
      {mode === 'end' && sum && battle.phase !== 'ran' && (
        <Victory
          phase={battle.phase as 'won' | 'caught' | 'lost'}
          before={start.state.team}
          after={battle.team}
          caught={sum.caught}
          questions={battle.questions}
          loot={loot}
          onLoot={() => play_('item')}
          timeScale={timeScale}
          onLevelUp={() => play_('item')}
          onContinue={finish}
        />
      )}

      {mode === 'question' && asking && (
        <QuestionModal
          question={asking.question}
          title={asking.title}
          spot={asking.action.kind === 'fight' ? 'Fight' : asking.action.kind === 'power-up' ? 'Power up' : 'Catch'}
          note={asking.note}
          timeScale={timeScale}
          onClose={() => {
            setAsking(null);
            setMode(asking.back);
          }}
          closeLabel="Back"
          // Back goes to choosing another move and no turn passes, so the skip switch leaves it alone (James).
          closeIsSkip={false}
          onSubmit={(answer, ms): MarkedAnswer => {
            const { topic, question: q } = asking;
            const marked = (topic === 'ladder' ? ladder!.pack : packOf(topic)).recordAnswer(q, answer, ms);
            // What the server needs to make the question again and mark it itself.
            answered.current = topic === 'ladder'
              ? { topic, key: q.factKey, parts: q.parts, ...(q.params ? { params: q.params } : {}), given: answer, ms: Math.round(ms), at: Date.now() }
              : {
                  topic, band: asking.band, key: q.factKey,
                  ...(q.params ? { params: q.params } : {}),
                  ...(topic === 'times-tables' ? { kind: q.kind, parts: q.parts } : {}),
                  given: answer, ms: Math.round(ms), at: Date.now(),
                };
            judged.current = judgeAnswer({ correct: marked.correct, ms, quickMs: quickMsOfReport({ topic, band: asking.band, key: q.factKey }), calm: settings.calm });
            const reward = judged.current !== 'quick-right' ? undefined
              : asking.action.kind === 'catch' ? 'Quick! Great throw!' : asking.action.kind === 'power-up' ? 'Quick! Super power up!' : 'Quick! Critical hit!';
            return { ...marked, reward };
          }}
          onDone={(marked) => run(
            (asking.action.kind === 'power-up' ? { kind: 'power-up', answer: judged.current } : { ...asking.action, answer: judged.current }) as BattleAction,
            marked.correct ? undefined : marked.fact,
            thenOf(asking.action),
          )}
        />
      )}

      {showChart && (
        <Sheet title="Strong and weak" reading onBack={closeChart}>
          <TypeChart />
        </Sheet>
      )}
    </section>
  );
}
