/**
 * Earn your own name, the teacher's half on a pupil's page (docs/plans/profile/PLAN.md card P11): their past names, "Put the
 * made-up name back" when their name is a typed one, and "Give a Name Scroll". The Yes and No for a typed name are in "Needs you".
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchNameHistory,
  fetchPupilScrolls,
  giveNameScroll,
  madeUpNameBack,
  type PastName,
  type PupilScrolls,
} from "../data/ownName";
import { FriendlyError } from "../data/profile";
import "./ownName.css";

const errorText = (error: unknown) =>
  error instanceof FriendlyError
    ? error.message
    : "Something went wrong. Please try again.";

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });

export function NameTools({
  student,
  name,
  onChanged,
}: {
  student: string;
  name: string;
  onChanged: () => void;
}) {
  const [past, setPast] = useState<PastName[]>([]);
  const [scrolls, setScrolls] = useState<PupilScrolls | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [history, info] = await Promise.allSettled([
      fetchNameHistory(student),
      fetchPupilScrolls(student),
    ]);
    if (history.status === "fulfilled") setPast(history.value);
    if (info.status === "fulfilled") setScrolls(info.value);
  }, [student]);

  useEffect(() => {
    void load();
  }, [load, name]);

  async function act(work: () => Promise<string>) {
    setStatus("Saving…");
    try {
      setStatus(await work());
      await load();
      onChanged();
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <div className="name-tools">
      <h3 className="name-tools__title">Player name</h3>
      {scrolls && (
        <p className="own-name__line">
          {scrolls.typed
            ? `${name} is a name they made up and you said Yes to.`
            : `${name} is from the word lists.`}{" "}
          {scrolls.waiting
            ? `They’ve asked for “${scrolls.waiting}”: say Yes or No on Today.`
            : scrolls.scrolls > 0
              ? `They have ${scrolls.scrolls === 1 ? "a Name Scroll" : `${scrolls.scrolls} Name Scrolls`} to use.`
              : ""}
        </p>
      )}
      {past.length > 0 && (
        <>
          <p className="own-name__line">Names before:</p>
          <ul className="name-tools__list">
            {past.map((p, i) => (
              <li key={`${p.until}-${i}`}>
                {p.name} (until {when(p.until)}
                {p.by === "teacher" ? ", changed by a teacher" : ""})
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="person-panel__actions">
        {scrolls?.typed && (
          <button
            type="button"
            className="button button--light-outline"
            onClick={() =>
              void act(
                async () => `${name} is now ${await madeUpNameBack(student)}.`,
              )
            }
          >
            Put the made-up name back
          </button>
        )}
        <button
          type="button"
          className="button button--light-outline"
          onClick={() =>
            void act(async () =>
              (await giveNameScroll(student))
                ? `${name} has a Name Scroll. They’ll see it on their profile.`
                : `${name} already has a Name Scroll from a teacher to use.`,
            )
          }
        >
          📜 Give a Name Scroll
        </button>
      </div>
      {status && (
        <p role="status" className="teacher__status">
          {status}
        </p>
      )}
    </div>
  );
}
