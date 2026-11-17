/**
 * Quests (/teacher/:classId/quests): start a weekly class quest, watch every pupil's seven days, stop it, look back at past
 * quests (docs/CLASS-QUESTS-PLAN.md). The database checks every action; names come from the teacher's own pupil list.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { DAYS_NEEDED, QUEST_KINDS, questKind, type QuestKind } from '../../shared/quests/kinds';
import { questWeek, weekday } from '../../shared/quests/week';
import { FriendlyError } from '../data/profile';
import { fetchPeople, type Person } from '../data/teacher';
import { fetchTeacherQuests, startQuest, stopQuest, type TeacherQuests as Data } from '../data/quests';
import { useTeacherClass } from '../teacher/TeacherClass';
import { questArt } from './art';
import './teacherQuests.css';

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
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [which, setWhich] = useState<string | undefined>();
  const [picked, setPicked] = useState<QuestKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchTeacherQuests(classId, which));
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

  const running = data?.quests.find((q) => !q.stoppedAt && q.endsOn >= data.today && q.startsOn <= data.today);
  const shown = data?.quests.find((q) => q.id === data.shown);

  async function act(job: () => Promise<void>) {
    setBusy(true);
    try {
      await job();
      setWhich(undefined);
      setPicked(null);
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

      {data && !running && (
        <section className="panel" aria-labelledby="tq-start">
          <h2 id="tq-start" className="panel__title">Start a weekly quest</h2>
          <p className="tquests__line">
            Pupils play the quest&rsquo;s game properly (all of that day&rsquo;s turns) on {DAYS_NEEDED} of the next 7 days. It starts
            today and ends by itself. They see it on their home page. You can play along and finish it too.
          </p>
          <div className="tquests__cards">
            {QUEST_KINDS.map((k) => {
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
                  <span className="tquests__card-name">
                    {k.game}: <strong>{k.name}</strong>
                  </span>
                  <span className="tquests__card-rule">{k.daily}, {DAYS_NEEDED} days out of 7</span>
                  {!on && <span className="tquests__card-off">{k.game} is switched off for this class: turn it on in Games first.</span>}
                </button>
              );
            })}
          </div>
          <p>
            <button type="button" className="button button--play" disabled={!picked || busy} onClick={() => picked && act(() => startQuest(classId, picked))}>
              Start this week&rsquo;s quest
            </button>
          </p>
        </section>
      )}

      {data && shown && (
        <QuestTable
          data={data}
          people={people}
          isRunning={shown.id === running?.id}
          busy={busy}
          onStop={() => {
            if (window.confirm('Stop this quest? Pupils who already finished keep their win.')) void act(() => stopQuest(classId));
          }}
        />
      )}

      {data && data.quests.length > 0 && (
        <section className="panel" aria-labelledby="tq-past">
          <h2 id="tq-past" className="panel__title">All quests</h2>
          <ul className="tquests__past">
            {data.quests.map((q) => {
              const k = questKind(q.kind);
              return (
                <li key={q.id}>
                  <button type="button" className={`tquests__past-row${q.id === data.shown ? ' is-shown' : ''}`} onClick={() => setWhich(q.id)}>
                    <span>{niceDate(q.startsOn)} – {niceDate(q.endsOn)}</span>
                    <span>{k ? `${k.game}: ${k.name}` : q.kind}</span>
                    <span>🏅 {q.won} finished{q.stoppedAt ? ' · stopped' : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {data && data.quests.length === 0 && running === undefined && (
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
    return named.sort((a, b) => Number(!!a.teacher) - Number(!!b.teacher) || Number(a.won) - Number(b.won) || a.week.done - b.week.done || a.name.localeCompare(b.name));
  }, [data, people, quest.startsOn]);
  const days = rows[0]?.week.days ?? questWeek(quest.startsOn, data.today, [], DAYS_NEEDED).days;

  return (
    <section className="panel tquests__now" aria-labelledby="tq-now">
      <div className="tquests__head">
        <h2 id="tq-now" className="panel__title">
          {k ? `${k.game}: ${k.name}` : quest.kind}
        </h2>
        <p className="tquests__line">
          {niceDate(quest.startsOn)} – {niceDate(quest.endsOn)} · <strong>{quest.won} of {data.pupils.length} finished</strong>
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
              <th scope="col">Days</th>
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
                  {Math.min(r.week.done, DAYS_NEEDED)}/{DAYS_NEEDED}
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
