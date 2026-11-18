/** Words for a focus, shared by the Set focus screen and the history. */
import type { FocusBatch } from "../data/focus";

/** Who a focus is for, in words. */
export function whoFor(b: Pick<FocusBatch, "scope" | "targets">): string {
  if (b.scope === "class") return "Whole class";
  const names = b.targets.map((t) => t.name);
  if (b.scope === "group")
    return names.length === 1
      ? `Group ${names[0]}`
      : `Groups ${names.join(", ")}`;
  return names.length <= 4
    ? names.join(", ")
    : `${names.slice(0, 4).join(", ")} and ${names.length - 4} more`;
}

/** "Mon 19 Oct", New Zealand time. */
export const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const NZ_TIME = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "Pacific/Auckland",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const NZ_DATE = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "Pacific/Auckland",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const NZ_WEEKDAY = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "Pacific/Auckland",
  weekday: "long",
});
const DAY_MS = 86_400_000;

/** "2:15pm", New Zealand time. */
const nzTime = (d: Date) => NZ_TIME.format(d).replace(/\s/g, "").toLowerCase();

/** When a new focus ends, in words: "until midnight at the end of Friday 20 November". New Zealand time. */
export function endWords(
  length: "lesson" | "today" | "friday" | "week" | "custom",
  customIso: string | null,
  now: Date = new Date(),
): string {
  if (length === "lesson")
    return `until ${nzTime(new Date(now.getTime() + 3_600_000))} today`;
  if (length === "today") return "until midnight tonight";
  if (length === "friday") {
    let d = now;
    for (let i = 0; i < 7 && NZ_WEEKDAY.format(d) !== "Friday"; i++)
      d = new Date(d.getTime() + DAY_MS);
    return `until midnight at the end of ${NZ_DATE.format(d).replace(",", "")}`;
  }
  const end =
    length === "week"
      ? new Date(now.getTime() + 7 * DAY_MS)
      : customIso
        ? new Date(customIso)
        : null;
  return end
    ? `until ${nzTime(end)} on ${NZ_DATE.format(end).replace(",", "")}`
    : "";
}
