/**
 * The server side of a student's place on the ladder (docs/MATHS-FOCUS-PLAN.md section 5). The functions that save answers call
 * `makePlaceSyncer` after saving, which works the place out from the student's records and hands it to the database, which only
 * ever moves it forward. `savePlacement` checks a placement check before storing where to start. Both take their database calls
 * as ports, so the tests (and each function's entry file) can stand in for Supabase.
 */
import {
  ladderOfContext,
  placeToStore,
  type LadderContext,
} from "./placeContext";
import { checkPlacement, parsePlacementAnswers } from "./placementCheck";

export interface PlacePorts {
  /** The student's records, question settings and focus (the database's `space_maths_context`). Null if it cannot be read. */
  loadContext(player: string): Promise<LadderContext | null>;
  /** Moves the furthest place forward (the database refuses to move it back). */
  savePlace(player: string, skill: string, rank: number): Promise<void>;
  /** Stores a placement once. Returns false when there was one already. */
  savePlacementRow(
    player: string,
    skill: string | null,
    skipped: boolean,
  ): Promise<boolean>;
}

/** Looks at a student's records and keeps their furthest place up to date. Never throws: a late or missing update is harmless. */
export function makePlaceSyncer(
  ports: PlacePorts,
  now: () => number = Date.now,
  minGapMs = 30_000,
) {
  const last = new Map<string, number>();
  return async function syncPlace(player: string): Promise<void> {
    const at = now();
    const before = last.get(player);
    if (before !== undefined && at - before < minGapMs) return;
    last.set(player, at);
    if (last.size > 5000) last.clear();
    try {
      const context = await ports.loadContext(player);
      if (!context) return;
      const { facts, info, opts } = ladderOfContext(context);
      if (!info.on) return; // with auto off nothing is kept
      const place = placeToStore(facts, info, opts);
      if (place) await ports.savePlace(player, place.skill, place.rank);
    } catch {
      console.error("place: not updated");
    }
  };
}

export type PlacementOutcome = "saved" | "already" | "refused";

/** Checks a placement from the website (`{ skip: true }` or `{ answers: [...] }`) and stores where to start. */
export async function savePlacement(
  ports: PlacePorts,
  player: string,
  raw: unknown,
): Promise<{ outcome: PlacementOutcome; start?: string }> {
  const context = await ports.loadContext(player);
  if (!context) throw new Error("place: cannot read the ladder");
  const { info } = ladderOfContext(context);
  if (!info.on) return { outcome: "refused" };
  if (info.placed) return { outcome: "already" };
  const body =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (body.skip === true) {
    const stored = await ports.savePlacementRow(player, null, true);
    return { outcome: stored ? "saved" : "already" };
  }
  const answers = parsePlacementAnswers(body.answers);
  const start = answers ? checkPlacement(answers) : null;
  if (!start) return { outcome: "refused" };
  const stored = await ports.savePlacementRow(player, start, false);
  return { outcome: stored ? "saved" : "already", start };
}
