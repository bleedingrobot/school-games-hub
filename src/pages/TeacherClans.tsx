/**
 * Clan Quest on the teacher page: the switch for the class, and on each pupil's page their clan at a glance with a
 * button to reset it. Loaded only when the teacher page opens.
 */
import { useEffect, useState } from "react";
import {
  createVillage,
  deleteVillage,
  fetchClanInfo,
  fetchClanRaidsEnabled,
  fetchClansEnabled,
  fetchVillages,
  movePupil,
  renameVillage,
  resetClan,
  saveClanRaidsEnabled,
  saveClansEnabled,
  type ClanInfo,
  type Villages,
} from "../data/clans";
import { FriendlyError } from "../data/profile";
import { whenPlayed } from "./Dashboard";
import "./teacher-gem-keep.css";

const errorText = (error: unknown) =>
  error instanceof FriendlyError
    ? error.message
    : "Something went wrong. Please try again.";

export function ClansTeacherPanels() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchClansEnabled().then(setEnabled, (error) =>
      setStatus(errorText(error)),
    );
  }, []);

  async function save(next: boolean, message: string) {
    setStatus("Saving…");
    try {
      setEnabled(await saveClansEnabled(next));
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
        {status && (
          <p role="status" className="gk-teacher__status">
            {status}
          </p>
        )}
      </section>
      <ClansVillagePanel />
    </>
  );
}

/** Raids on classmates (a switch, off until a teacher turns it on) and the village groups: who builds the village together. */
export function ClansVillagePanel() {
  const [raids, setRaids] = useState<boolean | null>(null);
  const [data, setData] = useState<Villages | null>(null);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = () =>
    fetchVillages().then(setData, (error) => setStatus(errorText(error)));
  useEffect(() => {
    fetchClanRaidsEnabled().then(setRaids, (error) =>
      setStatus(errorText(error)),
    );
    void load();
  }, []);

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
                  async () => setRaids(await saveClanRaidsEnabled(false)),
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
                  async () => setRaids(await saveClanRaidsEnabled(true)),
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
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setInfo(undefined);
    fetchClanInfo(student).then(
      (d) => current && setInfo(d),
      (error) => current && setFailed(errorText(error)),
    );
    return () => {
      current = false;
    };
  }, [student]);

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
          </p>
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
