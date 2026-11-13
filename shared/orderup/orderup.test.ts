import { describe, expect, it } from "vitest";
import { seededRandom } from "../maths/serverQuestions";
import {
  applyStep,
  format,
  nextStep,
  parse,
  readySteps,
  stepForPick,
  tokensOf,
  valueOf,
  type Node,
} from "./expr";
import { answerHint, answerMistake, checkPick, pickHint } from "./mistakes";
import { bracketsReach, fair, LEVELS, makeBracketBag, makeSet } from "./levels";

const ids = (root: Node, ...values: number[]) =>
  values.map((v) => {
    const t = tokensOf(root).find((x) => x.kind === "num" && x.value === v);
    if (!t) throw new Error(`no ${v}`);
    return t.id;
  });

describe("Order Up! rules", () => {
  it("works expressions step by step: only ready steps, exponents alone, brackets drop (doc example)", () => {
    {
      for (const text of [
        "4 + 3 × 5",
        "18 − (2 + 1)² ÷ 3",
        "(4 + 3) × 5",
        "((2 + 3) × 4 − 5) ÷ 3",
        "3² + 2³",
      ])
        expect(format(parse(text))).toBe(text);
      expect(valueOf(parse("18 − (2 + 1)² ÷ 3"))).toBe(15);
    }
    {
      let e = parse("18 − (2 + 1)² ÷ 3");
      const lines: string[] = [];
      for (let s = nextStep(e); s; s = nextStep(e)) {
        e = applyStep(e, s.id);
        lines.push(format(e));
      }
      expect(lines).toEqual(["18 − 3² ÷ 3", "18 − 9 ÷ 3", "18 − 3", "15"]);
    }
    {
      expect(readySteps(parse("4 + 3 × 5")).map(format)).toEqual(["3 × 5"]);
      expect(readySteps(parse("2 × 3 + 4 × 5")).map(format)).toEqual([
        "2 × 3",
        "4 × 5",
      ]);
      expect(readySteps(parse("20 − 6 + 3")).map(format)).toEqual(["20 − 6"]);
    }
    {
      const e = parse("2 × 3²");
      const step = stepForPick(e, ids(e, 3));
      expect(step && format(step)).toBe("3²");
    }
    {
      const e = parse("(4 + 3) × 5");
      expect(format(applyStep(e, stepForPick(e, ids(e, 4, 3))!.id))).toBe(
        "7 × 5",
      );
    }
  });

  it("every wrong pick and answer gets its hint (the hints from the doc)", () => {
    {
      const e = parse("4 + 3 × 5");
      const r = checkPick(e, ids(e, 4, 3));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.mistake).toBe("rank");
        expect(pickHint(r.mistake, r.next)).toBe(
          "Multiply and divide before you add and subtract. Do 3 × 5 first.",
        );
      }
    }
    {
      const kind = (text: string, a: number, b: number) => {
        const e = parse(text);
        const r = checkPick(e, ids(e, a, b));
        return r.ok ? "ok" : r.mistake;
      };
      expect(kind("12 ÷ 3 × 2", 3, 2)).toBe("left-to-right");
      expect(kind("10 − 4 + 2", 4, 2)).toBe("left-to-right");
      expect(kind("2 × (4 + 1)", 2, 4)).toBe("brackets-first");
      expect(kind("6 + 2 × (7 − 1)", 6, 2)).toBe("brackets-first");
      expect(kind("2 × 3²", 2, 3)).toBe("exponent-first");
      expect(kind("4 + 3 × 5", 4, 5)).toBe("not-same-step");
      expect(kind("4 + 3 × 5", 3, 5)).toBe("ok");
    }
    {
      const e = parse("3² + 1");
      const pow = stepForPick(e, ids(e, 3))!;
      expect(answerMistake(pow, 6)).toBe("power-as-times");
      expect(answerHint("power-as-times", pow)).toBe(
        "3² means 3 × 3, not 3 × 2.",
      );
      const m = parse("3 × 5");
      expect(answerMistake(m, 8)).toBe("added-not-multiplied");
    }
  });

  it("every level makes fair bags from a seed, the same every time, and level 6 targets need brackets", () => {
    {
      for (const { level } of LEVELS) {
        for (const full of [true, false]) {
          const a = makeSet(level, full, seededRandom(`t-${level}-${full}`));
          const b = makeSet(level, full, seededRandom(`t-${level}-${full}`));
          expect(a.map((x) => x.text)).toEqual(b.map((x) => x.text));
          for (const bag of a) {
            expect(fair(bag.expr, 1000)).toBe(true);
            expect(bag.answer).toBe(valueOf(bag.expr));
          }
        }
      }
    }
    {
      const set = makeSet(3, true, seededRandom("short"));
      expect(set.slice(0, 5).every((b) => !b.pattern.includes("d"))).toBe(true);
    }
    {
      for (let i = 0; i < 20; i++) {
        const bag = makeBracketBag(seededRandom(`br-${i}`));
        expect(bag.plain).not.toBe(bag.target);
        expect(bracketsReach(bag, ...bag.span)).toBe(true);
      }
      // The doc example: 2 + 5 × 5 is 27; (2 + 5) × 5 is 35.
      expect(
        bracketsReach(
          { flat: "2 + 5 × 5", plain: 27, target: 35, span: [0, 1] },
          0,
          1,
        ),
      ).toBe(true);
      expect(
        bracketsReach(
          { flat: "2 + 5 × 5", plain: 27, target: 35, span: [0, 1] },
          1,
          2,
        ),
      ).toBe(false);
    }
  });
});
