/**
 * The Game sets panel on Today (teacher controls card C8): three ready sets (Maths only, Foundational, Everything), the
 * teacher's own saved sets, and "+ Save today's games as a set". "Use now" changes game on/off switches only, in one request.
 * "In use" shows when the class's switches equal the set's.
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
import { fetchGameSwitches } from "../data/games";
import { GAMES } from "../games/registry";
import { settingErrorText } from "./Settings";
import "./gameSets.css";

type Loaded = { current: Record<string, boolean>; saved: GameSet[] };

export function GameSets({ classId, name }: { classId: string; name: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
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

  async function use(set: GameSet) {
    if (!loaded) return;
    setBusy(set.id);
    setStatus("");
    try {
      await useGameSet(set, classId);
      setLoaded({ ...loaded, current: { ...loaded.current, ...set.games } });
      setStatus(
        `${name} now has ${set.name}: ${gamesOn(GAMES, set, loaded.current)} games on.`,
      );
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
    try {
      await deleteGameSet(set.id);
      await load();
      setStatus(`Deleted “${set.name}”.`);
    } catch (error) {
      setStatus(settingErrorText(error));
    } finally {
      setBusy(null);
    }
  }

  const row = (set: GameSet) => {
    const inUse = loaded ? isInUse(set, loaded.current) : false;
    return (
      <li
        key={set.id}
        className={`game-sets__set${inUse ? " game-sets__set--in-use" : ""}`}
      >
        <span className="game-sets__name">{set.name}</span>
        {inUse && <span className="game-sets__badge">In use</span>}
        <button
          type="button"
          className="button button--light-outline"
          aria-label={`Use now: ${set.name}`}
          disabled={!loaded || busy !== null || inUse}
          onClick={() => void use(set)}
        >
          Use now
        </button>
        {!set.ready && (
          <button
            type="button"
            className="button button--light-outline"
            aria-label={`Delete: ${set.name}`}
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
      <p className="this-week__line">
        Switch the games on and off in one tap. A set changes only which games
        are on.
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load the game sets.</p>
      ) : !loaded ? (
        <p className="panel__empty">Loading…</p>
      ) : (
        <>
          <ul className="game-sets__list">
            {ready.map(row)}
            {loaded.saved.map(row)}
          </ul>
          {naming ? (
            <form
              className="game-sets__save"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label>
                Name for this set
                <input
                  type="text"
                  maxLength={40}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </label>
              <button
                type="submit"
                className="button button--primary"
                disabled={busy !== null}
              >
                Save set
              </button>
              <button
                type="button"
                className="button button--light-outline"
                onClick={() => setNaming(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="button button--light-outline"
              onClick={() => setNaming(true)}
            >
              + Save today’s games as a set
            </button>
          )}
        </>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}
