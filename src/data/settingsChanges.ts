/**
 * Who changed a class setting, and when (teacher controls card C6; migration 20261112000400_settings_changes.sql). The
 * database logs one row per changed column; teachers read it through teacher_settings_changes(). Pupils can't.
 *
 * `useChangedLines(classId)` gives the little grey line under a switch ("Changed by you, 9:12am"). All the rows on a page share
 * one request, which is read again after any save (settingsMemory's forgetSettings).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { onSettingsForgotten } from './settingsMemory';

export interface SettingChange {
  id: number;
  at: string;
  by: string | null;
  /** The teacher's real name (their sign-in name), else their hub name. */
  who: string;
  setting: string;
  from: unknown;
  to: unknown;
}

const text = (v: unknown) => (typeof v === 'string' && v ? v : null);

export function parseChanges(data: unknown): SettingChange[] {
  if (!Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    at: String(r.changedAt ?? ''),
    by: text(r.changedBy),
    who: text(r.realName) ?? text(r.name) ?? 'A teacher',
    setting: String(r.setting ?? ''),
    from: r.oldValue ?? null,
    to: r.newValue ?? null,
  }));
}

/** The last `max` changes to the class's settings, newest first; or, with `latestPerSetting`, the newest change to each setting. */
export async function fetchSettingsChanges(classId: string, max = 20, latestPerSetting = false): Promise<SettingChange[]> {
  const { data, error } = await supabase.rpc('teacher_settings_changes', {
    target_class: classId,
    max_rows: max,
    latest_per_setting: latestPerSetting,
  });
  if (error) throw new Error(error.message);
  return parseChanges(data);
}

// One shared request per class for the lines under the switches; forgotten after any save.
const latest = new Map<string, Promise<SettingChange[]>>();
onSettingsForgotten(() => latest.clear());

function latestFor(classId: string): Promise<SettingChange[]> {
  let p = latest.get(classId);
  if (!p) {
    p = fetchSettingsChanges(classId, 200, true);
    p.catch(() => latest.delete(classId));
    latest.set(classId, p);
  }
  return p;
}

/** The newest change for each setting (column) of the class. Null until read, and if it couldn't be (no line is shown then). */
export function useLatestChanges(classId: string | null | undefined): ReadonlyMap<string, SettingChange> | null {
  const [state, setState] = useState<{ classId: string; map: Map<string, SettingChange> } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => onSettingsForgotten(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    if (!classId) return;
    let current = true;
    latestFor(classId).then(
      (rows) => current && setState({ classId, map: new Map(rows.map((r) => [r.setting, r])) }),
      () => current && setState(null),
    );
    return () => {
      current = false;
    };
  }, [classId, tick]);
  return state && state.classId === classId ? state.map : null;
}

const NZ = 'Pacific/Auckland';
const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: NZ }).format(d);

/** "9:12am" today, "yesterday", "Tuesday" within the week, else "3 Nov". */
export function whenText(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  if (day(at) === day(now)) {
    return new Intl.DateTimeFormat('en-NZ', { timeZone: NZ, hour: 'numeric', minute: '2-digit', hour12: true })
      .format(at)
      .replace(/\s/g, '')
      .toLowerCase();
  }
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(at))) / 86_400_000);
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return new Intl.DateTimeFormat('en-NZ', { timeZone: NZ, weekday: 'long' }).format(at);
  return new Intl.DateTimeFormat('en-NZ', { timeZone: NZ, day: 'numeric', month: 'short' }).format(at);
}

/** The line under a switch: "Changed by you, 9:12am". `me` is the signed-in teacher's id. */
export function changedLine(change: SettingChange | undefined, me: string | null | undefined, now?: Date): string | undefined {
  if (!change) return undefined;
  const when = whenText(change.at, now);
  const who = me && change.by === me ? 'you' : change.who;
  return `Changed by ${who}${when ? `, ${when}` : ''}`;
}

/** The lines for a set of columns, as `changed` text. Undefined until read, or when that column has never changed. */
export function useChangedLine(classId: string | null | undefined): (column: string | undefined) => string | undefined {
  const { profile } = useAuth();
  const map = useLatestChanges(classId);
  return (column) => (column && map ? changedLine(map.get(column), profile?.id) : undefined);
}

/** The setting column behind a game's On switch and its Maths switch. */
const SWITCH_COLUMN: Record<string, string> = { 'dragon-maths': 'lord_enabled', 'clan-quest': 'clans_enabled' };
export const gameSwitchColumn = (gameId: string) => SWITCH_COLUMN[gameId] ?? `${gameId.replace(/-/g, '_')}_enabled`;
export const gameMathsColumn = (gameId: string) => `${gameId.replace(/-/g, '_')}_maths`;
