/**
 * A mine fight. Pure display on top of shared/clans: the engine plays each round, this shows who
 * is up, takes the orders and the Battle Cry answer, and writes the log in plain gentle words.
 * Keyboard: A attack, S spell, G guard, R run, 1-9 to pick, Enter for the default action, Esc to go back.
 *
 * In a ladder fight (the server gave it questions) the Battle Cry is the child's own maths, shown in the hub's question
 * box and marked by the server (`onCheck`); the marks it gives back decide each round's bonus, just as on the server.
 */
import { useEffect, useRef, useState } from 'react';
import type { ShownFight } from '../../../shared/clans/actions';
import { markCry, nextCryQuestion, playCryRound, type CryAnswer, type CryMark, type CryReward, type FightMaths, type RecordedRound } from '../../../shared/clans/battleCry';
import { newFight, type FightState, type Order } from '../../../shared/clans/fight';
import { SPELLS } from '../../../shared/clans/spells';
import type { Member } from '../../../shared/clans/types';
import type { PracticalQuestion } from '../../../shared/maths/practical';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { PracticalAsk, Working } from '../../maths/PracticalAsk';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import { ACTION_HELP, spellHelp } from './abilities';
import { Bar } from './Bars';
import { castable, choosingOrder, defaultOrder, describe, fightsLabel, isAlive, labelDuplicates } from './fightView';
import { MonsterSprite, Portrait } from './Sprite';
import { zoneColour } from './Sprite';
import { MONSTERS_BY_NAME } from './monsters';
import { sceneArt, zoneScene } from './art';
import { lookOf } from '../../../shared/clans/looks';
import { nextSeed, type Session } from './session';

type Phase = 'ask' | 'reward' | 'working' | 'orders' | 'over';

