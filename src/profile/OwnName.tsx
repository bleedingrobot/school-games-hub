/**
 * Earn your own name, the pupil's half (docs/plans/profile/PLAN.md card P11). With a Name Scroll a pupil types a name; it waits
 * for their teacher's Yes and their old name stays until then. The server does every check: the hints here only save a trip.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  askForMyName,
  cancelMyNameRequest,
  fetchMyNameStatus,
  type MyNameStatus,
} from "../data/ownName";
import { FriendlyError } from "../data/profile";
import "./ownName.css";

const errorText = (error: unknown) =>
  error instanceof FriendlyError
    ? error.message
    : "Something went wrong. Please try again.";

/** The shape the server wants: 2 to 14 letters, one space. Says what's wrong, or null. */
export function nameHint(typed: string): string | null {
  const trimmed = typed.trim().replace(/\s+/g, " ");
  if (trimmed === "") return "Type a name.";
  if (!/^[A-Za-z]+( [A-Za-z]+)?$/.test(trimmed))
    return "Use letters only (one space is fine).";
  if (trimmed.length > 14) return "A name can be up to 14 letters long.";
  if (trimmed.length < 2 || /(^| )[A-Za-z]( |$)/.test(trimmed))
    return "Each word needs at least 2 letters.";
  return null;
}

export function useMyNameStatus() {
  const [status, setStatus] = useState<MyNameStatus | null>(null);
  const reload = useCallback(async () => {
    try {
      setStatus(await fetchMyNameStatus());
    } catch {
      // Without it the page still works: only the scroll lines are missing.
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { status, reload };
}

/** One line on the profile's top card when there's a scroll to use or a name waiting. */
export function ScrollNote() {
  const { status } = useMyNameStatus();
  if (!status) return null;
  if (status.waiting)
    return (
      <p className="own-name__note">
        📜 Your new name is waiting for your teacher.
      </p>
    );
  if (status.scrolls > 0)
    return (
      <p className="own-name__note">
        📜 You have a Name Scroll! Tap “Change my name” to make up your own.
      </p>
    );
  return null;
}

/** In "My player name": the scroll, the typed name waiting, or how to earn one. */
export function OwnNamePanel() {
  const { status, reload } = useMyNameStatus();
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (!status) return null;

  async function send(event: FormEvent) {
    event.preventDefault();
    const hint = nameHint(typed);
    if (hint) {
      setMessage(hint);
      return;
    }
    setMessage("Sending…");
    try {
      const name = await askForMyName(typed);
      setTyped("");
      setMessage(
        `“${name}” is with your teacher. Your name stays the same until they say Yes.`,
      );
      await reload();
    } catch (error) {
      setMessage(errorText(error));
    }
  }

  async function takeBack() {
    setMessage("Saving…");
    try {
      await cancelMyNameRequest();
      setMessage("Taken back. Your scroll is ready to use again.");
      await reload();
    } catch (error) {
      setMessage(errorText(error));
    }
  }

  const last = status.last;
  return (
    <div className="own-name">
      {!status.canPickToday && (
        <p className="own-name__line">
          You’ve picked a new name today. You can pick again tomorrow.
        </p>
      )}
      {status.typed && (
        <p className="own-name__line">
          Picking words from the lists will swap your own name for a made-up
          one.
        </p>
      )}
      {last?.status === "declined" && !status.waiting && (
        <p className="own-name__line">
          Your teacher said no to “{last.name}”. You can try a different name.
        </p>
      )}
      {last?.status === "taken" && !status.waiting && (
        <p className="own-name__line">
          Someone else got “{last.name}” first. You can try a different name.
        </p>
      )}
      {status.waiting ? (
        <div className="own-name__scroll">
          <p>
            📜 <strong>{status.waiting.name}</strong> is waiting for your
            teacher. Your name stays the same until they say Yes.
          </p>
          <button
            type="button"
            className="button button--light-outline"
            onClick={() => void takeBack()}
          >
            Take it back
          </button>
        </div>
      ) : status.scrolls > 0 ? (
        <form className="own-name__scroll" onSubmit={(e) => void send(e)}>
          <p>
            📜 <strong>You have a Name Scroll!</strong> Make up your own player
            name: 2 to 14 letters, one space is fine. Don’t use your real name
            or a friend’s. Your teacher checks it first.
          </p>
          <label className="own-name__field">
            <span>My own name</span>
            <input
              value={typed}
              maxLength={14}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          <button type="submit" className="button button--primary">
            Send to my teacher
          </button>
        </form>
      ) : (
        <p className="own-name__line">
          📜 Earn a Name Scroll to make up your own name: win gold trophies in
          two different games, or earn three pictures.
        </p>
      )}
      {message && (
        <p className="own-name__line" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
