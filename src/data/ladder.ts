/**
 * A student's place on the maths ladder (docs/MATHS-FOCUS-PLAN.md sections 5 and 5b): reading what the home page's path needs, and
 * sending the placement check to the server to be checked and stored.
 */
import { parseFocus, type MathsFocus } from "../../shared/maths/focus";
import type { FactStats } from "../../shared/maths/leitner";
import type { PlacementAnswer } from "../../shared/maths/placementCheck";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config";
import { supabase } from "../lib/supabase";
import { FriendlyError } from "./profile";

export interface MyLadder {
  /** Every record the ladder uses. */
  facts: FactStats[];
  /** The class's question settings (tables left on, division). */
  settings: { enabledTables?: number[]; division?: boolean };
  /** The focus, with the ladder facts (is auto on, year level, placement, furthest place). */
  focus: MathsFocus;
}

export async function fetchMyLadder(): Promise<MyLadder> {
  const { data, error } = await supabase.rpc("my_ladder");
  if (error || !data || typeof data !== "object")
    throw new FriendlyError("We couldn’t load your maths path.");
  const raw = data as {
    facts?: unknown;
    settings?: { enabledTables?: number[]; division?: boolean } | null;
    focus?: unknown;
  };
  return {
    facts: Array.isArray(raw.facts) ? (raw.facts as FactStats[]) : [],
    settings: {
      enabledTables: raw.settings?.enabledTables,
      division: raw.settings?.division,
    },
    focus: parseFocus(raw.focus),
  };
}

export type PlacementSend = { skip: true } | { answers: PlacementAnswer[] };

/** Sends the placement check (or a skip). The server checks every question before it stores where to start. */
export async function sendPlacement(
  body: PlacementSend,
): Promise<"saved" | "already"> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new FriendlyError("Please sign in again.");
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/gem-keep`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ placement: body }),
    });
  } catch {
    throw new FriendlyError(
      "We couldn’t reach the server. Check your internet and try again.",
    );
  }
  if (!response.ok)
    throw new FriendlyError("We couldn’t save that. Please try again.");
  const result = (await response.json()) as { outcome?: string };
  return result.outcome === "already" ? "already" : "saved";
}
