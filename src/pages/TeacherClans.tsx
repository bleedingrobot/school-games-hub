/**
 * Clan Quest on the teacher page: the switch for the class, and on each pupil's page their clan at a glance with a
 * button to reset it. Loaded only when the teacher page opens.
 */
import { useEffect, useState } from "react";
import {
  createVillage,
  deleteVillage,
  fetchClanInfo,
  fetchClanMathsClass,
  fetchClanMathsSettings,
  fetchClanMathsStudent,
  fetchClanRaidsEnabled,
  fetchClanTypedNames,
  fetchClansEnabled,
  fetchVillages,
  kindLabel,
  listHeroNames,
  movePupil,
  renameVillage,
  resetClan,
  saveClanMathsSettings,
  saveClanRaidsEnabled,
  saveClanTypedNames,
  saveClansEnabled,
  startClansNewSeason,
  type ClanInfo,
  type ClanMathsClass,
  type ClanMathsSettings,
  type ClanMathsStudent,
  type MathsKind,
  type Villages,
} from "../data/clans";
import { MEMBER_NAMES } from "../../shared/clans/words";
import {
  TOPIC_LABELS,
  TOPICS,
  YEAR_BANDS,
  type PracticalTopic,
  type YearBand,
} from "../../shared/maths/practical";
import { FriendlyError } from "../data/profile";
import { useTeacherClass } from "../teacher/TeacherClass";
import { whenPlayed } from "./Dashboard";
import "./teacher-gem-keep.css";

const errorText = (error: unknown) =>
  error instanceof FriendlyError
    ? error.message
    : "Something went wrong. Please try again.";

