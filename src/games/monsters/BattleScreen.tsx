/**
 * One Maths Monsters battle, as a normal web page (not canvas). The rules come from the
 * N.2 engine (`play`); this screen asks the maths question, plays the engine's events one
 * at a time with short animations and a message box, and waits for the student to tap.
 *
 * Flow: menu (Fight / Team / Bag / Run) → question → events play (tap to go on, or Skip) →
 * back to the menu, a forced "choose your next monster", or the results sheet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Question, SkillPack } from '../../../shared/maths/skillPack';
import { makePack, type TopicId } from '../../../shared/maths/skillPacks';
import {
  activeFoe, activeMonster, healTeam, isOver, judgeAnswer, newBattle, play, questionFor,
  type Bag, type BattleAction, type BattleSetup, type BattleState, type ItemId,
} from '../../../shared/monsters/engine';
import { bandFor } from '../../../shared/monsters/bands';
import { speciesOf } from '../../../shared/monsters/monsterBook';
import type { BattleStep } from '../../../shared/monsters/save/check';
import type { QuestionReport } from '../../../shared/monsters/save/verify';
import { effectiveTopic } from '../../../shared/monsters/topics';
import { maxHpOf, type AnswerResult, type Monster } from '../../../shared/monsters/rules';
import { TYPE_LABEL } from '../../../shared/monsters/types';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { useSound } from '../../sound';
import { playSound, type GameSound } from '../sounds';
import { AttackEffect, CriticalPop, DamageNumber, EFFECT_MS, HitFlash } from './art/Effects';
import { MonsterArt, type MonsterState } from './art/MonsterArt';
import { loadMonsterSettings, saveMonsterSettings, type MonsterSettings } from './settings';
import { beatsFor, ITEM_LABEL, nameOf, type Beat } from './text';
import { BagList, NameCard, Sheet, summarise, TeamList } from './ui';
import './art/monster-art.css';
import './monsters.css';

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
  /** Tests set 0 to skip animation pauses. */
  timeScale?: number;
  /** The topics the teacher left on: a switched-off topic's questions come from the nearest topic that is on. */
  enabledTopics?: readonly TopicId[];
}

type Mode = 'playing' | 'menu' | 'fight' | 'team' | 'replace' | 'bag' | 'target' | 'question' | 'end';
type Side = 'you' | 'foe';
type FoeLook = MonsterState | 'gone';

interface Shown {
  team: Monster[];
  foes: Monster[];
  active: number;
  foeActive: number;
}

