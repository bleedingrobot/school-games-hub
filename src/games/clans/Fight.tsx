/**
 * A mine fight. Pure display on top of shared/clans: the engine plays each round, this shows who
 * is up, takes the orders and the Battle Cry answer, and writes the log in plain gentle words.
 * Each round starts with a suggested plan (one order per member, the bot's choice). Enter fights with it; 1-9 changes
 * one member's order first. Changing an order: A attack, S spell, G guard, R run, P healing potion (monster fights), 1-9 to pick, Esc back to the plan.
 * The round then plays out one action at a time (Enter or a tap skips), and a one-line summary waits for Enter.
 *
 * In a ladder fight (the server gave it questions) the Battle Cry is the child's own maths, shown in the hub's question
 * box and marked by the server (`onCheck`); the marks it gives back decide each round's bonus, just as on the server.
 */
import { useEffect, useRef, useState } from 'react';
import { fightOf, type ShownFight } from '../../../shared/clans/actions';
import { markCry, nextCryQuestion, playCryRound, type CryAnswer, type CryMark, type CryReward, type FightMaths, type RecordedRound } from '../../../shared/clans/battleCry';
import { maxRoundsOf, type FightState, type Order } from '../../../shared/clans/fight';
import { MONSTER_LOOKS } from '../../../shared/clans/monster';
import { CONFIG } from '../../../shared/clans/config';
import { SPELLS } from '../../../shared/clans/spells';
import type { Member } from '../../../shared/clans/types';
import type { PracticalQuestion } from '../../../shared/maths/practical';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { PracticalAsk, Working } from '../../maths/PracticalAsk';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import { ACTION_HELP, spellHelp } from './abilities';
import { Bar } from './Bars';
import { MonsterArt } from './MonsterArt';
import { castable, choosingOrder, describe, fightsLabel, isAlive, labelDuplicates, orderText, suggestedPlan } from './fightView';
import { MonsterSprite, Portrait } from './Sprite';
import { bestHit, roundSteps, roundSummary, stepMs, type BestHit, type Step, type Who } from './playback';
import { zoneColour } from './Sprite';
import { MONSTERS_BY_NAME } from './monsters';
import { fxArt, sceneArt, zoneScene, type FxId } from './art';
import { lookOf } from '../../../shared/clans/looks';
import { nextSeed, type Session } from './session';

type Phase = 'ask' | 'reward' | 'working' | 'orders' | 'replay' | 'summary' | 'over';

/** A round being shown: its steps, how many are shown, the fight after it, and its summary line. */
interface Replay {
  steps: Step[];
  at: number;
  after: FightState;
  summary: string;
  /** The Battle Cry this round, if one was earned: the clan glows while it plays. */
  cry: 'damage' | 'heal' | null;
}

/** The server's answer to a ladder Battle Cry: was it right, the right answer (to show when it wasn't), and the answer it marked. */
export interface CryChecked {
  correct: boolean;
  answer: number;
  /** The first answer sent for this question: a second try (after a refresh or a dropped connection) is marked as the first. */
  given: number;
}

/** How many actions a floating number stays for (it floats away in about 0.9 seconds). */
const FLOAT_STEPS = 3;

const BATTLE_CRY_NOTE = 'A right answer powers up the whole clan. No timer, nothing lost.';

const shown = (q: PublicQuestion): ShownQuestion => ({ id: q.slot, parts: q.parts, spoken: q.spoken, prompt: q.prompt, choices: q.choices, choiceLabels: q.choiceLabels, maxLength: q.maxLength, input: q.input });
type Mode = 'action' | 'spell' | 'target';

/**
 * With a server, `open` is the fight the server started (it picked the monsters): this plays it from where the server
 * has it (a refresh shows the same fight, round for round), and `onRound` hands each round played back to be sent.
 * Without one (the test page) the fight starts here and nothing is sent.
 * `onCheck` marks a ladder fight's Battle Cry answer on the server (it rejects if the server can't be reached).
 */
