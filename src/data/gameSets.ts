/**
 * Game sets (teacher controls card C8): a named list of which games are on. Three ready sets are made here from the games'
 * groups (so a new game joins them with no change); a teacher's own sets live in the database, one list per class, and are
 * read and changed only through teacher_game_sets / teacher_save_game_set / teacher_use_game_set / teacher_delete_game_set
 * (migration 20261112000600). Using a set changes game switches and nothing else.
 */
import { supabase } from "../lib/supabase";
import { ALL_SWITCH_COLUMNS, saveGameSwitches, switchColumnOf } from "./games";
import { FriendlyError } from "./profile";
import { forgetSettings } from "./settingsMemory";

export type GameSet = {
  /** Ready sets have ids like 'ready:maths'; saved ones are the database id. */
  id: string;
  name: string;
  ready: boolean;
  /** Switch column -> on. A saved set may lack a column added after it was saved: that switch is left as it is. */
  games: Record<string, boolean>;
};

type SetGame = { id: string; group?: string };

/** The ready sets, built from the games' groups. `Maths only` is easy and complex maths; Foundational is the junior games. */
export function readySets(games: readonly SetGame[]): GameSet[] {
  const make = (
    id: string,
    name: string,
    wanted: (g: SetGame) => boolean,
  ): GameSet => {
    const games_: Record<string, boolean> = Object.fromEntries(
      ALL_SWITCH_COLUMNS.map((c) => [c, false]),
    );
    for (const g of games) {
      const column = switchColumnOf(g);
      if (column && wanted(g)) games_[column] = true;
    }
    return { id: `ready:${id}`, name, ready: true, games: games_ };
  };
  return [
    make(
      "maths",
      "Maths only",
      (g) => g.group === "easy-maths" || g.group === "complex-maths",
    ),
    make("foundational", "Foundational", (g) => g.group === "foundational"),
    make("everything", "Everything", () => true),
  ];
}

/** Does the class's current switches match the set (on the switches the set names)? */
export function isInUse(
  set: GameSet,
  current: Record<string, boolean>,
): boolean {
  const columns = Object.keys(set.games);
  return (
    columns.length > 0 && columns.every((c) => current[c] === set.games[c])
  );
}

/** How many games are on once the set is applied over the current switches. A game with no switch is always on. */
export function gamesOn(
  games: readonly SetGame[],
  set: GameSet,
  current: Record<string, boolean>,
): number {
  const after = { ...current, ...set.games };
  return games.filter((g) => {
    const column = switchColumnOf(g);
    return column === null || after[column] === true;
  }).length;
}

/** The teacher's own sets for the class, newest first. */
export async function fetchSavedSets(classId: string): Promise<GameSet[]> {
  const { data, error } = await supabase.rpc("teacher_game_sets", {
    target_class: classId,
  });
  if (error || !Array.isArray(data))
    throw new Error("We couldn’t load the game sets.");
  return (
    data as { id: string; name: string; games: Record<string, boolean> }[]
  ).map((s) => ({ ...s, ready: false }));
}

/** Saves the given on/off of every game as a set. */
export async function saveGameSet(
  classId: string,
  name: string,
  games: Record<string, boolean>,
): Promise<void> {
  const { error } = await supabase.rpc("teacher_save_game_set", {
    target_class: classId,
    set_name: name,
    games,
  });
  if (error)
    throw new FriendlyError(
      error.code === "54000" ? error.message : "We couldn’t save that set.",
    );
}

/** Switches the class to a set in one request: a saved set by its id, a ready set by its switches. */
export async function useGameSet(set: GameSet, classId: string): Promise<void> {
  if (set.ready) return saveGameSwitches(set.games, classId);
  const { error } = await supabase.rpc("teacher_use_game_set", {
    set_id: set.id,
  });
  forgetSettings();
  if (error) throw new FriendlyError("We couldn’t switch to that set.");
}

export async function deleteGameSet(setId: string): Promise<void> {
  const { error } = await supabase.rpc("teacher_delete_game_set", {
    set_id: setId,
  });
  if (error) throw new FriendlyError("We couldn’t delete that set.");
}
