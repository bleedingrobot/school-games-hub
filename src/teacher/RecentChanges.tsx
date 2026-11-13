/**
 * "Recent changes" on Class set-up (teacher controls card C6): the last 20 setting changes for a class, in plain words, with
 * who and when. Teachers only (the database refuses anyone else). Nothing is ever removed from it.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { gameMathsColumn, gameSwitchColumn, fetchSettingsChanges, whenText, type SettingChange } from '../data/settingsChanges';
import { onSettingsForgotten } from '../data/settingsMemory';
import { GAMES } from '../games/registry';

/** Class switches that aren't a game's own. */
const CONTROLS: Record<string, string> = {
  multiplayer_enabled: 'Games against friends',
  space_reactions_enabled: 'Emoji reactions',
  non_maths_games: 'Non-maths games',
  training_first: 'Training before games',
  question_skips: 'Skip button',
  unlimited_days: 'Unlimited turns today',
  discount_days: 'Discount day',
  students_choose_focus: 'Students choose their focus',
  maths_auto: 'Auto maths',
};

const WORDS: Record<string, string> = { limited: 'limited', choose: 'Students choose', on: 'On', off: 'Off', true: 'on', false: 'off' };

function gameLabels(): Map<string, { name: string; kind: 'switch' | 'maths' }> {
  const m = new Map<string, { name: string; kind: 'switch' | 'maths' }>();
  for (const g of GAMES) {
    m.set(gameSwitchColumn(g.id), { name: g.name, kind: 'switch' });
    m.set(gameMathsColumn(g.id), { name: `${g.name} maths`, kind: 'maths' });
  }
  return m;
}

const sentence = (v: unknown): string => {
  if (v === null || v === undefined) return 'nothing';
  if (typeof v === 'boolean') return WORDS[String(v)];
  if (typeof v === 'string') return WORDS[v] ?? v;
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'none';
  if (typeof v === 'object') return 'new settings';
  return String(v);
};

/** 'Mr Tane turned Clan Quest off', 'tane changed Skip button from On to 3 per game'. Exported for the tests. */
export function describeChange(c: Pick<SettingChange, 'who' | 'setting' | 'from' | 'to'>, labels = gameLabels()): string {
  const game = labels.get(c.setting);
  const label = game?.name ?? CONTROLS[c.setting] ?? c.setting.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
  if (typeof c.to === 'boolean' && c.setting !== 'unlimited_days' && c.setting !== 'discount_days') return `${c.who} turned ${label} ${c.to ? 'on' : 'off'}`;
  if (c.setting === 'unlimited_days' || c.setting === 'discount_days') return `${c.who} changed ${label}`;
  return `${c.who} changed ${label} from ${sentence(c.from)} to ${sentence(c.to)}`;
}

export function RecentChanges({ classId }: { classId: string }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<SettingChange[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => onSettingsForgotten(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    let current = true;
    fetchSettingsChanges(classId, 20).then(
      (r) => current && (setRows(r), setFailed(false)),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [classId, tick]);
  const labels = gameLabels();

  return (
    <section aria-labelledby={`changes-${classId}`} className="class-panel__section">
      <h3 id={`changes-${classId}`}>Recent changes</h3>
      {failed ? (
        <p className="panel__empty">We couldn’t load the changes.</p>
      ) : !rows ? (
        <p className="panel__empty">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="panel__empty">No changes yet.</p>
      ) : (
        <ul className="class-panel__list recent-changes">
          {rows.map((r) => (
            <li key={r.id}>
              <span>{describeChange({ ...r, who: profile && r.by === profile.id ? 'You' : r.who }, labels)}</span>
              <span className="people-list__real">{whenText(r.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
