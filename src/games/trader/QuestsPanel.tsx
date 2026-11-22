/**
 * The Quests tab (docs/plans/trader-quests/PLAN.md, Q.2): five quest cards with each giver's painted face, and the open
 * quest's steps as a checklist that says exactly where to go. The server decides everything; this only shows it.
 */
import { GOODS, SHIPS } from '../../../shared/trader/config';
import { coordText, distance, type Galaxy } from '../../../shared/trader/galaxy';
import { allQuestsDone, FIRST_SET, hasSmallOrder, isSmallShip, jobId, jobIndex, NAVY_LASER, nearestSellers, nextQuest, openQuestView, questReward, FIRST_QUESTS, QUESTS, trailClue, type QuestConfig, type QuestState, type StepView } from '../../../shared/trader/quests';
import type { Action } from '../../../shared/trader/server';
import type { Trader } from '../../../shared/trader/state';
import { boardArt, doneOf, giverArt, isHidden, isTrail, isWaiting, KEEPSAKES, landingLine, MASTER_ART, pirateWords, raceFuel, stepWords, trailName, type Shown } from './questGuide';
import type { StoryPage } from '../../../shared/kit/stories';
import { pageReader, QUEST_STORIES } from './stories';

const cr = (n: number): string => `${n.toLocaleString('en-NZ')} cr`;

/** Quests 6 to 10, under "More quests" (docs/plans/trader-quests-2/PLAN.md). */
const MORE_QUESTS: readonly QuestConfig[] = QUESTS.filter((q) => !FIRST_SET.includes(q.id));

export type QuestStatus = 'done' | 'open' | 'ready' | 'tomorrow' | 'locked';

export function questStatus(quest: QuestConfig, q: QuestState | undefined, day: number, all = false): QuestStatus {
  if (q?.finished.includes(quest.id)) return 'done';
  if (q?.open === quest.id) return 'open';
  if (nextQuest(q, day, all ? quest.id : undefined)?.id === quest.id) return 'ready';
  const first = QUESTS.find((c) => !q?.finished.includes(c.id));
  if (first?.id === quest.id && !q?.open && q?.lastDay != null && q.lastDay >= day) return 'tomorrow';
  return 'locked';
}

export function GiverFace({ id, name, size = 72 }: { id: string; name: string; size?: number }) {
  // A daily job (Q.6) has no giver painting: a crate instead.
  if (jobIndex(id) !== null) return <span className="stq-face stq-face--job" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">📦</span>;
  const art = giverArt(id);
  // The 160 px face for small sizes, the 512 px painting where it shows big (or on a sharp screen).
  return art
    ? <img className="stq-face" src={art.small} srcSet={art.big ? `${art.small} 160w, ${art.big} 512w` : undefined} sizes={`${size}px`} alt="" width={size} height={size} draggable={false} />
    : <span className="stq-face stq-face--stand" style={{ width: size, height: size }} aria-hidden="true">{name.slice(0, 1)}</span>;
}

/** The giver's face in a quest story's corner. Pip and Pop take turns reading, so their pages say who is reading now
 *  (a name tag that pops in, with the reader's own colour). */
export function QuestCorner({ id, title, page }: { id: string; title: string; page: StoryPage }) {
  const at = QUEST_STORIES[id]?.pages.indexOf(page) ?? -1;
  const reader = at >= 0 ? pageReader(id, at).name : undefined;
  return (
    <span className="stq-corner">
      <GiverFace id={id} name={title} size={72} />
      {reader && <span key={reader + at} className={`stq-reader stq-reader--${reader.toLowerCase()}`}>{reader} reads</span>}
    </span>
  );
}

