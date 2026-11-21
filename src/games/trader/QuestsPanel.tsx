/**
 * The Quests tab (docs/plans/trader-quests/PLAN.md, Q.2): five quest cards with each giver's painted face, and the open
 * quest's steps as a checklist that says exactly where to go. The server decides everything; this only shows it.
 */
import { SHIPS } from '../../../shared/trader/config';
import type { Galaxy } from '../../../shared/trader/galaxy';
import { isSmallShip, nearestSellers, nextQuest, openQuestView, questReward, QUESTS, type QuestConfig, type QuestState, type StepView } from '../../../shared/trader/quests';
import type { Action } from '../../../shared/trader/server';
import type { Trader } from '../../../shared/trader/state';
import { boardArt, giverArt, isWaiting, landingLine, stepWords } from './questGuide';
import { QUEST_STORIES } from './stories';

const cr = (n: number): string => `${n.toLocaleString('en-NZ')} cr`;

export type QuestStatus = 'done' | 'open' | 'ready' | 'tomorrow' | 'locked';

export function questStatus(quest: QuestConfig, q: QuestState | undefined, day: number): QuestStatus {
  if (q?.finished.includes(quest.id)) return 'done';
  if (q?.open === quest.id) return 'open';
  if (nextQuest(q, day)?.id === quest.id) return 'ready';
  const first = QUESTS.find((c) => !q?.finished.includes(c.id));
  if (first?.id === quest.id && !q?.open && q?.lastDay != null && q.lastDay >= day) return 'tomorrow';
  return 'locked';
}

export function GiverFace({ id, name, size = 72 }: { id: string; name: string; size?: number }) {
  const art = giverArt(id);
  // The 160 px face for small sizes, the 512 px painting where it shows big (or on a sharp screen).
  return art
    ? <img className="stq-face" src={art.small} srcSet={art.big ? `${art.small} 160w, ${art.big} 512w` : undefined} sizes={`${size}px`} alt="" width={size} height={size} draggable={false} />
    : <span className="stq-face stq-face--stand" style={{ width: size, height: size }} aria-hidden="true">{name.slice(0, 1)}</span>;
}