export function Fight({ session, boss = false, open, onRound, onCheck, onFinish }: {
  session: Session; boss?: boolean; open?: ShownFight; onRound?: (round: number, played: RecordedRound) => void;
  onCheck?: (round: number, answer: number, ms: number) => Promise<CryChecked>; onFinish: (fight: FightState) => void;
}) {
  const members: Member[] = session.clan.members;
  const clanNames = useRef(new Set(members.map((m) => m.name))).current;
  const settings = open?.settings ?? session.settings;
  // A ladder fight's questions, and the server's marks so far (a ref, so a round played straight after a check sees its mark).
  const ladder = open?.questions && onCheck ? open.questions : null;
  const marks = useRef<(CryMark | null)[]>([...(open?.marks ?? [])]);
  const maths = (): FightMaths => ({ settings, questions: open?.questions, marks: marks.current });
  const [boot] = useState(() => {
    if (!open) return { fight: labelDuplicates(fightOf(members, { depth: session.depth, seed: nextSeed(session), boss })), lines: ['A fight begins!'] };
    // Rebuild the fight the server has, by playing back the rounds it has kept.
    const start = labelDuplicates(fightOf(members, open));
    const lines = ['A fight begins!'];
    let fight = start;
    for (const r of open.rounds) {
      const next = structuredClone(fight);
      const before = next.log.length;
      playCryRound(next, { settings: open.settings, questions: open.questions, marks: open.marks }, r.orders, r.cry);
      // The same lines the round showed when it was played.
      lines.push(`Round ${next.round}`, ...roundSteps(fight, next, before, clanNames).map((st) => st.line));
      fight = next;
    }
    return { fight, lines };
  });
  const [fight, setFight] = useState<FightState>(boot.fight);
  const [phase, setPhase] = useState<Phase>('orders');
  const [question, setQuestion] = useState<PracticalQuestion | null>(null);
  const [ladderQuestion, setLadderQuestion] = useState<PublicQuestion | null>(null);
  const [given, setGiven] = useState<CryAnswer | null>(null);
  const [pendingAnswer, setPendingAnswerState] = useState<number | null>(null);
  // The question box reports back after its feedback pause, so the answer is kept in a ref as well as state.
  const pendingAnswerRef = useRef<number | null>(null);
  const setPendingAnswer = (answer: number | null) => {
    pendingAnswerRef.current = answer;
    setPendingAnswerState(answer);
  };
  // This round's plan (one order per clan slot), the members in choosing order, and whose order is being changed.
  const [plan, setPlan] = useState<Order[]>([]);
  const [seq, setSeq] = useState<number[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('action');
  const [spell, setSpell] = useState<number | null>(null);
  // Monster fights: choosing who gets a healing potion.
  const [potion, setPotion] = useState(false);
  const [log, setLog] = useState<string[]>(boot.lines);
  const [replay, setReplay] = useState<Replay | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const logEnd = useRef<HTMLLIElement>(null);

  // The first round starts when the fight does; the next ones start after each round is played.
  const startRound = (f: FightState) => {
    if (f.result) return setPhase('over');
    // Round f.round + 1 is next: a ladder fight's question for it is number f.round in the list.
    const lq = ladder ? ladder[f.round] ?? null : null;
    const q = ladder ? null : nextCryQuestion(f, settings);
    setSeq(choosingOrder(f));
    setPlan(suggestedPlan(f));
    setEditing(null);
    setMode('action');
    setGiven(null);
    setQuestion(q);
    setLadderQuestion(lq);
    // Already answered (the page was reloaded after the answer, before the round): carry on from the server's mark.
    const marked = lq ? marks.current[f.round] : null;
    if (marked) {
      setPendingAnswer(marked.answer);
      if (marked.correct) return setPhase('reward');
      setGiven({ answer: marked.answer, reward: 'damage' });
      return setPhase('orders');
    }
    setPhase(q || lq ? 'ask' : 'orders');
  };
  useEffect(() => {
    startRound(fight);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // The orders and the reward are answered with letter keys, so the panel takes focus. The question, "how it works" and "over" have their own focus (the box or an autofocused button).
    if (phase === 'orders' || phase === 'reward' || phase === 'replay' || phase === 'summary') panel.current?.focus();
  }, [phase, editing, mode]);
  // Braces matter: newer Chrome's scrollIntoView gives back a promise, and React would try to call it as the clean-up.
  useEffect(() => {
    logEnd.current?.scrollIntoView?.({ block: 'nearest' });
  }, [log]);

  // ---- the Battle Cry
  const submitCry = (answer: number) => {
    if (!question) return;
    const right = markCry(question, { answer, reward: 'damage' }).correct;
    setPendingAnswer(answer);
    if (right) setPhase('reward');
    else {
      setGiven({ answer, reward: 'damage' });
      setPhase('working');
    }
  };
  const noThanks = () => {
    setGiven(null);
    setPhase('working');
  };
  // A ladder question: the server marks it, and the question box shows "Correct!" or the right answer itself.
  const checkLadder = async (answer: number, ms: number): Promise<MarkedAnswer> => {
    const round = fight.round + 1;
    const checked = await onCheck!(round, answer, ms);
    // The server's mark, so this page plays the round exactly as the server will.
    marks.current[round - 1] = { answer: checked.given, correct: checked.correct };
    setPendingAnswer(checked.given);
    const q = ladderQuestion;
    const label = q?.choices && q.choiceLabels ? q.choiceLabels[q.choices.indexOf(checked.answer)] ?? String(checked.answer) : String(checked.answer);
    return { correct: checked.correct, fact: `The answer was ${label}.`, boxBefore: 0, boxAfter: 0, answer: checked.answer };
  };
  const ladderDone = (result: MarkedAnswer) => {
    if (result.correct) return setPhase('reward');
    setGiven({ answer: pendingAnswerRef.current, reward: 'damage' });
    setPhase('orders');
  };
  const ladderNoThanks = () => {
    setGiven(null);
    setPhase('orders');
  };
  const chooseReward = (reward: CryReward) => {
    setGiven({ answer: pendingAnswer, reward });
    setPhase('orders');
  };

  // ---- the orders
  const who = editing !== null ? fight.clan[editing] : undefined;
  const alive = fight.enemies.filter(isAlive);

  function play(all: Order[]) {
    const next = structuredClone(fight);
    const before = next.log.length;
    playCryRound(next, maths(), all, given);
    onRound?.(next.round, { orders: all, cry: given });
    // Show it one action at a time; the log gets each line as it happens.
    setLog((l) => [...l, `Round ${next.round}`]);
    const cry = next.log.slice(before).find((e) => e.type === 'cry');
    setReplay({ steps: roundSteps(fight, next, before, clanNames), at: 0, after: next, summary: roundSummary(next, before, clanNames).text, cry: cry?.type === 'cry' ? cry.kind : null });
    setPhase('replay');
  }
  // Every action shown (or skipped): the fight moves on, and the summary waits for Enter.
  function endReplay(r: Replay) {
    setLog((l) => [...l, ...r.steps.slice(r.at).map((st) => st.line)]);
    setReplay({ ...r, at: r.steps.length });
    setFight(r.after);
    setPhase(r.after.result ? 'over' : 'summary');
    if (r.after.result === 'won') setFlourish(true);
  }
  // The win flourish shows for a moment over the fighters, then gets out of the way.
  const [flourish, setFlourish] = useState(false);
  useEffect(() => {
    if (!flourish) return;
    const timer = setTimeout(() => setFlourish(false), 1800);
    return () => clearTimeout(timer);
  }, [flourish]);
  useEffect(() => {
    if (phase !== 'replay' || !replay) return;
    if (replay.at >= replay.steps.length) return endReplay(replay);
    const timer = setTimeout(() => {
      setLog((l) => [...l, replay.steps[replay.at].line]);
      setReplay({ ...replay, at: replay.at + 1 });
    }, replay.at === 0 ? 150 : stepMs(replay.steps.length));
    return () => clearTimeout(timer);
  }, [phase, replay]); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = () => {
    if (phase === 'replay' && replay) endReplay(replay);
  };
  const nextRound = () => {
    setReplay(null);
    startRound(fight);
  };
  // Back to the plan, with or without a changed order.
  function backToPlan() {
    setEditing(null);
    setMode('action');
    setSpell(null);
    setPotion(false);
  }
  function choose(order: Order) {
    if (editing === null) return;
    const all = [...plan];
    all[editing] = order;
    setPlan(all);
    backToPlan();
  }
  const pickAttack = () => (alive.length === 1 ? choose({ action: 'attack', target: alive[0].index }) : setMode('target'));
  const goTarget = (index: number) => {
    if (potion) choose({ action: 'potion', target: index });
    else if (spell !== null) choose({ action: 'spell', spell, target: index });
    else choose({ action: 'attack', target: index });
  };
  const spells = who ? castable(who) : [];
  const knowsSpells = !!who && who.spells.some((id) => SPELLS[id] && !SPELLS[id].notYet);
  const spellNote = spells.length ? ACTION_HELP.spell : knowsSpells ? 'Not enough SP right now.' : 'Knows no spells.';
  const help = (text: string) => <small className="cq-btn__help">{text}</small>;
  // Healing potions still free for this member: the clan's potions less the ones other members' orders already use this round.
  const potionsLeft = (fight.monster?.potions ?? 0) - plan.filter((o, i) => o?.action === 'potion' && i !== editing).length;
  const canPotion = !!fight.monster && potionsLeft > 0 && fight.clan.some(isAlive);
  const targets = potion || (spell !== null && SPELLS[spell].friendly) ? fight.clan.filter(isAlive) : alive;
  const toTarget = (forPotion: boolean) => {
    setPotion(forPotion);
    setMode('target');
  };

  function keys(event: React.KeyboardEvent) {
    if ((phase === 'replay' || phase === 'summary') && (event.key === 'Enter' || event.key === ' ') && !(event.target instanceof HTMLButtonElement)) {
      if (phase === 'replay') skip();
      else nextRound();
      return event.preventDefault();
    }
    if (phase === 'reward') {
      if (event.key === 'd') chooseReward('damage');
      else if (event.key === 'h') chooseReward('heal');
      else return;
      return event.preventDefault();
    }
    if (phase !== 'orders') return;
    const k = event.key.toLowerCase();
    if (!who) {
      const change = seq[Number(k) - 1];
      if (change !== undefined) setEditing(change);
      else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) play(plan);
      else return;
    } else if (mode === 'action') {
      if (k === 'a') pickAttack();
      else if (k === 's' && spells.length) setMode('spell');
      else if (k === 'p' && canPotion) toTarget(true);
      else if (k === 'g') choose({ action: 'guard' });
      else if (k === 'r') choose({ action: 'run' });
      else if (event.key === 'Escape') backToPlan();
      else return;
    } else if (mode === 'spell') {
      const s = spells[Number(k) - 1];
      if (s) {
        setSpell(s.id);
        setMode('target');
      } else if (event.key === 'Escape') setMode('action');
      else return;
    } else if (mode === 'target') {
      const t = targets[Number(k) - 1];
      if (t) goTarget(t.index);
      else if (event.key === 'Escape') {
        setSpell(null);
        setPotion(false);
        setMode('action');
      } else return;
    }
    event.preventDefault();
  }

  // While a round plays out: everyone's HP as of the last action shown, who is acting, and who it lands on.
  const shownStep = phase === 'replay' && replay && replay.at > 0 ? replay.steps[replay.at - 1] : undefined;
  const hpOf = (w: Who, hp: number) => (phase === 'replay' ? (shownStep?.hp[w] ?? hp) : hp);
  const effect = (w: Who) => {
    if (!replay || replay.at === 0) return { cls: '', float: null, burst: null };
    const hit = shownStep?.targets.find((t) => t.who === w);
    const struck = hit ? (hit.dodge ? 'is-dodge' : hit.big ? 'is-hit is-big-hit' : 'is-hit') : '';
    let cls = shownStep ? `${shownStep.actor === w ? 'is-acting' : ''} ${struck} ${hit?.down ? 'is-toppling' : ''}` : '';
    // A number or a burst takes about a second to fade, longer than an action, so the last few actions' stay.
    const from = Math.max(0, replay.at - FLOAT_STEPS);
    const recent = replay.steps.slice(from, replay.at).map((st, n) => ({ st, key: from + n, t: st.targets.find((t) => t.who === w) }));
    if (recent.some((r) => r.t?.close)) cls += ' is-close';
    const fiery = (st: Step) => replay.cry === 'damage' && st.actor?.startsWith('c');
    const float = recent.flatMap(({ st, key, t }) =>
      t?.float ? [<span key={key} className={`cq-float cq-float--${t.float.kind} ${fiery(st) && t.float.kind !== 'miss' ? 'is-fiery' : ''}`}>{t.float.text}</span>] : [],
    );
    const burst = recent.flatMap(({ key, t }) => (t?.burst ? [<Burst key={key} id={t.burst} />] : []));
    return {
      cls,
      float: float.length ? <span className="cq-floats" aria-hidden="true">{float}</span> : null,
      burst: burst.length ? <span className="cq-bursts" aria-hidden="true">{burst}</span> : null,
    };
  };
  const bump = shownStep?.targets.some((t) => t.big);
  const upNext = phase === 'orders' && who ? who.index : -1;
  const planning = phase === 'orders' && !who;
  // The mine zone the monsters come from, painted dimly behind them (Clans art Stage A.6).
  const zone = MONSTERS_BY_NAME[fight.enemies[0]?.name.replace(/ [A-D]$/, '') ?? '']?.zone ?? 'Meadow';
  const zoneArt = sceneArt(zoneScene(zone)).small;
  const look = fight.monster ? MONSTER_LOOKS[fight.monster.kind] : null;
  // The last thing in the log is the monster getting ready: the big move comes next round.
  const warned = !!look && phase !== 'replay' && !fight.result && fight.log[fight.log.length - 1]?.type === 'warn';
  return (
    <section className="cq-fight" aria-label="The fight">
      <p className="cq-fight__top">
        <strong>{look ? 'The monster attacks!' : `Depth ${fight.depth}`}</strong> · Round {Math.min(fight.round + (fight.result || phase === 'summary' ? 0 : 1), maxRoundsOf(fight))}{look ? ` of ${maxRoundsOf(fight)}` : <> · Fights today: {fightsLabel(session.fightsLeft, session.fightsPerDay)}</>}
      </p>
      <div className={`cq-arena ${bump ? 'is-bump' : ''}`} onClick={skip}>
        {flourish && <Victory />}
        <ul className="cq-side cq-side--enemies" aria-label="Enemies" data-zone={zone} style={zoneArt ? ({ '--cq-zone': `url(${zoneArt})` } as React.CSSProperties) : undefined}>
          {fight.enemies.map((e) => {
            const hp = hpOf(`e${e.index}`, e.hp);
            const fx = effect(`e${e.index}`);
            return (
            <li key={e.index} className={`${hp > 0 ? '' : 'is-down'} ${fx.cls}`}>
              {fx.burst}
              {fx.float}
              {look ? (
                <>
                  <MonsterArt kind={fight.monster!.kind} size="small" />
                  <span className="cq-name">{look.name}</span>
                </>
              ) : (
                <>
                  <MonsterSprite name={e.name.replace(/ [A-D]$/, '')} zone={MONSTERS_BY_NAME[e.name.replace(/ [A-D]$/, '')]?.zone ?? 'Meadow'} scale={3} />
                  <span className="cq-name" style={{ color: zoneColour(MONSTERS_BY_NAME[e.name.replace(/ [A-D]$/, '')]?.zone ?? 'Meadow') }}>
                    {e.name}
                  </span>
                </>
              )}
              <Bar label="HP" value={hp} max={e.maxHp} kind="hp" ghost />
              {hp <= 0 && <span className="cq-stamp">Beaten!</span>}
            </li>
            );
          })}
        </ul>
        <ul className={`cq-side cq-side--clan ${phase === 'replay' && replay?.cry ? `is-cry is-cry--${replay.cry}` : ''}`} aria-label="Your clan">
          {fight.clan.map((f, i) => {
            const hp = hpOf(`c${f.index}`, f.hp);
            const fx = effect(`c${f.index}`);
            return (
            <li key={f.index} className={`${hp > 0 ? '' : 'is-down'} ${upNext === f.index ? 'is-up' : ''} ${fx.cls}`} aria-current={upNext === f.index ? 'true' : undefined}>
              {fx.burst}
              {fx.float}
              <Portrait race={members[i].race} cls={members[i].cls} look={lookOf(members[i])} scale={3} />
              <span className="cq-name">{f.name}</span>
              <Bar label="HP" value={hp} max={f.maxHp} kind="hp" ghost />
              {f.maxSp > 0 && <Bar label="SP" value={f.sp} max={f.maxSp} kind="sp" />}
              {upNext === f.index && <span className="cq-tag cq-tag--up">Up next</span>}
              {hp <= 0 && <span className="cq-tag">resting</span>}
            </li>
            );
          })}
        </ul>
      </div>
      {warned && fight.log[fight.log.length - 1].type === 'warn' && (
        <p className="cq-warning" role="status">
          <strong>{describe(fight.log[fight.log.length - 1], clanNames)}</strong> The big move comes next round. Guard to take half the damage!
        </p>
      )}
      {look && fight.monster && fight.monster.potions > 0 && <p className="cq-soft">Healing potions: {fight.monster.potions}</p>}
      <div className="cq-lower">
        <div className="cq-panel" ref={panel} tabIndex={-1} onKeyDown={keys} role="group" aria-label={phase === 'ask' ? 'Battle Cry question' : phase === 'reward' ? 'Battle Cry reward' : phase === 'working' ? 'How the answer works' : phase === 'orders' && who ? `Orders for ${who.name}` : planning ? 'The plan for this round' : phase === 'replay' ? `Round ${replay?.after.round ?? ''}` : phase === 'summary' ? 'What happened' : 'The fight is over'}>
          {phase === 'replay' && (
            <div className="cq-choice">
              <h3>Round {replay?.after.round}…</h3>
              <button type="button" className="cq-btn" onClick={skip}>
                <kbd>Enter</kbd> Skip
                {help('Show the whole round now.')}
              </button>
            </div>
          )}
          {phase === 'summary' && replay && (
            <div className="cq-choice">
              <p className="cq-summary" role="status">{replay.summary}</p>
              <button type="button" className="cq-btn cq-btn--hot" onClick={nextRound}>
                <kbd>Enter</kbd> Next round
              </button>
            </div>
          )}
          {phase === 'ask' && question && (
            <PracticalAsk question={question} title="Battle Cry!" note={BATTLE_CRY_NOTE} onSubmit={submitCry} onNoThanks={noThanks} />
          )}
          {phase === 'ask' && ladderQuestion && (
            <QuestionModal question={shown(ladderQuestion)} title="Battle Cry!" note={BATTLE_CRY_NOTE} onSubmit={checkLadder} onDone={ladderDone} onClose={ladderNoThanks} closeLabel="No thanks" />
          )}
          {phase === 'reward' && (
            <div className="cq-choice">
              <h3>Right! Spend your Battle Cry on…</h3>
              <div className="cq-actions">
                <button type="button" className="cq-btn cq-btn--hot" onClick={() => chooseReward('damage')}>
                  <kbd>D</kbd> More damage this round
                </button>
                <button type="button" className="cq-btn cq-btn--hot" onClick={() => chooseReward('heal')}>
                  <kbd>H</kbd> A little healing for everyone
                </button>
              </div>
            </div>
          )}
          {phase === 'working' && question && (
            <div className="cq-choice">
              <h3>{given ? 'Not quite. Here is how it works:' : 'No problem. Here is how it works:'}</h3>
              <Working question={question} />
              <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => setPhase('orders')}>
                Carry on
              </button>
            </div>
          )}
          {planning && (
            <div className="cq-choice">
              <h3>The plan for this round</h3>
              <div className="cq-actions">
                {seq.map((i, n) => (
                  <button type="button" key={i} className="cq-btn" aria-label={`Change ${fight.clan[i].name}: ${orderText(plan[i], fight)}`} onClick={() => setEditing(i)}>
                    <kbd>{n + 1}</kbd> {fight.clan[i].name}: {orderText(plan[i], fight)}
                    {help('Change')}
                  </button>
                ))}
                <button type="button" className="cq-btn cq-btn--hot" onClick={() => play(plan)}>
                  <kbd>Enter</kbd> Fight with this plan
                  {help(ACTION_HELP.plan)}
                </button>
              </div>
            </div>
          )}
          {phase === 'orders' && who && (
            <div className="cq-choice">
              <h3>
                {who.name}: {mode === 'action' ? 'what will they do?' : mode === 'spell' ? 'which spell?' : potion ? 'give a healing potion to…' : spell !== null ? `cast ${SPELLS[spell].name} on…` : 'attack…'}
              </h3>
              {mode === 'action' && (
                <div className="cq-actions">
                  <button type="button" className="cq-btn" onClick={pickAttack}>
                    <kbd>A</kbd> Attack
                    {help(ACTION_HELP.attack)}
                  </button>
                  <button type="button" className="cq-btn" disabled={!spells.length} onClick={() => setMode('spell')}>
                    <kbd>S</kbd> Spell
                    {help(spellNote)}
                  </button>
                  <button type="button" className="cq-btn" onClick={() => choose({ action: 'guard' })}>
                    <kbd>G</kbd> Guard
                    {help(ACTION_HELP.guard)}
                  </button>
                  {canPotion && (
                    <button type="button" className="cq-btn" onClick={() => toTarget(true)}>
                      <kbd>P</kbd> Healing potion <small>({potionsLeft} left)</small>
                      {help(ACTION_HELP.potion(Math.round(CONFIG.monster.potionHeal * 100)))}
                    </button>
                  )}
                  <button type="button" className="cq-btn" onClick={() => choose({ action: 'run' })}>
                    <kbd>R</kbd> Run
                    {help(ACTION_HELP.run)}
                  </button>
                  <button type="button" className="cq-btn" onClick={backToPlan}>
                    <kbd>Esc</kbd> Keep the plan
                    {help(ACTION_HELP.keep)}
                  </button>
                </div>
              )}
              {mode === 'spell' && (
                <div className="cq-actions">
                  {spells.map((s, i) => (
                    <button type="button" key={s.id} className="cq-btn" onClick={() => { setSpell(s.id); setMode('target'); }}>
                      <kbd>{i + 1}</kbd> {s.name} <small>({s.sp} SP)</small>
                      {help(spellHelp(s, { level: who.level, wisdom: who.stats.wisdom }))}
                    </button>
                  ))}
                  <button type="button" className="cq-btn" onClick={() => setMode('action')}>
                    <kbd>Esc</kbd> Back
                  </button>
                </div>
              )}
              {mode === 'target' && (
                <div className="cq-actions">
                  {targets.map((t, i) => (
                    <button type="button" key={t.index} className="cq-btn" onClick={() => goTarget(t.index)}>
                      <kbd>{i + 1}</kbd> {t.name} <small>({t.hp} HP)</small>
                    </button>
                  ))}
                  <button type="button" className="cq-btn" onClick={() => { setSpell(null); setPotion(false); setMode('action'); }}>
                    <kbd>Esc</kbd> Back
                  </button>
                </div>
              )}
            </div>
          )}
          {phase === 'over' && <FightOver fight={fight} look={look} summary={replay?.summary} best={bestHit(fight, clanNames)} today={`${session.clan.name}|${session.day}`} onFinish={() => onFinish(fight)} />}
        </div>
        <ol className="cq-log" aria-label="Fight log" aria-live="polite" aria-relevant="additions">
          {log.map((line, i) => (
            <li key={i} className={`${/^Round \d+$/.test(line) ? 'cq-log__round' : ''} ${phase === 'replay' && i === log.length - 1 && replay && replay.at > 0 ? 'is-now' : ''}`.trim() || undefined}>
              {line}
            </li>
          ))}
          <li ref={logEnd} aria-hidden="true" />
        </ol>
      </div>
    </section>
  );
}

