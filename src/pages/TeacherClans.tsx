/**
 * Clan Quest on the teacher pages. In the Games table's drawer, for the header's class: made-up hero names, the maths
 * settings, raids on classmates and the class report. Under Students: the fame season (with the other seasons) and each pupil's clan, with a button to reset it.
 * Loaded only when opened. The on/off switch is in the Games table row (src/games/clans/teacher.ts).
 */
import { useEffect, useRef, useState } from "react";
import {
  fetchClanInfo,
  fetchClanMathsSettings,
  fetchClanMathsStudent,
  fetchClanRaidsEnabled,
  fetchClanTypedNames,
  fetchClansEnabled,
  fetchClassClanMaths,
  kindLabel,
  listHeroNames,
  resetClan,
  saveClanMathsSettings,
  saveClanRaidsEnabled,
  saveClanTypedNames,
  startClansNewSeason,
  type ClanInfo,
  type ClanMathsClass,
  type ClanMathsSettings,
  type ClanMathsStudent,
  type MathsKind,
} from "../data/clans";
import { MEMBER_NAMES } from "../../shared/clans/words";
import {
  TOPIC_LABELS,
  TOPICS,
  YEAR_BANDS,
  type PracticalTopic,
  type YearBand,
} from "../../shared/maths/practical";
import { useAuth } from "../auth/AuthContext";
import { FriendlyError } from "../data/profile";
import {
  SettingChips,
  SettingChoice,
  SettingNumber,
  SettingToggle,
  useSetting,
} from "../teacher/Settings";
import { whenPlayed } from "./Dashboard";
import type { HardestRow } from "../games/types";
import { shortCache } from "../teacher/shortCache";
import "./teacher-gem-keep.css";
import "./teacher-clans.css";

const errorText = (error: unknown) =>
  error instanceof FriendlyError
    ? error.message
    : "Something went wrong. Please try again.";

/**
 * The drawer on the Games table (docs/TEACHER-VIEW-PLAN.md, 4.5): the class's settings and report. (The village groups went with
 * "My Village" on 28 Oct 2026: every clan builds its own village, so there is nothing for a teacher to set up.)
 */
export function ClansTeacherSettings({ classId }: { classId: string }) {
  return (
    <>
      <ClansSettingsPanel classId={classId} />
      <ClansClassReport classId={classId} />
    </>
  );
}

const BANDS = YEAR_BANDS.map((b) => ({ value: String(b), label: `Year ${b}` }));
const TOPIC_CHIPS = TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] }));
const TABLE_CHIPS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

type MathsKey = "yearBand" | "enabledTopics" | "enabledTables" | "fightsPerDay";

/** Made-up hero names, the maths settings and raids on classmates, for one class. Each saves at once. */
function ClansSettingsPanel({ classId }: { classId: string }) {
  const enabled = useSetting(() => fetchClansEnabled(classId), [classId]);
  const typedNames = useSetting(() => fetchClanTypedNames(classId), [classId]);
  const raids = useSetting(() => fetchClanRaidsEnabled(classId), [classId]);
  const maths = useSetting(() => fetchClanMathsSettings(classId), [classId]);
  const m = maths.value;
  // Which topics are on decides whether the times tables show; it follows the chips once they save.
  const [topics, setTopics] = useState<readonly PracticalTopic[] | null>(null);
  useEffect(() => setTopics(m?.enabledTopics ?? null), [m]);

  // The server keeps whatever isn't sent, so each control sends only its own setting. The saves still go one at a time, in
  // the order they were made, so a slow one can never land after a newer one.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    queue.current = Promise.resolve();
  }, [classId]);
  function saver<K extends MathsKey>(key: K) {
    return (value: ClanMathsSettings[K]) => {
      const run = queue.current.then(() => saveClanMathsSettings({ [key]: value }, classId));
      queue.current = run.catch(() => undefined);
      return run;
    };
  }

  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="cq-settings-title">
      <h2 id="cq-settings-title" className="panel__title">
        Clan Quest settings
      </h2>
      {enabled.value === false && (
        <p className="panel__empty">
          Clan Quest is off for this class, so these only matter once it’s on.
        </p>
      )}
      <SettingToggle
        label="Made-up hero names"
        about="On: pupils can pick a hero name from the list or type their own (letters only, up to 12, rude words refused). Only the pupil and you see hero names. Off: names come from the list; names already made are kept."
        value={typedNames.value}
        loadFailed={typedNames.failed}
        save={async (on) => {
          await saveClanTypedNames(on, classId);
        }}
      />
      <h3>Maths</h3>
      <p>
        One Battle Cry question comes before each round of a mine fight, from each pupil’s own maths focus or place on the
        ladder. The quests, the shop and the village have short story questions too: these choose them. Wrong answers never stop
        anything. Pupils get changes the next time they open Clan Quest; a fight already open keeps its questions.
      </p>
      <SettingChoice
        label="Year band"
        about="How hard the story questions are."
        options={BANDS}
        value={m ? String(m.yearBand) : null}
        loadFailed={maths.failed}
        save={(band) => saver("yearBand")(Number(band) as YearBand)}
      />
      <SettingChips
        label="Topics on"
        about="The story questions come only from topics that are on."
        options={TOPIC_CHIPS}
        value={m?.enabledTopics ?? null}
        loadFailed={maths.failed}
        save={saver("enabledTopics")}
        onSaved={setTopics}
      />
      {topics?.includes("times") && (
        <SettingChips
          label="Times tables for the times-tables topic"
          options={TABLE_CHIPS}
          value={m?.enabledTables ?? null}
          loadFailed={maths.failed}
          save={saver("enabledTables")}
        />
      )}
      <SettingNumber
        label="Mine fights a day"
        about="Everyone’s mine fights come back at midnight."
        min={1}
        max={30}
        value={m?.fightsPerDay ?? null}
        loadFailed={maths.failed}
        save={saver("fightsPerDay")}
      />
      <p className="panel__empty">There is no Practice Mode: nothing in Clan Quest is a test.</p>
      <h3>Raids</h3>
      <SettingToggle
        label="Raids on classmates"
        about="Clans can raid other clans in the same class, once a day, and a raided clan is safe the next day. Off until you turn it on."
        value={raids.value}
        loadFailed={raids.failed}
        save={async (on) => {
          await saveClanRaidsEnabled(on, classId);
        }}
      />
    </section>
  );
}