interface Asking {
  question: Question;
  topic: TopicId;
  band: number;
  title: string;
  note?: string;
  action: { kind: 'fight'; attack: number } | { kind: 'catch'; ball?: 'ball' | 'great-ball' };
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

export function BattleScreen({ setup, settings: given, onSettingsChange, onFinish, random = Math.random, packFor, timeScale = 1, enabledTopics }: BattleScreenProps) {
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

  // The opening message ("A wild Digibud appeared!").
  useEffect(() => {
    startBeats(beatsFor(start.events, setup.kind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advance() {
    if (beatIdx + 1 < beats.length) {
      setBeatIdx(beatIdx + 1);
      showBeat(beats[beatIdx + 1]);
    } else finishMove();
  }
  function skip() {
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
  function run(action: BattleAction, fact?: string) {
    const before = battle;
    const draws: number[] = [];
    const { state: next, events } = play(before, action, () => {
      const n = random();
      draws.push(n);
      return n;
    });
    steps.current.push({ action, ...(answered.current && (action.kind === 'fight' || action.kind === 'catch') ? { q: answered.current } : {}), randoms: draws });
    answered.current = null;
    move.current = { before, next, action };
    log.current.push(...events);
    setAsking(null);
    setPendingItem(null);
    setShown(shownFrom(before));
    startBeats(beatsFor(events, before.kind, fact));
  }

  function packOf(topic: TopicId) {
    let pack = packs.current.get(topic);
    if (!pack) {
      pack = (packFor ?? ((t) => makePack(t)))(topic);
      packs.current.set(topic, pack);
    }
    return pack;
  }

  /** Asks the question for a fight or catch action (the topic and band come from the engine). */
  function ask(action: Asking['action'], back: Mode) {
    const wanted = questionFor(battle, action);
    if (!wanted) return;
    // A topic the teacher switched off is swapped for the nearest one that is on (and asked at that topic's band for this place).
    const topic = effectiveTopic(wanted.topic, enabledTopics);
    const spec = topic === wanted.topic ? wanted : { topic, band: bandFor(topic, battle.area, battle.far) };
    const question = packOf(spec.topic).nextQuestion({ level: spec.band, multipleChoice: settings.multipleChoice });
    const answerless = (r: AnswerResult) => ({ ...action, answer: r }) as BattleAction;
    if (!question) return run(answerless('right')); // nothing can be asked: never block the battle
    const title = action.kind === 'fight' ? speciesOf(activeMonster(battle).species).attacks[action.attack].name : `Catch ${nameOf(activeFoe(battle).species)}`;
    const note = action.kind === 'catch'
      ? 'A right answer makes the catch much more likely'
      : settings.calm ? undefined : 'A quick right answer hits extra hard';
    setAsking({ question, topic: spec.topic, band: spec.band, title, note, action, back });
    setMode('question');
  }

  const mine = shown.team[shown.active];
  const foe = shown.foes[shown.foeActive];
  const foeIsTrainer = battle.kind === 'trainer';
  const message = mode === 'playing' ? beats[beatIdx]?.text ?? '' : mode === 'menu' ? `What will ${nameOf(mine.species)} do?` : mode === 'fight' ? 'Choose a move.' : mode === 'replace' ? 'Choose your next monster.' : '';
  const popsFor = (side: Side) => pops.filter((p) => p.side === side);

  // Keep the Next button ready for the Enter or Space key.
  useEffect(() => {
    if (mode === 'playing') nextButton.current?.focus();
  }, [mode, beatIdx]);

  // Number keys 1-4 for the menu and the moves; Escape goes back.
  const menuItems = useMemo(
    () => [
      { id: 'fight', label: 'Fight' },
      { id: 'team', label: 'Team' },
      { id: 'bag', label: 'Bag' },
      ...(foeIsTrainer ? [] : [{ id: 'run', label: 'Run' }]),
    ],
    [foeIsTrainer],
  );
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const n = Number(e.key);
    if (mode === 'menu' && n >= 1 && n <= menuItems.length) {
      e.preventDefault();
      pickMenu(menuItems[n - 1].id);
    } else if (mode === 'fight') {
      const attacks = speciesOf(activeMonster(battle).species).attacks;
      if (n >= 1 && n <= attacks.length) {
        e.preventDefault();
        ask({ kind: 'fight', attack: n - 1 }, 'fight');
      } else if (e.key === 'Escape') setMode('menu');
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
    if (id === 'fight') setMode('fight');
    else if (id === 'team') setMode('team');
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

  function finish() {
    const outcome = battle.phase as BattleResult['outcome'];
    onFinish({
      outcome,
      state: battle,
      team: outcome === 'lost' ? healTeam(battle.team) : battle.team,
      box: battle.box,
      bag: battle.bag,
      questions: battle.questions,
      steps: steps.current,
    });
  }

  const attacks = speciesOf(activeMonster(battle).species).attacks;
  const sum = mode === 'end' ? summarise(log.current) : null;
  const bagCount = (battle.bag.potion ?? 0) + (battle.bag['super-potion'] ?? 0) + (battle.bag.ball ?? 0) + (battle.bag['great-ball'] ?? 0);

  return (
    <section className={`mb mb--area${battle.area}`} aria-label="Battle">
      <div className="mb-arena">
        <div className="mb-foe-card">
          <NameCard monster={foe} side="foe" />
        </div>
        <div className={`mb-foe${foeLook === 'gone' ? ' is-gone' : ''}${ball ? ' has-ball' : ''}`}>
          <MonsterArt species={foe.species} shiny={foe.shiny} state={foeLook === 'gone' ? 'idle' : foeLook} flip />
          {ball && <span className={`mb-ball mb-ball--${ball}`} aria-hidden="true" />}
          {fx?.side === 'foe' && <AttackEffect key={fx.id} anim={fx.anim} />}
          {popsFor('foe').map((p) => (p.kind === 'crit' ? <CriticalPop key={p.id} /> : <DamageNumber key={p.id} amount={p.amount ?? 0} effect={p.effect} heal={p.kind === 'heal'} />))}
          {pops.some((p) => p.side === 'foe' && p.kind === 'num') && <HitFlash key={pops.filter((p) => p.side === 'foe').at(-1)!.id} />}
        </div>
        <div className={`mb-me${evolving ? ' is-evolving' : ''}`}>
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
          </div>
        )}
      </div>

      <div className="mb-panel">
        <p className="mb-msg" role="status" aria-live="polite" data-testid="message">
          {message}
        </p>
        {mode === 'playing' && (
          <div className="mb-actions mb-actions--next">
            <button ref={nextButton} type="button" className="mb-btn mb-btn--primary" onClick={advance}>
              Next ▸
            </button>
            {beats.length - beatIdx > 1 && (
              <button type="button" className="mb-btn mb-btn--small" onClick={skip}>
                Skip
              </button>
            )}
          </div>
        )}
        {mode === 'menu' && (
          <div className="mb-actions mb-actions--menu" role="group" aria-label="Choose what to do">
            {menuItems.map((item, i) => (
              <button key={item.id} type="button" className={`mb-btn mb-btn--${item.id}`} onClick={() => pickMenu(item.id)} aria-keyshortcuts={String(i + 1)}>
                <kbd aria-hidden="true">{i + 1}</kbd> {item.label}
              </button>
            ))}
          </div>
        )}
        {mode === 'fight' && (
          <div className="mb-actions mb-actions--moves" role="group" aria-label="Choose a move">
            {attacks.map((a, i) => {
              const type = a.anim.split('-')[0];
              return (
                <button key={a.name} type="button" className={`mb-btn mb-move mb-move--${type}`} onClick={() => ask({ kind: 'fight', attack: i }, 'fight')} aria-keyshortcuts={String(i + 1)}>
                  <kbd aria-hidden="true">{i + 1}</kbd>
                  <span className="mb-move__name">{a.name}</span>
                  <span className="mb-move__power">
                    {TYPE_LABEL[type as keyof typeof TYPE_LABEL]} · power {a.power}
                  </span>
                </button>
              );
            })}
            <button type="button" className="mb-btn mb-btn--small mb-back" onClick={() => setMode('menu')}>
              Back
            </button>
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
      {mode === 'end' && sum && (
        <Sheet title={battle.phase === 'won' ? 'You won!' : battle.phase === 'caught' ? 'Caught!' : battle.phase === 'ran' ? 'Got away!' : 'Your team is tired'}>
          <div className="mb-end">
            {battle.phase === 'lost' && <p>Your monsters are all tired, so you hurry back to rest. They’re healed, and you keep everything.</p>}
            {battle.phase === 'ran' && <p>You got away safely.</p>}
            {sum.caught && (
              <p className="mb-end__caught">
                <MonsterArt species={sum.caught} size={84} still /> {nameOf(sum.caught)} is yours!
              </p>
            )}
            {sum.exp.length > 0 && (
              <ul>
                {sum.exp.map(([id, amount]) => (
                  <li key={id}>
                    {nameOf(id)} gained {amount} exp.
                  </li>
                ))}
              </ul>
            )}
            {sum.levels.length > 0 && (
              <ul>
                {sum.levels.map((l) => (
                  <li key={l}>{l}!</li>
                ))}
              </ul>
            )}
            {sum.evolved.map((e) => (
              <p key={e.to} className="mb-end__evo">
                <MonsterArt species={e.from} size={64} still /> → <MonsterArt species={e.to} size={84} still /> {nameOf(e.from)} grew into {nameOf(e.to)}!
              </p>
            ))}
            <p>
              You answered {battle.questions} question{battle.questions === 1 ? '' : 's'}.
            </p>
            <button type="button" className="mb-btn mb-btn--primary" onClick={finish} autoFocus>
              Continue
            </button>
          </div>
        </Sheet>
      )}

      {mode === 'question' && asking && (
        <QuestionModal
          question={asking.question}
          title={asking.title}
          note={asking.note}
          timeScale={timeScale}
          onClose={() => {
            setAsking(null);
            setMode(asking.back);
          }}
          closeLabel="Back"
          onSubmit={(answer, ms): MarkedAnswer => {
            const marked = packOf(asking.topic).recordAnswer(asking.question, answer, ms);
            answered.current = {
              topic: asking.topic, band: asking.band, key: asking.question.factKey,
              ...(asking.question.params ? { params: asking.question.params } : {}),
              ...(asking.topic === 'times-tables' ? { kind: asking.question.kind } : {}),
              given: answer, ms: Math.round(ms), at: Date.now(),
            };
            judged.current = judgeAnswer({ correct: marked.correct, ms, topic: asking.topic, band: asking.band, calm: settings.calm });
            const reward = judged.current === 'quick-right' ? (asking.action.kind === 'catch' ? 'Quick! Great throw!' : 'Quick! Critical hit!') : undefined;
            return { ...marked, reward };
          }}
          onDone={(marked) => run({ ...asking.action, answer: judged.current } as BattleAction, marked.correct ? undefined : marked.fact)}
        />
      )}
    </section>
  );
}