/** A spell's light or a big hit's gold burst over a fighter: the painting, or a CSS glow without one. */
function Burst({ id }: { id: FxId }) {
  const art = fxArt(id);
  return <span className={`cq-burst cq-burst--${id} ${art ? 'is-painted' : ''}`} style={art ? ({ backgroundImage: `url(${art})` } as React.CSSProperties) : undefined} />;
}

/** The win flourish: the gold crest and "Victory!" over the fighters for a moment. */
function Victory() {
  const art = fxArt('victory');
  return (
    <div className="cq-victory" aria-hidden="true">
      {art && <img src={art} alt="" />}
      <strong>Victory!</strong>
    </div>
  );
}

/**
 * The clan's best hit today, kept on this device only (it's just for fun: nothing counts it). `today` is the clan and
 * the game day, so a new day starts fresh.
 */
const BEST_KEY = 'clans-best-hit';
function readBest(today: string): BestHit | null {
  try {
    const saved = JSON.parse(localStorage.getItem(BEST_KEY) ?? 'null') as (BestHit & { today: string }) | null;
    return saved?.today === today ? saved : null;
  } catch {
    return null;
  }
}

function FightOver({ fight, look, summary, best, today, onFinish }: { fight: FightState; look: (typeof MONSTER_LOOKS)[keyof typeof MONSTER_LOOKS] | null; summary?: string; best: BestHit | null; today: string; onFinish: () => void }) {
  // Read once, before this fight is saved, so "a new best" compares with the fights before it.
  const [before] = useState(() => readBest(today));
  const isNew = !!best && (!before || best.amount > before.amount);
  useEffect(() => {
    if (!isNew || !best) return;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify({ ...best, today }));
    } catch {
      // Storage blocked: the best hit just isn't remembered.
    }
  }, [isNew, best?.amount, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = look
    ? fight.result === 'won'
      ? `${look.beaten} Well done, clan!`
      : fight.result === 'fled'
        ? 'The clan ran for the exit and is safe.'
        : `${look.stompsOff} Nobody is lost for good: the clan wakes up tomorrow.`
    : fight.result === 'won'
      ? 'The enemies are beaten. Well done, clan!'
      : fight.result === 'fled'
        ? 'The clan ran for the exit and is safe.'
        : fight.result === 'lost'
          ? 'The whole clan is knocked out. Nothing is lost for good: they wake up tomorrow.'
          : 'The fight fizzles out. Everyone heads home.';
  return (
    <div className="cq-choice">
      {summary && <p className="cq-summary" role="status">{summary}</p>}
      <h3>{text}</h3>
      {best && (
        <p className="cq-best">
          Best hit: {best.text}.{' '}
          {isNew ? <strong className="cq-best__new">★ Your best hit today!</strong> : before && <>Your best today is still {before.amount} ({before.text}).</>}
        </p>
      )}
      <p>
        Gold found: <strong>{fight.gold}</strong>
        {fight.followers > 0 && (
          <>
            {' '}
            · New followers: <strong>{fight.followers}</strong>
          </>
        )}
      </p>
      <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onFinish}>
        See how everyone did
      </button>
    </div>
  );
}