const share = (k: MathsKind) => (k.attempts > 0 ? `${Math.round((100 * k.correct) / k.attempts)}%` : "–");

/** How the class is getting on with Clan Quest's story questions: no pupil names. */
function ClansClassReport({ classId }: { classId: string }) {
  const [data, setData] = useState<ClanMathsClass | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setData(null);
    setFailed(null);
    fetchClassClanMaths(classId)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [classId]);

  return (
    <section className="panel gk-teacher" aria-labelledby="cq-class-title">
      <h2 id="cq-class-title" className="panel__title">
        Clan Quest maths: this class
      </h2>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !data ? (
        <p className="panel__empty">Loading…</p>
      ) : data.players === 0 ? (
        <p className="panel__empty">Nobody has answered a Clan Quest question yet.</p>
      ) : (
        <div className="gk-teacher__class">
          <p>
            {data.players} {data.players === 1 ? "pupil has" : "pupils have"} answered Clan Quest questions. Only you can see
            this.
          </p>
          <div className="gk-teacher__wide" tabIndex={0} role="group" aria-label="Questions most often wrong">
            <table className="stats-table">
              <caption>Questions most often wrong</caption>
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Right</th>
                  <th scope="col">Asked</th>
                  <th scope="col">Pupils</th>
                </tr>
              </thead>
              <tbody>
                {data.hardest.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Nothing has been wrong often enough to list yet.</td>
                  </tr>
                ) : (
                  data.hardest.map((k) => (
                    <tr key={k.key}>
                      <th scope="row">{kindLabel(k.key)}</th>
                      <td>{share(k)}</td>
                      <td>{k.attempts}</td>
                      <td>{k.students}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Every kind of question</summary>
            <div className="gk-teacher__wide" tabIndex={0} role="group" aria-label="Every kind of question">
              <table className="stats-table">
                <caption>Every kind of question</caption>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Right</th>
                    <th scope="col">Asked</th>
                  </tr>
                </thead>
                <tbody>
                  {data.kinds.map((k) => (
                    <tr key={k.key}>
                      <th scope="row">{kindLabel(k.key)}</th>
                      <td>{share(k)}</td>
                      <td>{k.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

/**
 * A new fame season: every clan's fame goes back to 0; clans, gold, levels and achievements stay. It sits with the other
 * seasons at the bottom of the teacher page (the game's SeasonPanels). The database only touches the pupils in the classes
 * this teacher teaches, or every pupil at the school for a school admin.
 */
export function ClansSeasonPanel() {
  const { profile } = useAuth();
  const isAdmin = profile?.school_admin === true;
  const [season, setSeason] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchClanMathsSettings().then(
      (s) => setSeason(s.season),
      () => undefined,
    );
  }, []);

  async function start() {
    setStatus("Starting…");
    try {
      const out = await startClansNewSeason(typed);
      setSeason(out.season);
      setAsking(false);
      setTyped("");
      setStatus(
        `Season ${out.season} has begun. Every clan’s fame is 0 again. Clans, gold, levels and achievements stay.`,
      );
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  if (season === null) return null;
  return (
    <section
      className="panel gk-teacher teacher__switch"
      aria-labelledby="cq-season-title"
    >
      <h2 id="cq-season-title" className="panel__title">
        Clan Quest fame season
      </h2>
      <p>
        It is season {season}. Fame is what the scoreboard ranks clans by. A new
        season sets fame back to 0 and keeps everything else, for{" "}
        {isAdmin
          ? "every pupil at the school."
          : "the pupils in the classes you teach."}{" "}
        (The school-wide “new points season” below only clears Clan Quest’s
        points, not fame.)
      </p>
      {asking ? (
        <p>
          <label>
            Type NEW SEASON to confirm{" "}
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>{" "}
          <button
            type="button"
            className="button button--danger"
            disabled={typed !== "NEW SEASON"}
            onClick={() => void start()}
          >
            Start season {season + 1}
          </button>{" "}
          <button
            type="button"
            className="button button--light-outline"
            onClick={() => {
              setAsking(false);
              setTyped("");
            }}
          >
            Cancel
          </button>
        </p>
      ) : (
        <button
          type="button"
          className="button button--light-outline"
          onClick={() => setAsking(true)}
        >
          Start a new season…
        </button>
      )}
      {status && (
        <p role="status" className="gk-teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}

/** One line for the student's folded Games row: "Red Banner, day 4, average level 3.5", or nothing without a clan. */
export async function clansStudentSummary(student: string): Promise<string | null> {
  const info = await fetchClanInfo(student);
  if (!info) return null;
  return `${info.name}, day ${info.day}, average level ${info.averageLevel}`;
}

export function ClansStudentPanel({ student }: { student: string }) {
  const [info, setInfo] = useState<ClanInfo | null | undefined>(undefined);
  const [maths, setMaths] = useState<ClanMathsStudent | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setInfo(undefined);
    setMaths(null);
    fetchClanMathsStudent(student).then(
      (m) => current && setMaths(m),
      () => undefined,
    );
    fetchClanInfo(student).then(
      (d) => current && setInfo(d),
      (error) => current && setFailed(errorText(error)),
    );
    return () => {
      current = false;
    };
  }, [student]);

  async function listNames() {
    setStatus("Changing the names…");
    try {
      const changed = await listHeroNames(student);
      setInfo(await fetchClanInfo(student));
      setStatus(
        changed === 0
          ? "There were no made-up names to change."
          : `Done. ${changed === 1 ? "One name was" : `${changed} names were`} swapped for names from the list.`,
      );
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  async function reset() {
    setStatus("Resetting…");
    try {
      await resetClan(student);
      setConfirming(false);
      setInfo(null);
      setStatus(
        "Done. They will make a new clan next time they open Clan Quest.",
      );
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  if (failed) return <p className="panel__empty">{failed}</p>;
  if (info === undefined) return null;
  return (
    <section className="gk-teacher" aria-label="Clan Quest">
      <h3>Clan Quest</h3>
      {info ? (
        <>
          <p>
            <strong>{info.name}</strong>: day {info.day}, average level{" "}
            {info.averageLevel}, {info.gold} gold, {info.followers} followers,{" "}
            {info.fightsLeft} mine fights left today
            {info.inFight ? " (in the middle of a fight)" : ""}. Last played{" "}
            {whenPlayed(info.lastPlayed)}.
            {maths?.fame != null && ` Fame ${maths.fame}.`}
          </p>
          {info.heroes && info.heroes.length > 0 && (
            <p>
              Heroes: {info.heroes.join(", ")}.{" "}
              {info.heroes.some((h) => !MEMBER_NAMES.includes(h)) && (
                <button
                  type="button"
                  className="button button--light-outline"
                  onClick={() => void listNames()}
                >
                  Swap made-up names for list names
                </button>
              )}
            </p>
          )}
          {maths && maths.kinds.length > 0 && (
            <>
              <p>Maths in Clan Quest (hardest first; only you see this):</p>
              <ul>
                {maths.kinds.map((k) => (
                  <li key={k.key}>
                    {kindLabel(k.key)}: {k.correct} of {k.attempts} right
                  </li>
                ))}
              </ul>
            </>
          )}
          {confirming ? (
            <p>
              Delete this clan so they can make a new one? Their points and
              achievements stay.{" "}
              <button
                type="button"
                className="button button--danger"
                onClick={() => void reset()}
              >
                Yes, reset the clan
              </button>{" "}
              <button
                type="button"
                className="button button--light-outline"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="button button--light-outline"
              onClick={() => setConfirming(true)}
            >
              Reset this clan…
            </button>
          )}
        </>
      ) : (
        <p className="panel__empty">No clan yet.</p>
      )}
      {status && (
        <p role="status" className="gk-teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}

/** The class's hardest kinds of question, for the merged table on the Maths tab (stage 5). */
export async function clansHardest(classId: string): Promise<HardestRow[]> {
  const data = await shortCache(`clan-quest:${classId}`, () => fetchClassClanMaths(classId));
  return data.hardest.map((k) => ({ question: kindLabel(k.key), topic: null, attempts: k.attempts, correct: k.correct, students: k.students ?? 0 }));
}
