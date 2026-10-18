/**
 * Classes and Class Warp. Every function here is checked on the server: the database decides who
 * may see or change a class, whatever the page does. Students only ever get a class or group
 * name back after typing a code that works.
 */
import { normaliseCode } from '../../shared/multiplayer';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

export type WarpMode = 'on' | 'ask' | 'off';

export interface ClassSummary {
  id: string;
  name: string;
  school_year: number;
  year_level: number | null;
  archived: boolean;
  warp_code: string;
  warp_mode: WarpMode;
  members: number;
  /** Whether I teach it (a school admin sees classes they don't teach too). */
  teaching: boolean;
  groups: number;
  /** Students waiting for a yes. */
  waiting: number;
}

export interface ClassMember {
  id: string;
  name: string;
  realName: string | null;
  avatar: unknown;
  hidden: boolean;
  joinedAt: string;
  group: string | null;
  groupId?: string | null;
}

export interface ClassGroup {
  id: string;
  name: string;
  warpCode: string;
  warpMode: WarpMode;
  members: number;
}

export interface ClassDetail {
  id: string;
  name: string;
  schoolYear: number;
  yearLevel: number | null;
  archived: boolean;
  warpCode: string;
  warpMode: WarpMode;
  members: ClassMember[];
  groups: ClassGroup[];
  teachers: { id: string; name: string; realName: string | null }[];
}

export interface UnassignedStudent {
  id: string;
  display_name: string;
  real_name: string | null;
  avatar: unknown;
}

export interface SchoolTeacher {
  id: string;
  display_name: string;
  real_name: string | null;
}

export type WarpEventKind = 'joined' | 'joined-group' | 'added' | 'moved-in' | 'moved-out' | 'removed' | 'asked' | 'declined';

export interface WarpEvent {
  id: number;
  at: string;
  kind: WarpEventKind;
  student_name: string;
  group_name: string | null;
}

export interface WarpRequest {
  id: string;
  class_id: string;
  class_name: string;
  group_name: string | null;
  student_name: string;
  asked_at: string;
}

