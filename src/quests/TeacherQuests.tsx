/**
 * Quests (/teacher/:classId/quests): start a class quest (one daily and one weekly can run together, James 18 Nov 2026), watch
 * every pupil's seven days, stop it, look back at past quests (docs/CLASS-QUESTS-PLAN.md). The database checks every action; names come from the teacher's own pupil list.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { DAYS_NEEDED, isDaily, QUEST_KINDS, questKind, type QuestGroup, type QuestKind, type QuestKindInfo } from '../../shared/quests/kinds';
import { DEFAULT_REWARD, QUEST_REWARDS, questReward, rewardFit, type QuestReward } from '../../shared/quests/rewards';
import { questWeek, weekday } from '../../shared/quests/week';
import { FriendlyError } from '../data/profile';
import { fetchPeople, type Person } from '../data/teacher';
import { fetchTeacherQuests, startQuest, stopQuest, type TeacherQuests as Data } from '../data/quests';
import { useTeacherClass } from '../teacher/TeacherClass';
import { questArt } from './art';
import './teacherQuests.css';

const GROUPS: { id: QuestGroup; title: string }[] = [
  { id: 'complex', title: 'Complex maths' },
  { id: 'easy', title: 'Easy maths' },
];
const gamesIn = (kinds: QuestKindInfo[], group: QuestGroup) => [...new Set(kinds.filter((k) => k.group === group).map((k) => k.game))];
const dailyKind = (kind: QuestKind) => {
  const k = questKind(kind);
  return !k || isDaily(k.rule);
};
const ruleLine = (k: QuestKindInfo) => (isDaily(k.rule) ? `${k.goal}, ${DAYS_NEEDED} days out of 7` : `${k.goal} this week, any days`);

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

const niceDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

export function TeacherQuests() {
  const { classId } = useTeacherClass();
  if (!classId) return null;
  return <QuestsPage key={classId} classId={classId} />;
}

function QuestsPage({ classId }: { classId: string }) {
  const [data, setData] = useState<Data | null>(null);
  /** The other running quest's table, when two run and the teacher hasn't picked one from the list. */
  const [other, setOther] = useState<Data | null>(null);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [which, setWhich] = useState<string | undefined>();
  const [picked, setPicked] = useState<QuestKind | null>(null);
  const [reward, setReward] = useState<QuestReward>(DEFAULT_REWARD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const first = await fetchTeacherQuests(classId, which);
      const second = which ? undefined : first.quests.find((q) => q.id !== first.shown && !q.stoppedAt && q.startsOn <= first.today && q.endsOn >= first.today);
      setOther(second ? await fetchTeacherQuests(classId, second.id) : null);
      setData(first);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [classId, which]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetchPeople()
      .then((list) => setPeople(new Map(list.map((p) => [p.id, p]))))
      .catch(() => setPeople(new Map()));
  }, []);

  const running = data?.quests.filter((q) => !q.stoppedAt && q.endsOn >= data.today && q.startsOn <= data.today) ?? [];
  const dailyOn = running.some((q) => dailyKind(q.kind));
  const weeklyOn = running.some((q) => !dailyKind(q.kind));
  // Only the kind of quest the class isn't running yet can start.
  const startable = QUEST_KINDS.filter((k) => (isDaily(k.rule) ? !dailyOn : !weeklyOn));
  const tables = [data, other].filter((d): d is Data => !!d?.quests.some((q) => q.id === d.shown));

  async function act(job: () => Promise<void>) {
    setBusy(true);
    try {
      await job();
      setWhich(undefined);
      setPicked(null);
      setReward(DEFAULT_REWARD);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tquests">
      {error && <p className="tquests__error" role="alert">{error}</p>}

      {data && startable.length > 0 && (
        <section className="panel" aria-labelledby="tq-start">
          <h2 id="tq-start" className="panel__title">
            {dailyOn ? 'Add a weekly quest' : weeklyOn ? 'Add a daily quest' : 'Start a quest'}
          </h2>
          <p className="tquests__line">
            {dailyOn || weeklyOn
              ? `Your class can run a daily and a weekly quest at the same time. Pick a ${dailyOn ? 'weekly' : 'daily'} quest to run alongside.`
              : `Daily quests: a little play on ${DAYS_NEEDED} of the next 7 days. Weekly quests: a total by the end of the week, on any days. You can run one of each at the same time.`}{' '}
            Every quest starts today and ends by itself after 7 days. Pupils see it on their home page, and you can play along too.
          </p>
          {GROUPS.map((group) => (
            <div key={group.id} className="tquests__group">
              <h3 className="tquests__group-title">{group.title}</h3>
              {gamesIn(startable, group.id).map((game) => (
                <div key={game} className="tquests__game">
                  <h4 className="tquests__game-title">{game}</h4>
                  <div className="tquests__cards">
                    {startable.filter((k) => k.group === group.id && k.game === game).map((k) => {
                      const on = data.switches[k.id] !== false;
                      const art = questArt(k.id, true);
                      return (
                        <button
                          key={k.id}
                          type="button"
                          className={`tquests__card${picked === k.id ? ' is-picked' : ''}`}
                          style={{ '--tq-art': art ? `url(${art})` : undefined } as CSSProperties}
                          aria-pressed={picked === k.id}
                          onClick={() => setPicked(k.id)}
                        >
                          <span className="tquests__card-kind">{isDaily(k.rule) ? 'Daily' : 'Weekly'}</span>
                          <span className="tquests__card-name">
                            <strong>{k.name}</strong>
                          </span>
                          <span className="tquests__card-rule">{ruleLine(k)}</span>
                          {!on && <span className="tquests__card-off">{k.game} is switched off for this class: turn it on in Games first.</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="tquests__group" role="radiogroup" aria-labelledby="tq-reward">
            <h3 id="tq-reward" className="tquests__group-title">Reward for finishing</h3>
            <div className="tquests__rewards">
              {QUEST_REWARDS.map((r) => {
                const why = rewardFit(picked, r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    className={`tquests__reward${reward === r.id ? ' is-picked' : ''}`}
                    aria-checked={reward === r.id}
                    disabled={why !== null}
                    onClick={() => setReward(r.id)}
                  >
                    <span className="tquests__reward-emoji" aria-hidden="true">{r.emoji}</span>
                    <strong>{r.name}</strong>
                    <span className="tquests__reward-what">{r.what}</span>
                    {why && <span className="tquests__reward-why">{why}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="tquests__startbar">
            <span>{picked ? `${questKind(picked)?.game}: ${questKind(picked)?.name}` : 'Pick a quest above'}</span>
            <button
              type="button"
              className="button button--play"
              disabled={!picked || busy || rewardFit(picked, reward) !== null}
              onClick={() => picked && act(() => startQuest(classId, picked, reward))}
            >
              Start this quest · Reward: {questReward(reward)?.name}
            </button>
          </div>
        </section>
      )}

      {tables.map((t) => (
        <QuestTable
          key={t.shown}
          data={t}
          people={people}
          isRunning={running.some((q) => q.id === t.shown)}
          busy={busy}
          onStop={() => {
            const id = t.shown;
            if (id && window.confirm('Stop this quest? Pupils who already finished keep their win.')) void act(() => stopQuest(classId, id));
          }}
        />
      ))}

      {data && data.quests.length > 0 && (
        <section className="panel" aria-labelledby="tq-past">
          <h2 id="tq-past" className="panel__title">All quests</h2>
          <ul className="tquests__past">
            {data.quests.map((q) => {
              const k = questKind(q.kind);
              return (
                <li key={q.id}>
                  <button type="button" className={`tquests__past-row${q.id === data.shown || q.id === other?.shown ? ' is-shown' : ''}`} onClick={() => setWhich(q.id)}>
                    <span>{niceDate(q.startsOn)} – {niceDate(q.endsOn)}</span>
                    <span>{k ? `${k.game}: ${k.name}` : q.kind}</span>
                    <span>🏅 {q.won} finished{q.reward ? ` · ${questReward(q.reward)?.emoji} ${questReward(q.reward)?.name}` : ''}{q.stoppedAt ? ' · stopped' : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {data && data.quests.length === 0 && (
        <p className="tquests__line">No quests yet. Achievements come at 1, 5, 10, 15 and 20 quests finished, and the Questing Hero trophy at 5, 10 and 20.</p>
      )}
      {!data && !error && <p className="panel__empty">Loading…</p>}
    </div>
  );
}

function QuestTable({ data, people, isRunning, busy, onStop }: { data: Data; people: Map<string, Person>; isRunning: boolean; busy: boolean; onStop: () => void }) {
  const quest = data.quests.find((q) => q.id === data.shown)!;
  const k = questKind(quest.kind);
  const rows = useMemo(() => {
    const named = data.pupils.map((p) => {
      const person = people.get(p.id);
      const week = questWeek(quest.startsOn, data.today, p.days, DAYS_NEEDED);
      const name = p.teacher ? `${p.name ?? 'Teacher'} (teacher)` : person?.real_name || person?.display_name || 'Pupil';
      return { ...p, week, name };
    });
    // Pupils who still need days first (fewest done at the top), finished pupils after them, teachers last.
    return named.sort((a, b) => Number(!!a.teacher) - Number(!!b.teacher) || Number(a.won) - Number(b.won) || (a.count ?? a.week.done) - (b.count ?? b.week.done) || a.name.localeCompare(b.name));
  }, [data, people, quest.startsOn]);
  const daily = !k || isDaily(k.rule);
  const days = rows[0]?.week.days ?? questWeek(quest.startsOn, data.today, [], DAYS_NEEDED).days;

  return (
    <section className="panel tquests__now" aria-labelledby="tq-now">
      <div className="tquests__head">
        <h2 id="tq-now" className="panel__title">
          {k ? `${isDaily(k.rule) ? 'Daily' : 'Weekly'} quest · ${k.game}: ${k.name}` : quest.kind}
        </h2>
        <p className="tquests__line">
          {niceDate(quest.startsOn)} – {niceDate(quest.endsOn)} · <strong>{quest.won} of {data.pupils.length} finished</strong>
          {quest.reward && ` · Reward: ${questReward(quest.reward)?.emoji} ${questReward(quest.reward)?.name}`}
          {quest.stoppedAt ? ' · stopped' : isRunning ? '' : ' · ended'}
        </p>
        {isRunning && (
          <button type="button" className="button tquests__stop" disabled={busy} onClick={onStop}>
            Stop quest
          </button>
        )}
      </div>
      <div className="tquests__scroll">
        <table className="tquests__table">
          <thead>
            <tr>
              <th scope="col">Pupil</th>
              {days.map((d) => (
                <th key={d.date} scope="col" className={d.date === data.today ? 'is-today' : undefined}>
                  {weekday(d.date)}
                </th>
              ))}
              <th scope="col">{daily || !k ? 'Days' : k.unit.many[0].toUpperCase() + k.unit.many.slice(1)}</th>
              <th scope="col" title="Quests finished, all time">Quests</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={[r.won ? 'is-won' : '', r.teacher ? 'is-teacher' : ''].join(' ').trim() || undefined}>
                <th scope="row">{r.name}</th>
                {r.week.days.map((d) => (
                  <td key={d.date}>
                    <span className={`tquests__dot is-${d.state}`} aria-label={d.state === 'done' ? 'done' : d.state} />
                  </td>
                ))}
                <td>
                  {r.won ? '✓ ' : ''}
                  {daily ? `${Math.min(r.week.done, DAYS_NEEDED)}/${DAYS_NEEDED}` : `${Math.min(r.count ?? 0, r.target ?? 0)}/${r.target ?? k?.amount ?? ''}`}
                </td>
                <td>{r.questsDone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tquests__key">
        <span className="tquests__dot is-done" /> done <span className="tquests__dot is-today" /> today{' '}
        <span className="tquests__dot is-missed" /> missed <span className="tquests__dot is-later" /> to come
      </p>
    </section>
  );
}
