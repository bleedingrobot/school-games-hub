import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NEVER_ALONE, NEVER_INSIDE } from "../../shared/clans/words";
import { nameHint } from "./OwnName";

const sql = readFileSync(
  "supabase/migrations/20261112002500_own_names.sql",
  "utf8",
);

/** The words in the SQL array returned by one of the migration's word-list functions. */
function sqlWords(fn: string): string[] {
  const body = sql
    .split(`create function public.${fn}()`)[1]
    .split("array[")[1]
    .split("]::text[]")[0];
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("earn your own name", () => {
  it("checks typed names for the same rude words as clan names", () => {
    expect(sqlWords("rude_inside_words")).toEqual(NEVER_INSIDE);
    expect(sqlWords("rude_alone_words")).toEqual(NEVER_ALONE);
  });

  it("gives the same shape hints as the server", () => {
    expect(nameHint("  ")).toBe("Type a name.");
    expect(nameHint("Ace 7")).toBe("Use letters only (one space is fine).");
    expect(nameHint("Big Red Fox")).toBe(
      "Use letters only (one space is fine).",
    );
    expect(nameHint("Supercalifragil")).toBe(
      "A name can be up to 14 letters long.",
    );
    expect(nameHint("J Bird")).toBe("Each word needs at least 2 letters.");
    expect(nameHint("te ahi")).toBeNull();
  });
});
