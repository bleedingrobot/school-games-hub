/**
 * Games Hub Pulse (/teacher/:classId/pulse, James 27 Nov 2026 NZ): how the whole school is using the hub, live. Every game,
 * activity and Class Live game, the week against last week, maths answers, classes and when pupils play. Counts only, never
 * names, so it is safe on a projector. It refreshes itself every two minutes while the tab is in view.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchGameSwitches, switchColumnOf } from '../../data/games';
import { answerKind, fetchPulse, type Pulse, type PulseDay, type PulseGame, type PulseHour } from '../../data/pulse';
import { ago } from '../../data/ago';
import { LIVE_GAMES } from '../../games/classlive/gameList';
import { useTeacherClass } from '../TeacherClass';
import { PULSE_GROUPS, pulseRows, type PulseRow } from './games';
import './pulse.css';

const REFRESH_MS = 120_000;
const fmt = (n: number) => n.toLocaleString('en-NZ');
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

function usePulse() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPulse(await fetchPulse());
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'We couldn’t load the Pulse.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);
  return { pulse, failed, loading, reload: load };
}

/** "+12" / "-3" / "same" against last week, coloured. */
function Change({ now, before }: { now: number; before: number }) {
  const diff = now - before;
  if (diff === 0) return <span className="pulse-change">same</span>;
  return (
    <span className={`pulse-change pulse-change--${diff > 0 ? 'up' : 'down'}`}>
      {diff > 0 ? '▲' : '▼'} {fmt(Math.abs(diff))}
    </span>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="pulse-tile">
      <div className="pulse-tile__value">{value}</div>
      <div className="pulse-tile__label">{label}</div>
      {note && <div className="pulse-tile__note">{note}</div>}
    </div>
  );
}

const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });

