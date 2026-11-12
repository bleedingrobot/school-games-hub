/**
 * Earn your own name (docs/plans/profile/PLAN.md card P11). Every rule is on the server (migration 20261112002800): who has a
 * Name Scroll, the letter and rude-word checks, and that a typed name is shown to nobody else until a teacher says Yes.
 */
import { supabase } from "../lib/supabase";
import { FriendlyError } from "./profile";

function fail(
  error: { code?: string; message?: string },
  fallback: string,
): never {
  const ours = ["22023", "23505", "42501"];
  if (
    error.code &&
    ours.includes(error.code) &&
    error.message &&
    !error.message.includes("permission denied")
  ) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

export interface MyNameStatus {
  /** Free Name Scrolls. */
  scrolls: number;
  /** The typed name waiting for a teacher. */
  waiting: { name: string; askedAt: string } | null;
  /** The newest answer in the past week. */
  last: {
    name: string;
    status: "approved" | "declined" | "taken";
    at: string;
  } | null;
  /** False once they have picked a new made-up name today. */
  canPickToday: boolean;
  /** Their name now is a typed one. */
  typed: boolean;
}

export async function fetchMyNameStatus(): Promise<MyNameStatus> {
  const { data, error } = await supabase.rpc("my_name_status");
  if (error || !data) fail(error ?? {}, "We couldn’t load your Name Scrolls.");
  return data as MyNameStatus;
}

/** Sends a typed name to the teacher. Returns it tidied ("te ahi" → "Te Ahi"). */
export async function askForMyName(typed: string): Promise<string> {
  const { data, error } = await supabase.rpc("ask_for_my_name", { typed });
  if (error) fail(error, "We couldn’t send that name. Please try again.");
  return data as string;
}

export async function cancelMyNameRequest(): Promise<void> {
  const { error } = await supabase.rpc("cancel_my_name_request");
  if (error) fail(error, "We couldn’t take that name back.");
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export interface NameRequest {
  id: string;
  /** Null when the pupil is in no class (only a school admin sees those). */
  class_id: string | null;
  class_name: string | null;
  student_id: string;
  /** Their name now. */
  student_name: string;
  real_name: string | null;
  wanted: string;
  asked_at: string;
}

export async function fetchNameRequests(): Promise<NameRequest[]> {
  const { data, error } = await supabase.rpc("teacher_name_requests");
  if (error || !data) fail(error ?? {}, "We couldn’t load the names waiting.");
  return data as NameRequest[];
}

export async function answerName(
  request: string,
  approve: boolean,
): Promise<"approved" | "declined" | "taken"> {
  const { data, error } = await supabase.rpc("teacher_answer_name", {
    request,
    approve,
  });
  if (error || !data) fail(error ?? {}, "We couldn’t answer that name.");
  return (data as { status: "approved" | "declined" | "taken" }).status;
}

export interface PastName {
  name: string;
  /** When it stopped being theirs. */
  until: string;
  by: "pupil" | "teacher" | null;
  madeUp: boolean;
}

export async function fetchNameHistory(student: string): Promise<PastName[]> {
  const { data, error } = await supabase.rpc("teacher_name_history", {
    student,
  });
  if (error || !data) fail(error ?? {}, "We couldn’t load their past names.");
  return data as PastName[];
}

/** Their last made-up name if it's free, or a new one. Returns the name. */
export async function madeUpNameBack(student: string): Promise<string> {
  const { data, error } = await supabase.rpc("teacher_made_up_name_back", {
    student,
  });
  if (error || !data) fail(error ?? {}, "We couldn’t change their name.");
  return data as string;
}

/** False when they already have an unused scroll from a teacher. */
export async function giveNameScroll(student: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("teacher_give_name_scroll", {
    student,
  });
  if (error) fail(error, "We couldn’t give a Name Scroll.");
  return data as boolean;
}

export interface PupilScrolls {
  scrolls: number;
  waiting: string | null;
  typed: boolean;
}

export async function fetchPupilScrolls(
  student: string,
): Promise<PupilScrolls> {
  const { data, error } = await supabase.rpc("teacher_name_scrolls", {
    student,
  });
  if (error || !data) fail(error ?? {}, "We couldn’t load their Name Scrolls.");
  return data as PupilScrolls;
}
