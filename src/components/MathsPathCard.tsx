/**
 * "My maths path" on a student's home page: where they are on the maths ladder, a short "you moved up!" when they pass a skill, and
 * (until it is done or skipped) an offer of the warm-up that finds their starting place. It only appears when the class has auto
 * switched on, so a class that has not turned it on sees nothing new. Loaded on its own so the maths code stays out of the home
 * page's first download. On the home page it takes its part of the page's one request (`homePage`, null while that is on its way);
 * anywhere else it asks for itself. `folded` puts it inside the "My maths" box with the path folded away behind "Show my path"
 * ("You moved up!" and the warm-up offer still show open).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { partOf, type HomePage } from "../data/homePage";
import { fetchMyLadder, ladderFrom, type MyLadder } from "../data/ladder";
import { hasFocus, isTeacherFocus } from "../../shared/maths/focus";
import { placeProgress } from "../../shared/maths/place";
import { LadderPath } from "../maths/LadderPath";
import "../maths/ladderPath.css";

const seenKey = (id: string) => `maths-path-seen:${id}`;
const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* the message just comes back next time */
  }
};

export default function MathsPathCard({
  homePage,
  folded = false,
}: {
  homePage?: Promise<HomePage> | null;
  folded?: boolean;
}) {
  const { profile } = useAuth();
  const [data, setData] = useState<MyLadder | null>(null);
  const [passed, setPassed] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (homePage === null) return;
    let current = true;
    partOf<MyLadder | null>(homePage, "ladder", ladderFrom, fetchMyLadder).then(
      (d) => current && setData(d),
      () => undefined, // no path is better than a broken home page
    );
    return () => {
      current = false;
    };
  }, [homePage]);

  const ladder = data?.focus.ladder;
  const progress =
    data && ladder?.on
      ? placeProgress(data.facts, ladder, data.settings)
      : null;
  const myId = profile?.id;

  // "You moved up!": the skills that are secure now and weren't last time (a jump to a new starting place doesn't count: only skills
  // the student really got secure). The first visit just remembers where they are.
  const secureNow = progress
    ? progress.skills
        .filter((p) => p.status === "secure" && !p.passedOver)
        .map((p) => p.skill.id)
    : null;
  const secureKey = secureNow?.join(",");
  useEffect(() => {
    if (!progress || !myId || !secureNow) return;
    const before = read(seenKey(myId));
    if (before === null) {
      write(seenKey(myId), secureNow.join(","));
      return;
    }
    const known = new Set(before.split(",").filter(Boolean));
    const fresh = progress.skills
      .filter((p) => secureNow.includes(p.skill.id) && !known.has(p.skill.id))
      .map((p) => p.skill.label);
    if (fresh.length) setPassed(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secureKey, myId]);

  if (!data || !progress) return null;
  const teacherSkills =
    hasFocus(data.focus) && isTeacherFocus(data.focus) ? data.focus.skills : [];

  function dismiss() {
    if (myId && secureNow) write(seenKey(myId), secureNow.join(","));
    setPassed(null);
  }

  const news = (
    <>
      {passed && (
        <div className="moved-up" role="status">
          <p>
            <span aria-hidden="true">🎉</span> <strong>You moved up!</strong>{" "}
            {passed.length === 1 ? passed[0] : `${passed[0]} and more`}{" "}
            {passed.length === 1 ? "is" : "are"} secure now.
          </p>
          <button
            type="button"
            className="button button--light-outline"
            onClick={dismiss}
          >
            Great!
          </button>
        </div>
      )}
      {!ladder!.placed && (
        <div className="placement-offer">
          <p>
            Find your starting place before you play: about 10 quick
            questions, once only.
          </p>
          <Link to="/placement" className="button button--primary">
            Find my starting place
          </Link>
        </div>
      )}
    </>
  );
  const path = (
    <LadderPath
      progress={progress}
      facts={data.facts}
      teacherSkills={teacherSkills}
    />
  );

  if (folded)
    return (
      <div className="my-maths__path">
        {news}
        <p className="my-maths__count">
          <span aria-hidden="true">🪜</span> My path:{" "}
          <strong>
            {progress.secureCount} of {progress.builtCount}
          </strong>{" "}
          skills secure
        </p>
        <button
          type="button"
          className="button button--light-outline my-maths__toggle"
          aria-expanded={open}
          aria-controls="my-maths-path"
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide my path" : "Show my path"}
        </button>
        <div id="my-maths-path" hidden={!open}>
          {path}
        </div>
      </div>
    );

  return (
    <section className="panel" aria-labelledby="path-title">
      <h2 id="path-title" className="panel__title">
        <span aria-hidden="true">🪜</span> My maths path
      </h2>
      {news}
      {path}
    </section>
  );
}