/** Goes per day for 28 days, with weekends paler. Hover (or tap) a bar for the day's numbers. */
function DailyChart({ days }: { days: PulseDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.plays));
  const w = 100 / Math.max(1, days.length);
  return (
    <div className="pulse-chart" role="img" aria-label="Goes per day for the last four weeks">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="pulse-chart__svg">
        {days.map((d, i) => {
          const h = (36 * d.plays) / max;
          const dow = new Date(`${d.d}T12:00:00`).getDay();
          return (
            <rect key={d.d} x={i * w + w * 0.12} y={40 - h} width={w * 0.76} height={Math.max(h, 0.3)}
              className={dow === 0 || dow === 6 ? 'pulse-bar pulse-bar--weekend' : 'pulse-bar'}>
              <title>{`${dayLabel(d.d)}: ${fmt(d.plays)} goes by ${fmt(d.players)} pupils, ${fmt(d.answered)} maths answers (${pct(d.correct, d.answered)}% right)`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="pulse-chart__axis">
        <span>{days[0] ? dayLabel(days[0].d) : ''}</span>
        <span>Busiest day: {fmt(max)} goes</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function HoursChart({ hours }: { hours: PulseHour[] }) {
  const shown = hours.filter((h) => h.h >= 6 && h.h <= 22);
  const max = Math.max(1, ...shown.map((h) => h.weekday + h.weekend));
  return (
    <div className="pulse-hours" role="img" aria-label="Goes by hour of the day, last four weeks">
      {shown.map((h) => (
        <div key={h.h} className="pulse-hours__col" title={`${h.h}:00 to ${h.h + 1}:00: ${fmt(h.weekday)} on school days, ${fmt(h.weekend)} at weekends`}>
          <div className="pulse-hours__bar">
            <span className="pulse-hours__weekday" style={{ height: `${(100 * h.weekday) / max}%` }} />
            <span className="pulse-hours__weekend" style={{ height: `${(100 * h.weekend) / max}%` }} />
          </div>
          <span className="pulse-hours__label">{h.h === 12 ? '12p' : h.h > 12 ? `${h.h - 12}p` : `${h.h}a`}</span>
        </div>
      ))}
    </div>
  );
}

const EMPTY: PulseGame = { id: '', today: 0, plays7: 0, playsPrev7: 0, players7: 0, plays28: 0, playsEver: 0, playersEver: 0, firstAt: null, lastAt: null };

function GamesTable({ pulse, switches }: { pulse: Pulse; switches: Record<string, boolean> | null }) {
  const [sort, setSort] = useState<'group' | 'week'>('group');
  const byId = useMemo(() => new Map(pulse.games.map((g) => [g.id, g])), [pulse.games]);
  const rows = useMemo(() => pulseRows(pulse.games.map((g) => g.id)), [pulse.games]);
  const stat = (r: PulseRow) => byId.get(r.id) ?? { ...EMPTY, id: r.id };
  const onFor = (r: PulseRow): boolean | null => {
    if (!switches || !r.game) return null;
    const col = switchColumnOf(r.game);
    return col ? switches[col] === true : true;
  };
  const byWeek = (a: PulseRow, b: PulseRow) => stat(b).plays7 - stat(a).plays7 || stat(b).playsEver - stat(a).playsEver;
  const line = (r: PulseRow) => {
    const s = stat(r);
    const on = onFor(r);
    return (
      <tr key={r.id} data-game={r.id}>
        <td>
          <div className="pulse-game__name">
            {r.name}
            {r.inDevelopment && <span className="pulse-tag">In development</span>}
          </div>
          <div className="pulse-game__tag">{r.tagline}</div>
        </td>
        <td className="pulse-num">
          <strong>{fmt(s.plays7)}</strong>
          <div className="pulse-sub"><Change now={s.plays7} before={s.playsPrev7} /></div>
        </td>
        <td className="pulse-num">{fmt(s.players7)}</td>
        <td className="pulse-num pulse-wide">{fmt(s.today)}</td>
        <td className="pulse-num pulse-wide">{fmt(s.plays28)}</td>
        <td className="pulse-num">
          {fmt(s.playsEver)}
          <div className="pulse-sub">{fmt(s.playersEver)} pupils</div>
        </td>
        <td className="pulse-wide">
          {s.lastAt ? ago(s.lastAt) : 'Not yet'}
          <div className="pulse-sub">{r.unit}</div>
        </td>
        <td>{on === null ? '' : on ? <span className="pulse-on">On</span> : <span className="pulse-off">Off</span>}</td>
      </tr>
    );
  };
  const head = (
    <thead>
      <tr>
        <th>Game</th>
        <th className="pulse-num">This week</th>
        <th className="pulse-num">Pupils</th>
        <th className="pulse-num pulse-wide">Today</th>
        <th className="pulse-num pulse-wide">4 weeks</th>
        <th className="pulse-num">All time</th>
        <th className="pulse-wide">Last played</th>
        <th>Your class</th>
      </tr>
    </thead>
  );
  return (
    <section className="panel pulse-panel" aria-labelledby="pulse-games">
      <div className="pulse-panel__head">
        <h2 id="pulse-games" className="panel__title">Every game and activity ({rows.length})</h2>
        <label className="pulse-sort">
          Order{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as 'group' | 'week')}>
            <option value="group">By kind of game</option>
            <option value="week">Most played this week</option>
          </select>
        </label>
      </div>
      <p className="pulse-note">“This week” is the last 7 days against the 7 before. A go is a finished game unless it says otherwise under Last played. “Your class” is whether it is switched on for the class in the header.</p>
      <div className="pulse-scroll">
        <table className="pulse-table">
          {head}
          {sort === 'week' ? (
            <tbody>{[...rows].sort(byWeek).map(line)}</tbody>
          ) : (
            PULSE_GROUPS.map(({ group, title }) => {
              const list = rows.filter((r) => r.group === group).sort(byWeek);
              if (list.length === 0) return null;
              const week = list.reduce((n, r) => n + stat(r).plays7, 0);
              return (
                <tbody key={group}>
                  <tr className="pulse-table__group">
                    <th colSpan={8}>
                      {title} · {fmt(week)} goes this week
                    </th>
                  </tr>
                  {list.map(line)}
                </tbody>
              );
            })
          )}
        </table>
      </div>
    </section>
  );
}

function LiveTable({ pulse }: { pulse: Pulse }) {
  const byId = new Map(pulse.live.map((l) => [l.id, l]));
  const rows = LIVE_GAMES.map((g) => ({ g, s: byId.get(g.id) }));
  rows.sort((a, b) => (b.s?.sessions ?? 0) - (a.s?.sessions ?? 0));
  return (
    <section className="panel pulse-panel" aria-labelledby="pulse-live">
      <h2 id="pulse-live" className="panel__title">Class Live games ({LIVE_GAMES.length})</h2>
      <p className="pulse-note">Whole-class games run from a teacher’s big screen. A session is one game opened for a class; pupils are those who joined.</p>
      <div className="pulse-scroll">
        <table className="pulse-table">
          <thead>
            <tr>
              <th>Game</th>
              <th className="pulse-num">Sessions</th>
              <th className="pulse-num">Pupils</th>
              <th className="pulse-num pulse-wide">Times joined</th>
              <th>Last run</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ g, s }) => (
              <tr key={g.id}>
                <td>
                  <div className="pulse-game__name">
                    <span aria-hidden="true">{g.emoji}</span> {g.name}
                  </div>
                  <div className="pulse-game__tag">{g.blurb}</div>
                </td>
                <td className="pulse-num">{fmt(s?.sessions ?? 0)}</td>
                <td className="pulse-num">{fmt(s?.pupils ?? 0)}</td>
                <td className="pulse-num pulse-wide">{fmt(s?.joins ?? 0)}</td>
                <td>{s?.lastAt ? ago(s.lastAt) : 'Not yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnswersPanel({ pulse }: { pulse: Pulse }) {
  const total = pulse.answers.reduce((n, a) => n + a.answered, 0);
  return (
    <section className="panel pulse-panel" aria-labelledby="pulse-answers">
      <h2 id="pulse-answers" className="panel__title">Maths answers by kind</h2>
      <div className="pulse-scroll">
        <table className="pulse-table">
          <thead>
            <tr>
              <th>Kind of maths</th>
              <th className="pulse-num">This week</th>
              <th className="pulse-num">Right this week</th>
              <th className="pulse-num">All time</th>
              <th className="pulse-num pulse-wide">Share</th>
            </tr>
          </thead>
          <tbody>
            {pulse.answers.map((a) => (
              <tr key={a.source}>
                <td>{answerKind(a.source)}</td>
                <td className="pulse-num">{fmt(a.week)}</td>
                <td className="pulse-num">{a.week > 0 ? `${pct(a.weekCorrect, a.week)}%` : '–'}</td>
                <td className="pulse-num">{fmt(a.answered)}</td>
                <td className="pulse-num pulse-wide">{pct(a.answered, total)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClassesPanel({ pulse, mine }: { pulse: Pulse; mine: string | null }) {
  const classes = pulse.classes.filter((c) => c.students > 0);
  return (
    <section className="panel pulse-panel" aria-labelledby="pulse-classes">
      <h2 id="pulse-classes" className="panel__title">Classes this week</h2>
      <div className="pulse-scroll">
        <table className="pulse-table">
          <thead>
            <tr>
              <th>Class</th>
              <th className="pulse-num">Pupils</th>
              <th className="pulse-num">Playing</th>
              <th className="pulse-num">Goes</th>
              <th className="pulse-num">Last week</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id} className={c.id === mine ? 'pulse-table__mine' : undefined}>
                <td>{c.name}</td>
                <td className="pulse-num">{fmt(c.students)}</td>
                <td className="pulse-num">
                  {fmt(c.playing7)} <span className="pulse-sub">({pct(c.playing7, c.students)}%)</span>
                </td>
                <td className="pulse-num">{fmt(c.plays7)}</td>
                <td className="pulse-num">
                  {fmt(c.playsPrev7)} <Change now={c.plays7} before={c.playsPrev7} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TeacherPulse() {
  const { classId } = useTeacherClass();
  const { pulse, failed, loading, reload } = usePulse();
  const [switches, setSwitches] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!classId) return;
    let live = true;
    fetchGameSwitches(classId).then(
      (s) => live && setSwitches(s),
      () => live && setSwitches(null),
    );
    return () => {
      live = false;
    };
  }, [classId]);

  if (!pulse) {
    return (
      <section className="panel pulse-panel">
        <p className="panel__empty" role="status">{failed ?? 'Loading the Pulse…'}</p>
        {failed && (
          <button type="button" className="pulse-refresh" onClick={() => void reload()}>
            Try again
          </button>
        )}
      </section>
    );
  }
  const k = pulse.kpis;
  const answers = pulse.answers.reduce(
    (t, a) => ({ all: t.all + a.answered, week: t.week + a.week, right: t.right + a.weekCorrect, today: t.today + a.today }),
    { all: 0, week: 0, right: 0, today: 0 },
  );
  const inSchool = pct(k.schoolHours7, k.schoolHours7 + k.outsideHours7);

  return (
    <div className="pulse" data-pulse>
      <section className="panel pulse-top">
        <div>
          <h2 className="pulse-top__title">Games Hub Pulse</h2>
          <p className="pulse-note">The whole school, live. Counts only, no names. Updated {ago(pulse.asOf)}; it refreshes every two minutes.</p>
        </div>
        <button type="button" className="pulse-refresh" onClick={() => void reload()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </section>
      {failed && <p className="pulse-note" role="alert">{failed} Showing the last numbers.</p>}

      <div className="pulse-tiles">
        <Tile label="Pupils playing today" value={fmt(k.activeToday)} note={`${fmt(k.playsToday)} goes so far`} />
        <Tile label="Pupils playing this week" value={fmt(k.active7)} note={<>of {fmt(k.pupils)} · <Change now={k.active7} before={k.activePrev7} /></>} />
        <Tile label="Goes this week" value={fmt(k.plays7)} note={<Change now={k.plays7} before={k.playsPrev7} />} />
        <Tile label="Maths answers this week" value={fmt(answers.week)} note={`${pct(answers.right, answers.week)}% right · ${fmt(answers.today)} today`} />
        <Tile label="Maths answers so far" value={fmt(answers.all)} note="since the hub began" />
        <Tile label="Played in school time" value={`${inSchool}%`} note="this week, Mon–Fri 9–3" />
        <Tile label="Pupils active in 4 weeks" value={fmt(k.active28)} note={`${fmt(k.activeEver)} have ever played`} />
        <Tile label="Goes all time" value={fmt(k.playsEver)} />
      </div>

      <section className="panel pulse-panel" aria-labelledby="pulse-daily">
        <h2 id="pulse-daily" className="panel__title">Goes each day, last four weeks</h2>
        <DailyChart days={pulse.daily} />
      </section>

      <GamesTable pulse={pulse} switches={switches} />
      <LiveTable pulse={pulse} />
      <AnswersPanel pulse={pulse} />
      <ClassesPanel pulse={pulse} mine={classId} />
      <section className="panel pulse-panel" aria-labelledby="pulse-hours">
        <h2 id="pulse-hours" className="panel__title">When pupils play (last four weeks)</h2>
        <p className="pulse-note">
          <span className="pulse-key pulse-key--weekday" /> school days <span className="pulse-key pulse-key--weekend" /> weekends
        </p>
        <HoursChart hours={pulse.hours} />
      </section>
    </div>
  );
}
