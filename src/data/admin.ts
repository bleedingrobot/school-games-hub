/**
 * The Admin pages (docs/TEACHER-VIEW-PLAN.md, section 4.7, stage 6): the school at a glance, every student, every teacher. All
 * are checked on the server, which refuses anyone who isn't a school admin and only ever reads the admin's own school.
 */
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const time = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
const rows = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string');
const small = (v: unknown) => rows(v).map((c) => ({ id: c.id as string, name: String(c.name ?? '') }));

export interface AdminOverview {
  counts: { classes: number; students: number; teachers: number; admins: number; activeWeek: number; shownWeek: number; skippedWeek: number };
  /** Students in no class (or only in an archived one). */
  noClass: number;
  classesNoTeacher: { id: string; name: string }[];
  /** Pending requests to join a class that are more than a day old. */
  oldWarp: number;
}

export function parseAdminOverview(raw: unknown): AdminOverview {
  const r = (raw ?? {}) as Record<string, unknown>;
  const c = (r.counts ?? {}) as Record<string, unknown>;
  return {
    counts: {
      classes: count(c.classes),
      students: count(c.students),
      teachers: count(c.teachers),
      admins: count(c.admins),
      activeWeek: count(c.activeWeek),
      shownWeek: count(c.shownWeek),
      skippedWeek: count(c.skippedWeek),
    },
    noClass: count(r.noClass),
    classesNoTeacher: small(r.classesNoTeacher),
    oldWarp: count(r.oldWarp),
  };
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error || !data) fail(error, 'We couldn’t load the school.');
  return parseAdminOverview(data);
}

export interface AdminStudent {
  id: string;
  name: string;
  /** The part of their school email before the @. */
  realName: string | null;
  avatar: unknown;
  hidden: boolean;
  classId: string | null;
  className: string | null;
  classArchived: boolean;
  lastPlayed: string | null;
}

export function parseAdminStudents(raw: unknown): AdminStudent[] {
  const r = (raw ?? {}) as { students?: unknown };
  return rows(r.students).map((s) => ({
    id: s.id as string,
    name: String(s.name ?? ''),
    realName: text(s.realName),
    avatar: s.avatar ?? {},
    hidden: s.hidden === true,
    classId: text(s.classId),
    className: text(s.className),
    classArchived: s.classArchived === true,
    lastPlayed: time(s.lastPlayed),
  }));
}

export async function fetchAdminStudents(): Promise<AdminStudent[]> {
  const { data, error } = await supabase.rpc('admin_students');
  if (error || !data) fail(error, 'We couldn’t load the students.');
  return parseAdminStudents(data);
}

export interface AdminTeacher {
  id: string;
  name: string;
  realName: string | null;
  avatar: unknown;
  admin: boolean;
  /** Is this the person asking? */
  me: boolean;
  classes: { id: string; name: string }[];
}

export function parseAdminTeachers(raw: unknown): AdminTeacher[] {
  const r = (raw ?? {}) as { teachers?: unknown };
  return rows(r.teachers).map((t) => ({
    id: t.id as string,
    name: String(t.name ?? ''),
    realName: text(t.realName),
    avatar: t.avatar ?? {},
    admin: t.admin === true,
    me: t.me === true,
    classes: small(t.classes),
  }));
}

export async function fetchAdminTeachers(): Promise<AdminTeacher[]> {
  const { data, error } = await supabase.rpc('admin_teachers');
  if (error || !data) fail(error, 'We couldn’t load the teachers.');
  return parseAdminTeachers(data);
}

/** Make a teacher a school admin, or take it away. The database refuses your own row. */
export async function setSchoolAdmin(person: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('school_set_admin', { person, make_admin: on });
  if (error) fail(error, 'We couldn’t change that.');
}

export interface AdminClass {
  id: string;
  name: string;
  schoolYear: number | null;
  yearLevel: number | null;
  archived: boolean;
  archivedAt: string | null;
  warpCode: string | null;
  warpMode: 'on' | 'ask' | 'off';
  students: number;
  teachers: { id: string; name: string; realName: string | null }[];
  lastActive: string | null;
}

export function parseAdminClasses(raw: unknown): AdminClass[] {
  const r = (raw ?? {}) as { classes?: unknown };
  return rows(r.classes).map((c) => ({
    id: c.id as string,
    name: String(c.name ?? ''),
    schoolYear: typeof c.schoolYear === 'number' && Number.isFinite(c.schoolYear) ? Math.floor(c.schoolYear) : null,
    yearLevel: typeof c.yearLevel === 'number' && Number.isFinite(c.yearLevel) ? Math.floor(c.yearLevel) : null,
    archived: c.archived === true,
    archivedAt: time(c.archivedAt),
    warpCode: text(c.warpCode),
    warpMode: c.warpMode === 'ask' || c.warpMode === 'off' ? c.warpMode : 'on',
    students: count(c.students),
    teachers: rows(c.teachers).map((t) => ({ id: t.id as string, name: String(t.name ?? ''), realName: text(t.realName) })),
    lastActive: time(c.lastActive),
  }));
}

export async function fetchAdminClasses(): Promise<AdminClass[]> {
  const { data, error } = await supabase.rpc('admin_classes');
  if (error || !data) fail(error, 'We couldn’t load the classes.');
  return parseAdminClasses(data);
}

/** Make a class that belongs to the chosen teacher (yourself or someone else). A blank name uses the default. */
export async function createClassFor(name: string, year: number, level: number | null, teacher: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_class', { class_name: name, in_year: year, level, teacher });
  if (error || !data) fail(error, 'We couldn’t make that class.');
  return data as string;
}