/** The server's answer to a ladder Battle Cry: was it right, the right answer (to show when it wasn't), and the answer it marked. */
export interface CryChecked {
  correct: boolean;
  answer: number;
  /** The first answer sent for this question: a second try (after a refresh or a dropped connection) is marked as the first. */
  given: number;
}

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
    if (!open) return { fight: labelDuplicates(newFight(members, session.depth, nextSeed(session), boss)), lines: ['A fight begins!'] };
    // Rebuild the fight the server has, by playing back the rounds it has kept.
    const fight = labelDuplicates(newFight(members, open.depth, open.seed, open.boss));
    const lines = ['A fight begins!'];
    for (const r of open.rounds) {
      const before = fight.log.length;
      playCryRound(fight, { settings: open.settings, questions: open.questions, marks: open.marks }, r.orders, r.cry);
      lines.push(...fight.log.slice(before).map((e) => describe(e, clanNames)));
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [seq, setSeq] = useState<number[]>([]);
  const [seat, setSeat] = useState(0);
  const [mode, setMode] = useState<Mode>('action');
  const [spell, setSpell] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>(boot.lines);
  const panel = useRef<HTMLDivElement>(null);
  const logEnd = useRef<HTMLLIElement>(null);

  // The first round starts when the fight does; the next ones start after each round is played.
  const startRound = (f: FightState) => {
    if (f.result) return setPhase('over');
    // Round f.round + 1 is next: a ladder fight's question for it is number f.round in the list.
    const lq = ladder ? ladder[f.round] ?? null : null;
    const q = ladder ? null : nextCryQuestion(f, settings);
    setSeq(choosingOrder(f));
    setSeat(0);
    setOrders([]);
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
    if (phase === 'orders' || phase === 'reward') panel.current?.focus();
  }, [phase, seat, mode]);
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
  const who = fight.clan[seq[seat]];
  const alive = fight.enemies.filter(isAlive);

  function play(all: Order[]) {
    const next = structuredClone(fight);
    const before = next.log.length;
    playCryRound(next, maths(), all, given);
    onRound?.(next.round, { orders: all, cry: given });
    setLog((l) => [...l, ...next.log.slice(before).map((e) => describe(e, clanNames))]);
    setFight(next);
    startRound(next);
  }
  function choose(order: Order) {
    const all = [...orders];
    all[seq[seat]] = order;
    setOrders(all);
    if (seat + 1 < seq.length) {
      setSeat(seat + 1);
      setMode('action');
      setSpell(null);
    } else play(all);
  }
  const pickAttack = () => (alive.length === 1 ? choose({ action: 'attack', target: alive[0].index }) : setMode('target'));
  const goTarget = (index: number) => {
    if (spell !== null) choose({ action: 'spell', spell, target: index });
    else choose({ action: 'attack', target: index });
  };
  const spells = who ? castable(who) : [];
  const knowsSpells = !!who && who.spells.some((id) => SPELLS[id] && !SPELLS[id].notYet);
  const spellNote = spells.length ? ACTION_HELP.spell : knowsSpells ? 'Not enough SP right now.' : 'Knows no spells.';
  const help = (text: string) => <small className="cq-btn__help">{text}</small>;
  const targets = spell !== null && SPELLS[spell].friendly ? fight.clan.filter(isAlive) : alive;

  function keys(event: React.KeyboardEvent) {
    if (phase === 'reward') {
      if (event.key === 'd') chooseReward('damage');
      else if (event.key === 'h') chooseReward('heal');
      else return;
      return event.preventDefault();
    }
    if (phase !== 'orders' || !who) return;
    const k = event.key.toLowerCase();
    if (mode === 'action') {
      if (k === 'a') pickAttack();
      else if (k === 's' && spells.length) setMode('spell');
      else if (k === 'g') choose({ action: 'guard' });
      else if (k === 'r') choose({ action: 'run' });
      else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) choose(defaultOrder(fight));
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
        setMode('action');
      } else return;
    }
    event.preventDefault();
  }

  const upNext = phase === 'orders' && who ? who.index : -1;
  // The mine zone the monsters come from, painted dimly behind them (Clans art Stage A.6).
  const zone = MONSTERS_BY_NAME[fight.enemies[0]?.name.replace(/ [A-D]$/, '') ?? '']?.zone ?? 'Meadow';
  const zoneArt = sceneArt(zoneScene(zone)).small;
  return (
    <section className="cq-fight" aria-label="The fight">
      <p className="cq-fight__top">
        <strong>Depth {fight.depth}</strong> · Round {Math.min(fight.round + (fight.result ? 0 : 1), 8)} · Fights today: {fightsLabel(session.fightsLeft, session.fightsPerDay)}
      </p>
      <div className="cq-arena">
        <ul className="cq-side cq-side--enemies" aria-label="Enemies" data-zone={zone} style={zoneArt ? ({ '--cq-zone': `url(${zoneArt})` } as React.CSSProperties) : undefined}>
          {fight.enemies.map((e) => (
            <li key={e.index} className={isAlive(e) ? '' : 'is-down'}>
              <MonsterSprite name={e.name.replace(/ [A-D]$/, '')} zone={MONSTERS_BY_NAME[e.name.replace(/ [A-D]$/, '')]?.zone ?? 'Meadow'} scale={3} />
              <span className="cq-name" style={{ color: zoneColour(MONSTERS_BY_NAME[e.name.replace(/ [A-D]$/, '')]?.zone ?? 'Meadow') }}>
                {e.name}
              </span>
              <Bar label="HP" value={e.hp} max={e.maxHp} kind="hp" />
              {!isAlive(e) && <span className="cq-tag">gone</span>}
            </li>
          ))}
        </ul>
        <ul className="cq-side cq-side--clan" aria-label="Your clan">
          {fight.clan.map((f, i) => (
            <li key={f.index} className={`${isAlive(f) ? '' : 'is-down'} ${upNext === f.index ? 'is-up' : ''}`} aria-current={upNext === f.index ? 'true' : undefined}>
              <Portrait race={members[i].race} cls={members[i].cls} look={lookOf(members[i])} scale={3} />
              <span className="cq-name">{f.name}</span>
              <Bar label="HP" value={f.hp} max={f.maxHp} kind="hp" />
              {f.maxSp > 0 && <Bar label="SP" value={f.sp} max={f.maxSp} kind="sp" />}
              {upNext === f.index && <span className="cq-tag cq-tag--up">Up next</span>}
              {!isAlive(f) && <span className="cq-tag">resting</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="cq-lower">
        <div className="cq-panel" ref={panel} tabIndex={-1} onKeyDown={keys} role="group" aria-label={phase === 'ask' ? 'Battle Cry question' : phase === 'reward' ? 'Battle Cry reward' : phase === 'working' ? 'How the answer works' : phase === 'orders' && who ? `Orders for ${who.name}` : 'The fight is over'}>
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
          {phase === 'orders' && who && (
            <div className="cq-choice">
              <h3>
                {who.name}: {mode === 'action' ? 'what will they do?' : mode === 'spell' ? 'which spell?' : spell !== null ? `cast ${SPELLS[spell].name} on…` : 'attack…'}
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
                  <button type="button" className="cq-btn" onClick={() => choose({ action: 'run' })}>
                    <kbd>R</kbd> Run
                    {help(ACTION_HELP.run)}
                  </button>
                  <button type="button" className="cq-btn cq-btn--hot" onClick={() => choose(defaultOrder(fight))}>
                    <kbd>Enter</kbd> Default action
                    {help(ACTION_HELP.default)}
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
                  <button type="button" className="cq-btn" onClick={() => { setSpell(null); setMode('action'); }}>
                    <kbd>Esc</kbd> Back
                  </button>
                </div>
              )}
            </div>
          )}
          {phase === 'over' && <FightOver fight={fight} onFinish={() => onFinish(fight)} />}
        </div>
        <ol className="cq-log" aria-label="Fight log" aria-live="polite" aria-relevant="additions">
          {log.map((line, i) => (
            <li key={i} className={line.startsWith('Round') ? 'cq-log__round' : undefined}>
              {line}
            </li>
          ))}
          <li ref={logEnd} aria-hidden="true" />
        </ol>
      </div>
    </section>
  );
}

function FightOver({ fight, onFinish }: { fight: FightState; onFinish: () => void }) {
  const text =
    fight.result === 'won'
      ? 'The enemies are beaten. Well done, clan!'
      : fight.result === 'fled'
        ? 'The clan ran for the exit and is safe.'
        : fight.result === 'lost'
          ? 'The whole clan is knocked out. Nothing is lost for good: they wake up tomorrow.'
          : 'The fight fizzles out. Everyone heads home.';
  return (
    <div className="cq-choice">
      <h3>{text}</h3>
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