export function ClansTeacherPanels() {
  const { classId, ready } = useTeacherClass();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [typedNames, setTypedNames] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setEnabled(null);
    setTypedNames(null);
    setStatus(null);
    fetchClansEnabled(classId).then(setEnabled, (error) =>
      setStatus(errorText(error)),
    );
    fetchClanTypedNames(classId).then(setTypedNames, (error) =>
      setStatus(errorText(error)),
    );
  }, [ready, classId]);

  async function saveTypedNames(next: boolean, message: string) {
    setStatus("Saving…");
    try {
      setTypedNames(await saveClanTypedNames(next, classId));
      setStatus(message);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  async function save(next: boolean, message: string) {
    setStatus("Saving…");
    try {
      setEnabled(await saveClansEnabled(next, classId));
      setStatus(message);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <>
      <section
        className="panel gk-teacher teacher__switch"
        aria-labelledby="cq-settings-title"
      >
        <h2 id="cq-settings-title" className="panel__title">
          Clan Quest
        </h2>
        <p>
          Pupils make a clan of four, fight in the Mines (maths helps), shop,
          train and build an empire. Each pupil has their own clan, kept on the
          school’s server. Switched off, the card is hidden from the pupils and
          nothing can be played; you can still open it yourself to try it.
          Everyone’s mine fights come back at midnight.
        </p>
        {enabled !== null && (
          <>
            <p>
              {enabled
                ? "On: pupils can play it."
                : "Off: pupils can’t see it yet."}
            </p>
            {enabled ? (
              <button
                type="button"
                className="button button--danger"
                onClick={() =>
                  void save(
                    false,
                    "Clan Quest is off. Clans are kept for when you switch it on.",
                  )
                }
              >
                Switch Clan Quest off
              </button>
            ) : (
              <button
                type="button"
                className="button button--primary"
                onClick={() =>
                  void save(true, "Clan Quest is on. Pupils will see the card.")
                }
              >
                Switch Clan Quest on
              </button>
            )}
          </>
        )}
        {typedNames !== null && (
          <p>
            <strong>Made-up hero names:</strong>{" "}
            {typedNames
              ? "On. Pupils can pick a name from the list or type their own (letters only, up to 12, rude words refused). Only the pupil and you see hero names."
              : "Off. Pupils pick hero names from a list."}{" "}
            {typedNames ? (
              <button
                type="button"
                className="button button--danger"
                onClick={() =>
                  void saveTypedNames(
                    false,
                    "Made-up hero names are off. Names already made are kept.",
                  )
                }
              >
                Switch made-up names off
              </button>
            ) : (
              <button
                type="button"
                className="button button--primary"
                onClick={() =>
                  void saveTypedNames(
                    true,
                    "Made-up hero names are on for new clans.",
                  )
                }
              >
                Switch made-up names on
              </button>
            )}
          </p>
        )}
        {status && (
          <p role="status" className="gk-teacher__status">
            {status}
          </p>
        )}
      </section>
      <ClansMathsPanel />
      <ClansVillagePanel />
      <ClansSeasonPanel />
    </>
  );
}

const rate = (k: MathsKind) =>
  k.attempts > 0 ? `${Math.round((100 * k.correct) / k.attempts)}% right` : "";

/** What the maths in Clan Quest asks (year band, topics, times tables), how many mine fights a day, and how the school is getting on. */
export function ClansMathsPanel() {
  const { classId, ready } = useTeacherClass();
  const [saved, setSaved] = useState<ClanMathsSettings | null>(null);
  const [draft, setDraft] = useState<ClanMathsSettings | null>(null);
  const [records, setRecords] = useState<ClanMathsClass | null>(null);
  const [fightsText, setFightsText] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setSaved(null);
    setDraft(null);
    setStatus(null);
    fetchClanMathsSettings(classId).then(
      (s) => {
        setSaved(s);
        setDraft(s);
      },
      (error) => setStatus(errorText(error)),
    );
    fetchClanMathsClass().then(setRecords, () => undefined);
  }, [ready, classId]);

  if (!draft) {
    return status ? <p className="panel__empty">{status}</p> : null;
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const toggleTopic = (t: PracticalTopic) =>
    setDraft({
      ...draft,
      enabledTopics: draft.enabledTopics.includes(t)
        ? draft.enabledTopics.filter((x) => x !== t)
        : TOPICS.filter((x) => x === t || draft.enabledTopics.includes(x)),
    });
  const toggleTable = (n: number) =>
    setDraft({
      ...draft,
      enabledTables: draft.enabledTables.includes(n)
        ? draft.enabledTables.filter((x) => x !== n)
        : [...draft.enabledTables, n].sort((a, b) => a - b),
    });

  async function save() {
    if (!draft) return;
    setStatus("Saving…");
    try {
      await saveClanMathsSettings({
        yearBand: draft.yearBand,
        enabledTopics: draft.enabledTopics,
        enabledTables: draft.enabledTables,
        fightsPerDay: draft.fightsPerDay,
      }, classId);
      setSaved(draft);
      setStatus(
        "Saved. Pupils get these next time they open Clan Quest. A fight that is already open keeps the questions it started with.",
      );
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section
      className="panel gk-teacher teacher__switch"
      aria-labelledby="cq-maths-title"
    >
      <h2 id="cq-maths-title" className="panel__title">
        Clan Quest maths
      </h2>
      <p>
        One Battle Cry question comes before each round of a mine fight. It
        comes from each pupil&apos;s own maths focus or place on the ladder, and
        the answers count on the skill map, like the other maths games. The
        quests, the shop and the village have short story questions too: the
        settings below choose those. Wrong answers never stop anything. These
        settings are for the whole school.
      </p>
      <fieldset>
        <legend>Year band</legend>
        {YEAR_BANDS.map((b: YearBand) => (
          <label key={b}>
            <input
              type="radio"
              name="cq-band"
              checked={draft.yearBand === b}
              onChange={() => setDraft({ ...draft, yearBand: b })}
            />{" "}
            Year {b}{" "}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Topics (leave at least one on)</legend>
        {TOPICS.map((t) => {
          const on = draft.enabledTopics.includes(t);
          return (
            <label key={t}>
              <input
                type="checkbox"
                checked={on}
                disabled={on && draft.enabledTopics.length === 1}
                onChange={() => toggleTopic(t)}
              />{" "}
              {TOPIC_LABELS[t]}{" "}
            </label>
          );
        })}
      </fieldset>
      {draft.enabledTopics.includes("times") && (
        <fieldset>
          <legend>Times tables for the times-tables topic</legend>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
            const on = draft.enabledTables.includes(n);
            return (
              <label key={n}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={on && draft.enabledTables.length === 1}
                  onChange={() => toggleTable(n)}
                />{" "}
                {n}{" "}
              </label>
            );
          })}
        </fieldset>
      )}
      <p>
        <label>
          Mine fights a day{" "}
          <input
            type="number"
            min={1}
            max={30}
            value={fightsText ?? draft.fightsPerDay}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              // Typing is free; the box only takes a whole number from 1 to 30 (more is made 30), and goes back to the last good one when left.
              setFightsText(n > 30 ? "30" : e.target.value);
              if (e.target.value !== "" && n >= 1)
                setDraft({ ...draft, fightsPerDay: Math.min(30, n) });
            }}
            onBlur={() => setFightsText(null)}
          />
        </label>{" "}
        <button
          type="button"
          className="button button--primary"
          disabled={!dirty}
          onClick={() => void save()}
        >
          Save settings
        </button>
      </p>
      <p className="panel__empty">
        There is no Practice Mode: nothing in Clan Quest is a test.
      </p>
      {status && (
        <p role="status" className="gk-teacher__status">
          {status}
        </p>
      )}
      {records && records.players > 0 && (
        <>
          <h3>How the school is getting on</h3>
          <p>
            {records.players} {records.players === 1 ? "pupil has" : "pupils have"}{" "}
            answered Clan Quest questions. Only you can see this.
          </p>
          {records.hardest.length > 0 ? (
            <>
              <p>Questions most often wrong:</p>
              <ul>
                {records.hardest.map((k) => (
                  <li key={k.key}>
                    {kindLabel(k.key)}: {k.correct} of {k.attempts} right (
                    {k.students} pupils)
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="panel__empty">
              Nothing has been wrong often enough to list yet.
            </p>
          )}
          <details>
            <summary>Every kind of question</summary>
            <ul>
              {records.kinds.map((k) => (
                <li key={k.key}>
                  {kindLabel(k.key)}: {k.correct} of {k.attempts} right (
                  {rate(k)})
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

/** A new fame season: every clan's fame goes back to 0; clans, gold, levels and achievements stay. */
export function ClansSeasonPanel() {
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
        season sets every clan’s fame back to 0 and keeps everything else. (The
        school-wide “new points season” on this page only clears Clan Quest’s
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

/** Raids on classmates (a switch, off until a teacher turns it on) and the village groups: who builds the village together. */
export function ClansVillagePanel() {
  const { classId, ready } = useTeacherClass();
  const [raids, setRaids] = useState<boolean | null>(null);
  const [data, setData] = useState<Villages | null>(null);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = () =>
    fetchVillages().then(setData, (error) => setStatus(errorText(error)));
  useEffect(() => {
    if (!ready) return;
    setRaids(null);
    fetchClanRaidsEnabled(classId).then(setRaids, (error) =>
      setStatus(errorText(error)),
    );
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, classId]);

  async function run(job: () => Promise<unknown>, message: string) {
    setStatus("Saving…");
    try {
      await job();
      await load();
      setStatus(message);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  const groups = data?.villages ?? [];
  return (
    <section
      className="panel gk-teacher teacher__switch"
      aria-labelledby="cq-village-title"
    >
      <h2 id="cq-village-title" className="panel__title">
        Clan Quest villages
      </h2>
      <p>
        Each group of pupils builds a village together: they give gold to a
        shared chest and vote each week on a building (Training Hall, Smithy,
        Church) that helps the whole group. Pupils you have not put in a group
        are all together in “Everyone else”. Raids on classmates only happen
        inside a group.
      </p>
      {raids !== null && (
        <p>
          <strong>Raids on classmates:</strong> {raids ? "On." : "Off."}{" "}
          {raids ? (
            <button
              type="button"
              className="button button--danger"
              onClick={() =>
                void run(
                  async () => setRaids(await saveClanRaidsEnabled(false, classId)),
                  "Raids on classmates are off.",
                )
              }
            >
              Switch raids off
            </button>
          ) : (
            <button
              type="button"
              className="button button--primary"
              onClick={() =>
                void run(
                  async () => setRaids(await saveClanRaidsEnabled(true, classId)),
                  "Raids on classmates are on.",
                )
              }
            >
              Switch raids on
            </button>
          )}
        </p>
      )}
      <h3>Groups</h3>
      <ul>
        {groups.map((g) => (
          <li key={g.id}>
            <strong>{g.name}</strong>: {g.pupils}{" "}
            {g.pupils === 1 ? "pupil" : "pupils"}, {g.chest} gold in the chest,
            Training Hall {g.levels.trainingHall}, Smithy {g.levels.smithy},
            Church {g.levels.church}.{" "}
            {!g.isDefault &&
              (confirming === g.id ? (
                <>
                  Delete it? Its pupils go back to “Everyone else” and its chest
                  is lost.{" "}
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() =>
                      void run(async () => {
                        await deleteVillage(g.id);
                        setConfirming(null);
                      }, `Deleted ${g.name}.`)
                    }
                  >
                    Yes, delete {g.name}
                  </button>{" "}
                  <button
                    type="button"
                    className="button button--light-outline"
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="button button--light-outline"
                    onClick={() => {
                      if (name.trim())
                        void run(
                          () => renameVillage(g.id, name.trim()),
                          `Renamed to ${name.trim()}.`,
                        );
                      else setStatus("Type the new name in the box first.");
                    }}
                  >
                    Rename to the name below
                  </button>{" "}
                  <button
                    type="button"
                    className="button button--light-outline"
                    onClick={() => setConfirming(g.id)}
                  >
                    Delete…
                  </button>
                </>
              ))}
          </li>
        ))}
      </ul>
      <p>
        <label>
          Group name{" "}
          <input
            type="text"
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
          />
        </label>{" "}
        <button
          type="button"
          className="button button--primary"
          onClick={() =>
            void run(async () => {
              await createVillage(name.trim());
              setName("");
            }, "Group made. Now move pupils into it.")
          }
        >
          Make a group
        </button>
      </p>
      <h3>Who is in which group</h3>
      <table>
        <tbody>
          {(data?.pupils ?? []).map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.name}</th>
              <td>
                <select
                  aria-label={`Group for ${p.name}`}
                  value={p.village}
                  onChange={(e) =>
                    void run(
                      () => movePupil(p.id, Number(e.target.value)),
                      `Moved ${p.name}.`,
                    )
                  }
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {status && (
        <p role="status" className="gk-teacher__status">
          {status}
        </p>
      )}
    </section>
  );
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
