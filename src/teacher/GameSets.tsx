/**
 * The Game sets panel on Today (teacher controls card C8): three ready sets (Maths only, Foundational, Everything), the
 * teacher's own saved sets, and "+ Save the games on now as a set". "Switch to this" changes game on/off switches only, in one
 * request, says what it turned on and off, and offers Undo. "On now" marks the set that matches the class's switches.
 */
import { useCallback, useEffect, useState } from "react";
import {
  deleteGameSet,
  fetchSavedSets,
  gamesOn,
  isInUse,
  readySets,
  saveGameSet,
  useGameSet,
  type GameSet,
} from "../data/gameSets";
import { fetchGameSwitches, saveGameSwitches } from "../data/games";
import { GAMES } from "../games/registry";
import { settingErrorText } from "./Settings";
import "./gameSets.css";

type Loaded = { current: Record<string, boolean>; saved: GameSet[] };

/** What each ready set does, in a teacher's words. */
const READY_WORDS: Record<string, string> = {
  "ready:maths": "Maths games on. Foundational and non-maths games off.",
  "ready:foundational": "Foundational games on. Everything else off.",
  "ready:everything": "Every game on.",
};

const NOTHING: GameSet = { id: "none", name: "", ready: true, games: {} };
const plural = (n: number) => `${n} game${n === 1 ? "" : "s"}`;

export function GameSets({
  classId,
  name,
  onChanged,
}: {
  classId: string;
  name: string;
  /** Called after the class's switches change, so other controls on the page can read them again. */
  onChanged?: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [undo, setUndo] = useState<Record<string, boolean> | null>(null);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    try {
      const [current, saved] = await Promise.all([
        fetchGameSwitches(classId),
        fetchSavedSets(classId),
      ]);
      setLoaded({ current, saved });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [classId]);
  useEffect(() => {
    void load();
  }, [load]);

  const ready = readySets(GAMES);
  const total = GAMES.length;

  async function use(set: GameSet) {
    if (!loaded) return;
    setBusy(set.id);
    setStatus("");
    setUndo(null);
    const before = loaded.current;
    try {
      await useGameSet(set, classId);
      const after = { ...before, ...set.games };
      const changed = Object.keys(set.games).filter((c) => before[c] !== set.games[c]);
      const turnedOff = changed.filter((c) => !set.games[c]).length;
      const turnedOn = changed.length - turnedOff;
      setLoaded({ ...loaded, current: after });
      const parts = [
        turnedOn ? `${plural(turnedOn)} switched on` : "",
        turnedOff ? `${plural(turnedOff)} switched off` : "",
      ].filter(Boolean);
      setStatus(
        `${name} now has ${set.name}: ${gamesOn(GAMES, NOTHING, after)} of ${total} games on` +
          (parts.length ? ` (${parts.join(", ")}).` : "."),
      );
      if (changed.length) setUndo(Object.fromEntries(changed.map((c) => [c, before[c] === true])));
      onChanged?.();
    } catch (error) {
      setStatus(settingErrorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function undoLast() {
    if (!loaded || !undo) return;
    setBusy("undo");
    try {
      await saveGameSwitches(undo, classId);
      const after = { ...loaded.current, ...undo };
      setLoaded({ ...loaded, current: after });
      setUndo(null);
      setStatus(`Put back as it was: ${gamesOn(GAMES, NOTHING, after)} of ${total} games on.`);
      onChanged?.();
    } catch (error) {
      setStatus(settingErrorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!loaded) return;
    const trimmed = newName.trim();
    if (!trimmed) return setStatus("Give the set a name first.");
    setBusy("save");
    setStatus("");
    setUndo(null);
    try {
      await saveGameSet(classId, trimmed, loaded.current);
      setNaming(false);
      setNewName("");
      await load();
      setStatus(`Saved “${trimmed}”.`);
    } catch (error) {
      setStatus(settingErrorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function remove(set: GameSet) {
    setBusy(set.id);
    setStatus("");
    setUndo(null);
    try {
      await deleteGameSet(set.id);
      await load();
      setStatus(`Deleted “${set.name}”. No games were switched.`);
    } catch (error) {
      setStatus(settingErrorText(error));
    } finally {
      setBusy(null);
    }
  }

  const sets = loaded ? [...ready, ...loaded.saved] : ready;
  const match = loaded ? sets.find((s) => isInUse(s, loaded.current)) : undefined;

  const row = (set: GameSet) => {
    const inUse = set === match;
    const words = READY_WORDS[set.id] ?? "Your saved set.";
    const count = loaded ? gamesOn(GAMES, set, loaded.current) : null;
    return (
      <li key={set.id} className={`game-sets__set${inUse ? " game-sets__set--in-use" : ""}`}>
        <span className="game-sets__text">
          <span className="game-sets__name">{set.name}</span>
          <span className="game-sets__words">
            {words}
            {count !== null && ` ${plural(count)} on.`}
          </span>
        </span>
        {inUse ? (
          <span className="game-sets__badge">On now</span>
        ) : (
          <button
            type="button"
            className="button button--light-outline"
            aria-label={`Switch to ${set.name}`}
            disabled={!loaded || busy !== null}
            onClick={() => void use(set)}
          >
            {busy === set.id ? "Switching…" : "Switch to this"}
          </button>
        )}
        {!set.ready && (
          <button
            type="button"
            className="button button--light-outline"
            aria-label={`Delete the set ${set.name}`}
            disabled={busy !== null}
            onClick={() => void remove(set)}
          >
            Delete
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="panel game-sets" aria-labelledby="game-sets-title">
      <h2 id="game-sets-title" className="panel__title">
        Game sets <span className="today__for">({name})</span>
      </h2>
      <p className="game-sets__intro">
        Pick which games {name} can play. Switching to a set turns every game on or off to match it, straight away. To change
        one game, use the Games tab.
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load the game sets.</p>
      ) : !loaded ? (
        <p className="panel__empty">Loading…</p>
      ) : (
        <>
          <p className="game-sets__now">
            On now: <strong>{gamesOn(GAMES, NOTHING, loaded.current)} of {total} games</strong>
            {match ? ` (${match.name})` : " (your own mix, set on the Games tab)"}
          </p>
          <ul className="game-sets__list">{sets.map(row)}</ul>
          {naming ? (
            <form
              className="game-sets__save"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label>
                Name for the games on now
                <input type="text" maxLength={40} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              </label>
              <button type="submit" className="button button--primary" disabled={busy !== null}>
                Save set
              </button>
              <button type="button" className="button button--light-outline" onClick={() => setNaming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className="button button--light-outline" onClick={() => setNaming(true)}>
              + Save the games on now as a set
            </button>
          )}
        </>
      )}
      <p role="status" className="teacher__status game-sets__status">
        {status}
        {undo && (
          <>
            {" "}
            <button
              type="button"
              className="button button--light-outline game-sets__undo"
              disabled={busy !== null}
              onClick={() => void undoLast()}
            >
              Undo
            </button>
          </>
        )}
      </p>
    </section>
  );
}