export function QuestsPanel({ galaxy, t, quests, keepsakes = [], allQuests = false, busy, showXY = true, shown = 'all', onQuest, onTab, onShowMap, onReveal, onStory }: {
  galaxy: Galaxy;
  /** Quests ever finished (the Quest Log, kept through a New Season). */
  keepsakes?: string[];
  /** A teacher's own game: every quest not done can be taken, in any order, any day. */
  allQuests?: boolean;
  /** Lumi's trail steps shown with Show me ('all' when coordinates are hidden). */
  shown?: Shown;
  /** Show me: light up a trail step's planet on the star chart. */
  onReveal?: (step: number) => void;
  /** Coordinates on show (Bolt's help is not Off). */
  showXY?: boolean;
  t: Trader;
  quests: QuestState | undefined;
  busy: boolean;
  /** Send quest moves to the server now. */
  onQuest: (actions: Action[]) => void;
  onTab: (tab: 'trade' | 'ship') => void;
  onShowMap: (planet: number) => void;
  /** Read a quest's story again: the first three pages once taken, all five once done. */
  onStory?: (id: string, part: 'start' | 'all') => void;
}) {
  const view = openQuestView(galaxy, t, quests);
  const done = quests?.finished.length ?? 0;
  const board = boardArt();
  // The 📖 shelf: stories started (the quest now) or finished, in quest order. Locked quests show nothing.
  const shelf = QUESTS.filter((c) => QUEST_STORIES[c.id] && (quests?.finished.includes(c.id) || quests?.open === c.id));
  const firstDone = FIRST_SET.every((id) => quests?.finished.includes(id));
  const card = (quest: QuestConfig, n: number) => {
    const status = questStatus(quest, quests, t.day, allQuests);
    const reward = status === 'open' && view ? view.reward : questReward(quest, hasSmallOrder(quest) ? isSmallShip(t) : undefined);
    // Chef Gorbo pays a set 400 on top of what he pays for the goods; Dr Nettle pays for the goods only.
    const pay = quest.id === 'nettle' ? `pays ${cr(reward)} for the goods` : quest.reward > 0 && reward > quest.reward ? `${cr(quest.reward)} + what he pays for the goods (${cr(reward - quest.reward)})` : `${cr(reward)} reward`;
    return (
      <li key={quest.id} className={`stq-card stq-card--${status}`}>
        <GiverFace id={quest.id} name={quest.giver} />
        <div className="stq-card__body">
          <h3 className="stq-card__h">{status === 'locked' ? `Quest ${n}` : quest.title}</h3>
          <p className="stq-card__meta">
            {status === 'locked' ? (n === 6 && !firstDone ? 'Finish the first five quests to open this one.' : 'Finish the quest before to open this one.') : <>{quest.giver} · <strong>{pay}</strong></>}
          </p>
          <p className="stq-card__state">
            {status === 'done' && <span className="stq-pill stq-pill--done">✓ Done</span>}
            {status === 'open' && <span className="stq-pill stq-pill--open">⭐ Your quest now</span>}
            {status === 'tomorrow' && <span className="stq-pill">🌙 Opens tomorrow</span>}
            {status === 'locked' && <span className="stq-pill">🔒 Locked</span>}
          </p>
        </div>
        <div className="stq-card__act">
          {status === 'ready' && (
            <button type="button" className="st-btn st-btn--primary" disabled={busy} onClick={() => onQuest([{ type: 'quest-take', id: quest.id }])} data-coach={`quest-take-${quest.id}`}>Take quest</button>
          )}
          {status === 'open' && (
            <button type="button" className="st-btn st-btn--small" disabled={busy} onClick={() => onQuest([{ type: 'quest-drop' }])}>Drop</button>
          )}
        </div>
      </li>
    );
  };
  return (
    <section className="st-panel stq" aria-labelledby="stq-h">
      {board && <img className="stq-board" src={board.wide} srcSet={`${board.small} 800w, ${board.wide} 1600w`} sizes="(max-width: 900px) 100vw, 900px" alt="" draggable={false} />}
      <h2 id="stq-h" className="st-h">Quests</h2>
      <p className="st-sub">Help the people of the galaxy and earn credits. {allQuests ? <strong>Teacher: every quest is open to try, in any order.</strong> : "One quest at a time; a new one opens each day after you finish one."} {done > 0 && <strong>{done} of {QUESTS.length} done.</strong>}</p>
      {view && <Checklist galaxy={galaxy} t={t} quest={view.quest} reward={view.reward} steps={view.steps} busy={busy} showXY={showXY} shown={shown} onQuest={onQuest} onTab={onTab} onShowMap={onShowMap} onReveal={onReveal} />}
      <ul className="stq-list">{FIRST_QUESTS.map((quest, i) => card(quest, i + 1))}</ul>
      <div className="stq-more" aria-labelledby="stq-more-h">
        <h3 id="stq-more-h" className="st-h3 stq-more__h">✨ More quests</h3>
        <p className="st-soft stq-more__sub">Bigger adventures for bigger rewards. They open one a day after the first five.</p>
        <ul className="stq-list">{MORE_QUESTS.map((quest, i) => card(quest, FIRST_QUESTS.length + i + 1))}</ul>
      </div>
      {allQuestsDone(quests) && <Jobs galaxy={galaxy} t={t} quests={quests!} busy={busy} showXY={showXY} onQuest={onQuest} onShowMap={onShowMap} />}
      <QuestLog keepsakes={keepsakes} />
      {onStory && shelf.length > 0 && (
        <div className="stq-shelf" aria-labelledby="stq-shelf-h">
          <h3 id="stq-shelf-h" className="st-h3">📖 Quest stories</h3>
          <ul className="stq-shelf__list">
            {shelf.map((c) => {
              const whole = !!quests?.finished.includes(c.id);
              const first = QUEST_STORIES[c.id].pages[0].art;
              return (
                <li key={c.id}>
                  <button type="button" className="stq-shelf__item" onClick={() => onStory(c.id, whole ? 'all' : 'start')} aria-label={`Read ${c.title} again`}>
                    {first?.small ? <img className="stq-shelf__thumb" src={first.small} alt="" draggable={false} /> : <GiverFace id={c.id} name={c.giver} size={48} />}
                    <span className="stq-shelf__label">{c.title}<span className="st-soft">{whole ? 'The whole story' : 'The story so far'}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * 📦 Today's jobs (Q.6): once all five quests are done this season, one or two small deliveries a day, made by the server.
 * A job left undone just goes at the end of the day.
 */
function Jobs({ galaxy, t, quests, busy, showXY, onQuest, onShowMap }: { galaxy: Galaxy; t: Trader; quests: QuestState; busy: boolean; showXY: boolean; onQuest: (actions: Action[]) => void; onShowMap: (planet: number) => void }) {
  const jobs = quests.jobs?.day === t.day ? quests.jobs : undefined;
  const list = jobs?.list ?? [];
  const allDone = list.length > 0 && list.every((_, i) => jobs?.done.includes(i));
  const where = (id: number) => {
    const p = galaxy.planets[id];
    const fuel = distance(galaxy.planets[t.location], p);
    return (
      <>
        <button type="button" className="stq-link" onClick={() => onShowMap(id)}>{p.name}{showXY ? ` ${coordText(p)}` : ''}</button>
        <span className="st-soft"> · {fuel === 0 ? 'here' : `${fuel} fuel`}</span>
      </>
    );
  };
  return (
    <div className="stq-jobs" aria-labelledby="stq-jobs-h">
      <h3 id="stq-jobs-h" className="st-h3">📦 Today's jobs</h3>
      <p className="st-soft stq-jobs__sub">Small deliveries for the Star Post. The crates are free to carry and pay a little more than a normal trade. Not done today? They just go.</p>
      {allDone ? (
        <p className="st-good-note stq-jobs__done">✓ All done for today. New jobs tomorrow!</p>
      ) : list.length === 0 ? (
        <p className="st-soft">No jobs today. New jobs tomorrow!</p>
      ) : (
        <ul className="stq-list">
          {list.map((job, i) => {
            const id = jobId(i);
            const done = !!jobs?.done.includes(i);
            const open = quests.open === id;
            return (
              <li key={id} className={`stq-card stq-card--${done ? 'done' : open ? 'open' : 'ready'}`}>
                <GiverFace id={id} name="Star Post" size={56} />
                <div className="stq-card__body">
                  <h3 className="stq-card__h">Take {job.qty} {GOODS[job.good]} to {galaxy.planets[job.to].name}</h3>
                  <p className="stq-card__meta">Pick up at {where(job.from)}, deliver to {where(job.to)} · <strong>pays {cr(job.pay)}</strong></p>
                  <p className="stq-card__state">
                    {done && <span className="stq-pill stq-pill--done">✓ Delivered</span>}
                    {open && <span className="stq-pill stq-pill--open">📦 Your job now</span>}
                  </p>
                </div>
                <div className="stq-card__act">
                  {!done && !open && (
                    <button type="button" className="st-btn st-btn--primary" disabled={busy || !!quests.open} onClick={() => onQuest([{ type: 'quest-take', id }])} data-coach={`job-take-${i}`}>Take job</button>
                  )}
                  {open && <button type="button" className="st-btn st-btn--small" disabled={busy} onClick={() => onQuest([{ type: 'quest-drop' }])}>Drop</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The Quest Log: a keepsake for each quest ever finished (kept through a New Season), and the Star Quest Master line. */
export function QuestLog({ keepsakes }: { keepsakes: string[] }) {
  const all = FIRST_QUESTS.every((q) => keepsakes.includes(q.id));
  return (
    <div className="stq-log" aria-labelledby="stq-log-h">
      <h3 id="stq-log-h" className="st-h3">🎒 Quest Log</h3>
      <p className="st-soft stq-log__sub">A keepsake for each quest you finish. You keep them, even after a New Season.</p>
      <ul className="stq-log__list">
        {FIRST_QUESTS.map((q) => {
          const got = keepsakes.includes(q.id);
          const k = KEEPSAKES[q.id];
          const art = QUEST_STORIES[q.id]?.pages[4]?.art?.small;
          return (
            <li key={q.id} className={`stq-keep ${got ? 'stq-keep--got' : ''}`}>
              {got && art ? <img className="stq-keep__pic" src={art} alt="" draggable={false} /> : <span className="stq-keep__pic stq-keep__pic--empty" aria-hidden="true">{got ? k.emoji : '?'}</span>}
              <span className="stq-keep__name">{got ? `${k.emoji} ${k.name}` : 'Not yet'}<span className="st-soft">{q.giver}</span></span>
            </li>
          );
        })}
      </ul>
      {all && (
        <p className="stq-master">
          {MASTER_ART && <img className="stq-master__pic" src={MASTER_ART} alt="" width={64} height={64} draggable={false} />}
          <span><strong>🌟 Star Quest Master!</strong> You finished all five quests. Your trophy is on your profile.</span>
        </p>
      )}
    </div>
  );
}

function Checklist({ galaxy, t, quest, reward, steps, busy, showXY, shown, onQuest, onTab, onShowMap, onReveal }: {
  galaxy: Galaxy;
  showXY: boolean;
  shown: Shown;
  onReveal?: (step: number) => void;
  t: Trader;
  quest: QuestConfig;
  reward: number;
  steps: StepView[];
  busy: boolean;
  onQuest: (actions: Action[]) => void;
  onTab: (tab: 'trade' | 'ship') => void;
  onShowMap: (planet: number) => void;
}) {
  const tank = SHIPS[t.ship].fuelTank;
  const race = raceFuel(galaxy, t, quest, steps);
  const trail = isTrail(quest) ? trailName(quest) : null;
  const done = doneOf(steps);
  const sub = jobIndex(quest.id) !== null
    ? 'Pick up the crates, then take them to the gold planet. Gold rings on the star chart show where.'
    : race ? 'A race on one tank! Start line, checkpoint, finish line, in that order. Fill up at the start line: fuel bought after that sends you back to it.'
    : trail ? `Follow the ${quest.id === 'sable' ? 'map marks' : 'clues'} in order. Each one is a move on the star chart from where you are.`
    : 'Do the steps in any order. The last one waits for the rest. Gold rings on the star chart show where.';
  // Goods wanted at more than one planet (Mayor Puddle's Water) are shopped for once, on the first of those steps.
  const shopOn = new Set(steps.filter((s, i, all) => !s.done && s.kind === 'buy-deliver' && all.findIndex((o) => !o.done && o.kind === 'buy-deliver' && quest.steps[o.index].good === quest.steps[s.index].good) === i).map((s) => s.index));
  return (
    <div className={`stq-open ${race ? 'stq-open--race' : ''}`} aria-labelledby="stq-open-h">
      <div className="stq-open__head">
        <GiverFace id={quest.id} name={quest.giver} size={56} />
        <div>
          <h3 id="stq-open-h" className="st-h3 stq-open__h">{quest.title}</h3>
          <p className="st-soft stq-open__sub">{sub}</p>
        </div>
      </div>
      {steps.some((s) => s.kind === 'pirate' && !s.done) && (
        <p className="stq-lent">🔫 {quest.giver} {quest.giver === 'Pip and Pop' ? 'have' : 'has'} lent you a <strong>{NAVY_LASER.name}</strong> for {steps.filter((s) => s.kind === 'pirate').length === 1 ? 'this fight' : 'these fights'}. If you lose, {quest.id === 'sable' ? 'Rust-Beard takes' : 'the pirates take'} nothing: fix your hull and try again.</p>
      )}
      {race && <RaceFuel race={race} />}
      <ol className="stq-steps">
        {steps.map((s) => {
          const words = stepWords(quest, s);
          const waiting = isWaiting(s);
          const here = s.fuel === 0;
          const step = quest.steps[s.index];
          const hidden = isHidden(quest, s, shown, done);
          // Lumi's next clue, from where the ship is now (the first trail step not done). Later ones wait.
          const clueStep = hidden && !waiting;
          return (
            <li key={s.index} className={`stq-step ${s.done ? 'stq-step--done' : ''} ${waiting ? 'stq-step--wait' : ''}`}>
              <span className="stq-step__tick" aria-hidden="true">{s.done ? '✓' : s.index + 1}</span>
              <div className="stq-step__body">
                <p className="stq-step__what"><strong>{words.line}</strong>{s.done && <span className="st-sr"> (done)</span>}</p>
                {clueStep && !here && (
                  <p className="stq-clue">
                    <span><strong>{trail?.who ?? quest.giver}:</strong> “{trailClue(galaxy, t.location, s.planet).text}”</span>
                    {onReveal && <button type="button" className="st-btn st-btn--small" onClick={() => onReveal(s.index)} data-coach="quest-showme">Show me</button>}
                  </p>
                )}
                {hidden && waiting && <p className="st-soft stq-step__note">Its clue comes when you reach the stop before.</p>}
                {!s.done && (!hidden || here) && (
                  <p className="stq-step__where">
                    {s.kind === 'buy-deliver' && !step.hands ? 'Hand over at ' : 'at '}
                    <button type="button" className="stq-link" onClick={() => onShowMap(s.planet)}>{s.name}{showXY ? ` ${s.coords}` : ''}</button>
                    {here ? <strong className="stq-here"> · You are here!</strong> : <> · {s.fuel} fuel from here</>}
                  </p>
                )}
                {!s.done && race && s.index === 0 && (
                  <p className={t.fuel >= tank ? 'st-good-note stq-step__note' : 'stq-step__note stq-tank'}>
                    {t.fuel >= tank ? `⛽ Full tank (${t.fuel} of ${tank}). Ready to race!` : `⛽ Arrive with a full tank: you have ${t.fuel} of ${tank}. Fill up at the start line or before.`}
                    {t.fuel < tank && <> <button type="button" className="stq-link" onClick={() => onTab('ship')}>Buy fuel</button></>}
                  </p>
                )}
                {!s.done && !here && !waiting && !s.fuelOk && !race?.started && (
                  <p className="st-warn stq-fuel">⛽ {s.fuel > tank ? `Too far for one jump (your tank holds ${tank}). Stop on the way.` : `You need ${s.fuel} fuel and have ${t.fuel}.`} {s.fuel <= tank && <button type="button" className="stq-link" onClick={() => onTab('ship')}>Buy fuel</button>}</p>
                )}
                {!s.done && s.kind === 'buy-deliver' && step.good !== undefined && shopOn.has(s.index) && (
                  <Goods galaxy={galaxy} t={t} good={step.good} what={s.what} qty={steps.filter((o) => !o.done && o.kind === 'buy-deliver' && quest.steps[o.index].good === step.good).reduce((n, o) => n + (o.qty ?? 0), 0)} have={s.have ?? 0} pays={step.pays ?? 0} giver={quest.giver} reward={reward} onShowMap={onShowMap} />
                )}
                {waiting && !s.done && !hidden && <p className="st-soft stq-step__note">{s.problem === 'Do the steps in order.' ? 'Do the step before first.' : 'Do the other steps first.'}</p>}
                {!s.done && here && s.problem?.startsWith('Make room') && (
                  <p className="st-warn">{s.problem} <button type="button" className="stq-link" onClick={() => onTab('trade')}>Sell something on the Trade screen</button></p>
                )}
              </div>
              {!s.done && s.problem === null && (
                <button type="button" className="st-btn st-btn--primary stq-step__btn" disabled={busy} data-coach="quest-step" onClick={() => onQuest([s.kind === 'pirate' ? { type: 'quest-fight', step: s.index } : s.kind === 'buy-deliver' || s.kind === 'deliver' ? { type: 'quest-deliver', step: s.index } : { type: 'quest-pickup', step: s.index }])}>
                  {words.button}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="stq-reward">🏆 Reward: <strong>{cr(reward)}</strong>{quest.id === 'nettle' ? ' (what Dr Nettle pays for the goods)' : quest.reward > 0 && reward > quest.reward ? ` (${cr(quest.reward)}, plus what ${quest.giver} pays for the goods)` : ''}</p>
    </div>
  );
}

/**
 * The Comet Cup's fuel sum: before the start, the whole race against the tank; once racing, "Fuel left: 9. Still to fly:
 * 7", with a gauge, so the adding up is in plain sight.
 */
function RaceFuel({ race }: { race: NonNullable<ReturnType<typeof raceFuel>> }) {
  const { started, legs, toFly, left, tank, total } = race;
  const sum = legs.length > 1 ? `${legs.join(' + ')} = ${toFly}` : `${toFly}`;
  if (!started) {
    return (
      <div className="stq-race">
        <p className="stq-race__tag">🏁 The Comet Cup</p>
        <p>The race is <strong>{legs.join(' + ')} = {total} fuel</strong>. Your tank holds <strong>{tank}</strong>{total <= tank ? ', so one full tank gets you round.' : '.'}</p>
      </div>
    );
  }
  const enough = left >= toFly;
  return (
    <div className={`stq-race stq-race--on ${enough ? '' : 'stq-race--short'}`} role="status">
      <p className="stq-race__tag">🏁 Racing!</p>
      <p className="stq-race__sum">Fuel left: <strong>{left}</strong>. Still to fly: <strong>{toFly}</strong>{legs.length > 1 && <span className="st-soft"> ({sum})</span>}</p>
      <div className="stq-race__gauge" aria-hidden="true">
        <span className="stq-race__left" style={{ width: `${Math.min(100, (left / tank) * 100)}%` }} />
        <span className="stq-race__need" style={{ width: `${Math.min(100, (toFly / tank) * 100)}%` }} />
      </div>
      <p className={enough ? 'st-good-note' : 'st-warn'}>{enough ? `✓ Enough to finish, with ${left - toFly} to spare. No more fuel till the finish line!` : '⛽ Not enough to finish. Buying fuel now sends you back to the start line.'}</p>
    </div>
  );
}

/** Goods for a giver (Dr Nettle, Chef Gorbo, Mayor Puddle): how many are in the hold, the three nearest markets selling them today, and what they pay. */
function Goods({ galaxy, t, good, what, qty, have, pays, giver, reward, onShowMap }: { galaxy: Galaxy; t: Trader; good: number; what: string; qty: number; have: number; pays: number; giver: string; reward: number; onShowMap: (planet: number) => void }) {
  const sellers = have >= qty ? [] : nearestSellers(galaxy, t, good, 3);
  const cheapest = sellers.length ? Math.min(...sellers.map((s) => s.price)) : 0;
  const need = Math.max(0, qty - have);
  return (
    <div className="stq-goods">
      <p className={have >= qty ? 'st-good-note' : 'stq-goods__have'}>{have >= qty ? '✓ ' : ''}{Math.min(have, qty)} of {qty} {what} in your hold</p>
      {sellers.length > 0 && (
        <>
          <p className="st-soft stq-goods__sub">Nearest places selling {what} today:</p>
          <ul className="stq-goods__list">
            {sellers.map((s) => (
              <li key={s.planet}>
                <button type="button" className="stq-link" onClick={() => onShowMap(s.planet)}>{s.name} {galaxy.planets[s.planet] ? `(${s.fuel === 0 ? 'here' : `${s.fuel} fuel`})` : ''}</button>: <strong>{s.price} cr</strong> each
              </li>
            ))}
          </ul>
        </>
      )}
      {pays > 0 ? (
        <p className="stq-goods__pay">
          {giver} pays <strong>{pays} cr</strong> each: <strong>{cr(pays * qty)}</strong> for {qty}.
          {need > 0 && cheapest > 0 && <> Buying {need} costs about {cr(cheapest * need)}, so you make about <strong>{cr(pays * need - cheapest * need)}</strong>.</>}
        </p>
      ) : (
        <p className="stq-goods__pay">
          {giver} pays <strong>{cr(reward)}</strong> when it's all handed out.
          {need > 0 && cheapest > 0 && <> Buying {need} costs about {cr(cheapest * need)}, so you make about <strong>{cr(reward - cheapest * need)}</strong>.</>}
        </p>
      )}
    </div>
  );
}

/** The gold card on landing at a quest planet: one tap does every quest step that can be done here. */
export function QuestLanding({ quest, steps, busy, onDo }: { quest: QuestConfig; steps: StepView[]; busy: boolean; onDo: () => void }) {
  const last = steps[steps.length - 1];
  const button = steps.length > 1 ? 'Do it' : stepWords(quest, last).button;
  return (
    <div className="stq-land" role="status">
      <GiverFace id={quest.id} name={quest.giver} size={52} />
      <div className="stq-land__body">
        <p className="stq-land__tag">⭐ Quest stop</p>
        {steps.map((s) => <p key={s.index} className="stq-land__line"><strong>{landingLine(quest, s)}</strong></p>)}
      </div>
      <button type="button" className="st-btn st-btn--primary stq-land__btn" disabled={busy} onClick={onDo} data-coach="quest-do">{button}</button>
    </div>
  );
}

/** A quest stop here that can't be done yet (the last stop too early, or a full hold): says what to do first. */
export function QuestWaiting({ quest, items, onNext }: { quest: QuestConfig; items: { line: string; why: string; shop?: boolean }[]; onNext?: () => void }) {
  return (
    <div className="stq-land stq-land--waiting" role="status">
      <GiverFace id={quest.id} name={quest.giver} size={52} />
      <div className="stq-land__body">
        <p className="stq-land__tag">{items.every((w) => w.shop) ? '⭐ For your quest' : '⭐ Quest stop'}</p>
        {items.map((w) => (
          <p key={w.line} className="stq-land__line">
            <strong>{w.line}</strong> {w.why}
          </p>
        ))}
      </div>
      {onNext && <button type="button" className="st-btn stq-land__btn" onClick={onNext} data-coach="quest-where">Where next?</button>}
    </div>
  );
}

/** Commander Vex's pirate ship still waiting here (after a loss or getting away): fight it again. */
export function QuestPirate({ quest, busy, onFight }: { quest: QuestConfig; busy: boolean; onFight: () => void }) {
  return (
    <div className="stq-land stq-land--pirate" role="status">
      <GiverFace id={quest.id} name={quest.giver} size={52} />
      <div className="stq-land__body">
        <p className="stq-land__tag">⭐ Quest stop</p>
        <p className="stq-land__line"><strong>{pirateWords(quest).still}</strong> Fix your hull if you need to, then {quest.id === 'sable' ? 'take him on' : 'chase it off'} for {quest.giver}.</p>
      </div>
      <button type="button" className="st-btn st-btn--primary stq-land__btn" disabled={busy} onClick={onFight} data-coach="quest-do">⚔️ Fight them</button>
    </div>
  );
}

/** Lumi's next clue on the Trade screen: Ranger Kai says the move from here, and Show me lights up the planet. */
export function QuestClue({ quest, text, onReveal }: { quest: QuestConfig; text: string; onReveal: () => void }) {
  const trail = trailName(quest);
  return (
    <div className="stq-land stq-land--clue" role="status">
      <GiverFace id={quest.id} name={quest.giver} size={52} />
      <div className="stq-land__body">
        <p className="stq-land__tag">⭐ {trail.trail}</p>
        <p className="stq-land__line"><strong>{trail.who}:</strong> “{text}”</p>
      </div>
      <button type="button" className="st-btn stq-land__btn" onClick={onReveal} data-coach="quest-showme">Show me</button>
    </div>
  );
}

/** The short "Quest complete!" moment. */
export function QuestDone({ quest, reward, points = 0, master = false, next, onDone }: { quest: QuestConfig; reward: number; points?: number; master?: boolean; next: QuestConfig | null; onDone: () => void }) {
  const k = KEEPSAKES[quest.id];
  return (
    <section className="st-panel st-panel--small stq-done" aria-labelledby="stq-done-h">
      <GiverFace id={quest.id} name={quest.giver} size={112} />
      <h2 id="stq-done-h" className="st-h stq-done__h">Quest complete! 🎉</h2>
      <p className="stq-done__pay">+{reward.toLocaleString('en-NZ')} credits{points > 0 && <span className="stq-done__points"> · +{points} hub points</span>}</p>
      {k && <p className="stq-done__keep">{k.emoji} New keepsake in your Quest Log: <strong>{k.name}</strong></p>}
      {master && <p className="stq-master"><strong>🌟 Star Quest Master!</strong> All five quests done. Your trophy is on your profile.</p>}
      <p className="st-sub">{quest.giver} says thank you, Captain!</p>
      <p className="st-soft">{next ? `Next quest: ${next.title}. It opens tomorrow.` : 'That was the last quest. You helped everyone in the galaxy!'}</p>
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary st-btn--big" onClick={onDone} data-key="go">Carry on</button>
      </div>
    </section>
  );
}