export interface SchoolInfo {
  id: number;
  name: string;
  admin: boolean;
}

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string }, fallback: string): never {
  if (error.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export async function fetchMySchool(): Promise<SchoolInfo | null> {
  const { data, error } = await supabase.rpc('my_school_info');
  if (error) fail(error, 'We couldn’t load your school.');
  return (data as SchoolInfo | null) ?? null;
}

export async function fetchClasses(includeArchived = false): Promise<ClassSummary[]> {
  const { data, error } = await supabase.rpc('teacher_classes', { include_archived: includeArchived });
  if (error || !data) fail(error ?? {}, 'We couldn’t load your classes.');
  return data as ClassSummary[];
}

export async function fetchClassDetail(id: string): Promise<ClassDetail> {
  const { data, error } = await supabase.rpc('teacher_class_detail', { target: id });
  if (error || !data) fail(error ?? {}, 'We couldn’t load that class.');
  return data as ClassDetail;
}

export async function createClass(name: string, year: number, level: number | null): Promise<string> {
  const { data, error } = await supabase.rpc('teacher_create_class', { class_name: name, in_year: year, level });
  if (error || !data) fail(error ?? {}, 'We couldn’t make that class.');
  return data as string;
}

/** Renames a class (and sets its year and year level). Teachers see the name; students only after typing a right code. */
export async function updateClass(id: string, name: string, year: number, level: number | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_update_class', { target: id, class_name: name, in_year: year, level });
  if (error) fail(error, 'We couldn’t rename that class.');
}

export async function createGroup(classId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('teacher_create_group', { target: classId, group_name: name });
  if (error || !data) fail(error ?? {}, 'We couldn’t make that group.');
  return data as string;
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_rename_group', { target: groupId, group_name: name });
  if (error) fail(error, 'We couldn’t rename that group.');
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_delete_group', { target: groupId });
  if (error) fail(error, 'We couldn’t delete that group.');
}

/** Puts a student in a group of their class (leaving the group they were in), or takes them out of it. */
export async function setGroupMember(groupId: string, student: string, member: boolean): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_group_member', { target: groupId, student, member });
  if (error) fail(error, 'We couldn’t change that group.');
}

export async function archiveClass(id: string, archive: boolean): Promise<void> {
  const { error } = await supabase.rpc('teacher_archive_class', { target: id, archive });
  if (error) fail(error, 'We couldn’t change that class.');
}

export async function fetchUnassigned(): Promise<UnassignedStudent[]> {
  const { data, error } = await supabase.rpc('teacher_unassigned_students');
  if (error || !data) fail(error ?? {}, 'We couldn’t load the list of students.');
  return data as UnassignedStudent[];
}

export async function fetchSchoolTeachers(): Promise<SchoolTeacher[]> {
  const { data, error } = await supabase.rpc('teacher_school_teachers');
  if (error || !data) fail(error ?? {}, 'We couldn’t load the teachers.');
  return data as SchoolTeacher[];
}

export async function addToClass(id: string, students: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('teacher_add_to_class', { target: id, students });
  if (error) fail(error, 'We couldn’t add them.');
  return Number(data ?? 0);
}

export async function moveStudent(student: string, to: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_move_student', { student, target: to });
  if (error) fail(error, 'We couldn’t move them.');
}

export async function removeFromClass(student: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_remove_from_class', { student });
  if (error) fail(error, 'We couldn’t take them out of the class.');
}

export async function addCoTeacher(id: string, teacher: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_add_co_teacher', { target: id, teacher });
  if (error) fail(error, 'We couldn’t add that teacher.');
}

export async function removeCoTeacher(id: string, teacher: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_remove_co_teacher', { target: id, teacher });
  if (error) fail(error, 'We couldn’t take that teacher off the class.');
}

export async function setWarpMode(classId: string, mode: WarpMode, groupId: string | null = null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_warp_mode', { target_class: classId, new_mode: mode, target_group: groupId });
  if (error) fail(error, 'We couldn’t change that code.');
}

/** Makes a new code. The old one stops working at once. Returns the new code. */
export async function resetWarpCode(classId: string, groupId: string | null = null): Promise<string> {
  const { data, error } = await supabase.rpc('teacher_reset_warp_code', { target_class: classId, target_group: groupId });
  if (error || !data) fail(error ?? {}, 'We couldn’t make a new code.');
  return data as string;
}

export async function fetchClassEvents(id: string): Promise<WarpEvent[]> {
  const { data, error } = await supabase.rpc('teacher_class_events', { target: id });
  if (error || !data) fail(error ?? {}, 'We couldn’t load who has joined.');
  return data as WarpEvent[];
}

export async function fetchWarpRequests(): Promise<WarpRequest[]> {
  const { data, error } = await supabase.rpc('teacher_warp_requests');
  if (error || !data) fail(error ?? {}, 'We couldn’t load the requests.');
  return data as WarpRequest[];
}

export async function answerWarp(request: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('teacher_answer_warp', { request, approve });
  if (error) fail(error, 'We couldn’t answer that request.');
}

// ---------------------------------------------------------------------------
// Students: Class Warp
// ---------------------------------------------------------------------------

export type WarpPreview =
  | { status: 'nope' | 'slow-down' }
  | {
      status: 'found';
      kind: 'class' | 'group';
      /** The class or group the code belongs to. */
      name: string;
      className: string;
      /** The class they would leave, if they are in another one. */
      leaving: string | null;
      alreadyIn: boolean;
      /** The teacher has to say yes first. */
      ask: boolean;
    };

export type WarpResult =
  | { status: 'nope' | 'slow-down' }
  | { status: 'joined'; name: string; className: string }
  | { status: 'waiting'; name: string };

export interface MyClass {
  className: string | null;
  groupName: string | null;
  waitingFor: string | null;
}

/** What's typed must look like a code (any case, spaces and dashes are fine); null if it can't be one. */
export function tidyWarpCode(typed: string): string | null {
  return normaliseCode(typed);
}

export async function previewWarp(typed: string): Promise<WarpPreview> {
  const code = tidyWarpCode(typed);
  // Something that can't be a code never reaches the server; it gets the same answer as a wrong code.
  if (!code) return { status: 'nope' };
  const { data, error } = await supabase.rpc('warp_preview', { typed: code });
  if (error || !data) throw new FriendlyError('Class Warp isn’t working right now. Please try again in a minute.');
  return data as WarpPreview;
}

export async function joinWarp(typed: string): Promise<WarpResult> {
  const code = tidyWarpCode(typed);
  if (!code) return { status: 'nope' };
  const { data, error } = await supabase.rpc('warp_join', { typed: code });
  if (error || !data) throw new FriendlyError('Class Warp isn’t working right now. Please try again in a minute.');
  return data as WarpResult;
}

export async function fetchMyClass(): Promise<MyClass> {
  const { data, error } = await supabase.rpc('my_class');
  if (error) throw new FriendlyError('We couldn’t load your class.');
  const row = (data ?? {}) as Partial<MyClass>;
  return { className: row.className ?? null, groupName: row.groupName ?? null, waitingFor: row.waitingFor ?? null };
}

export async function cancelWarpRequest(): Promise<void> {
  const { error } = await supabase.rpc('cancel_warp_request');
  if (error) throw new FriendlyError('We couldn’t cancel that.');
}