export function QuestsPanel({ galaxy, t, quests, busy, showXY = true, onQuest, onTab, onShowMap, onStory }: {
  galaxy: Galaxy;
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
  return (
    <section className="st-panel stq" aria-labelledby="stq-h">
      {board && <img className="stq-board" src={board.wide} srcSet={`${board.small} 800w, ${board.wide} 1600w`} sizes="(max-width: 900px) 100vw, 900px" alt="" draggable={false} />}
      <h2 id="stq-h" className="st-h">Quests</h2>
      <p className="st-sub">Help the people of the galaxy and earn credits. One quest at a time; a new one opens each day after you finish one. {done > 0 && <strong>{done} of {QUESTS.length} done.</strong>}</p>
      {view && <Checklist galaxy={galaxy} t={t} quest={view.quest} reward={view.reward} steps={view.steps} busy={busy} showXY={showXY} onQuest={onQuest} onTab={onTab} onShowMap={onShowMap} />}
      <ul className="stq-list">
        {QUESTS.map((quest, i) => {
          const status = questStatus(quest, quests, t.day);
          const reward = status === 'open' && view ? view.reward : questReward(quest, quest.id === 'nettle' ? isSmallShip(t) : undefined);
          return (
            <li key={quest.id} className={`stq-card stq-card--${status}`}>
              <GiverFace id={quest.id} name={quest.giver} />
              <div className="stq-card__body">
                <h3 className="stq-card__h">{status === 'locked' ? `Quest ${i + 1}` : quest.title}</h3>
                <p className="stq-card__meta">
                  {status === 'locked' ? 'Finish the quest before to open this one.' : <>{quest.giver} · <strong>{quest.id === 'nettle' ? `pays ${cr(reward)} for the goods` : `${cr(reward)} reward`}</strong></>}
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
        })}
      </ul>
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

function Checklist({ galaxy, t, quest, reward, steps, busy, showXY, onQuest, onTab, onShowMap }: {
  galaxy: Galaxy;
  showXY: boolean;
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
  return (
    <div className="stq-open" aria-labelledby="stq-open-h">
      <div className="stq-open__head">
        <GiverFace id={quest.id} name={quest.giver} size={56} />
        <div>
          <h3 id="stq-open-h" className="st-h3 stq-open__h">{quest.title}</h3>
          <p className="st-soft stq-open__sub">{quest.ordered ? 'Do the steps in order.' : 'Do the steps in any order. The last one waits for the rest.'} Gold rings on the star chart show where.</p>
        </div>
      </div>
      <ol className="stq-steps">
        {steps.map((s) => {
          const words = stepWords(quest, s);
          const waiting = isWaiting(s);
          const here = s.fuel === 0;
          const step = quest.steps[s.index];
          return (
            <li key={s.index} className={`stq-step ${s.done ? 'stq-step--done' : ''} ${waiting ? 'stq-step--wait' : ''}`}>
              <span className="stq-step__tick" aria-hidden="true">{s.done ? '✓' : s.index + 1}</span>
              <div className="stq-step__body">
                <p className="stq-step__what"><strong>{words.line}</strong>{s.done && <span className="st-sr"> (done)</span>}</p>
                {!s.done && (
                  <p className="stq-step__where">
                    {s.kind === 'buy-deliver' ? 'Hand over at ' : 'at '}
                    <button type="button" className="stq-link" onClick={() => onShowMap(s.planet)}>{s.name}{showXY ? ` ${s.coords}` : ''}</button>
                    {here ? <strong className="stq-here"> · You are here!</strong> : <> · {s.fuel} fuel from here</>}
                  </p>
                )}
                {!s.done && !here && !waiting && !s.fuelOk && (
                  <p className="st-warn stq-fuel">⛽ {s.fuel > tank ? `Too far for one jump (your tank holds ${tank}). Stop on the way.` : `You need ${s.fuel} fuel and have ${t.fuel}.`} {s.fuel <= tank && <button type="button" className="stq-link" onClick={() => onTab('ship')}>Buy fuel</button>}</p>
                )}
                {!s.done && s.kind === 'buy-deliver' && step.good !== undefined && (
                  <Goods galaxy={galaxy} t={t} good={step.good} what={s.what} qty={s.qty ?? 0} have={s.have ?? 0} pays={step.pays ?? 0} onShowMap={onShowMap} />
                )}
                {waiting && !s.done && <p className="st-soft stq-step__note">{s.problem === 'Do the steps in order.' ? 'Do the step before first.' : 'Do the other steps first.'}</p>}
                {!s.done && here && s.problem === 'Make room: 1 free hold needed.' && (
                  <p className="st-warn">Make room: 1 free hold needed. <button type="button" className="stq-link" onClick={() => onTab('trade')}>Sell something on the Trade screen</button></p>
                )}
              </div>
              {!s.done && s.problem === null && (
                <button type="button" className="st-btn st-btn--primary stq-step__btn" disabled={busy} data-coach="quest-step" onClick={() => onQuest([s.kind === 'buy-deliver' || s.kind === 'deliver' ? { type: 'quest-deliver', step: s.index } : { type: 'quest-pickup', step: s.index }])}>
                  {words.button}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="stq-reward">🏆 Reward: <strong>{cr(reward)}</strong>{quest.id === 'nettle' ? ' (what Dr Nettle pays for the goods)' : ''}</p>
    </div>
  );
}

/** Dr Nettle's goods: how many are in the hold, the three nearest markets selling them today, and what he pays. */
function Goods({ galaxy, t, good, what, qty, have, pays, onShowMap }: { galaxy: Galaxy; t: Trader; good: number; what: string; qty: number; have: number; pays: number; onShowMap: (planet: number) => void }) {
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
      <p className="stq-goods__pay">
        Dr Nettle pays <strong>{pays} cr</strong> each: <strong>{cr(pays * qty)}</strong> for {qty}.
        {need > 0 && cheapest > 0 && <> Buying {need} costs about {cr(cheapest * need)}, so you make about <strong>{cr(pays * need - cheapest * need)}</strong>.</>}
      </p>
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

/** The short "Quest complete!" moment. */
export function QuestDone({ quest, reward, next, onDone }: { quest: QuestConfig; reward: number; next: QuestConfig | null; onDone: () => void }) {
  return (
    <section className="st-panel st-panel--small stq-done" aria-labelledby="stq-done-h">
      <GiverFace id={quest.id} name={quest.giver} size={112} />
      <h2 id="stq-done-h" className="st-h stq-done__h">Quest complete! 🎉</h2>
      <p className="stq-done__pay">+{reward.toLocaleString('en-NZ')} credits</p>
      <p className="st-sub">{quest.giver} says thank you, Captain!</p>
      <p className="st-soft">{next ? `Next quest: ${next.title}. It opens tomorrow.` : 'That was the last quest. You helped everyone in the galaxy!'}</p>
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary st-btn--big" onClick={onDone} data-key="go">Carry on</button>
      </div>
    </section>
  );
}
