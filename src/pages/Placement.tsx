/**
 * The warm-up that finds a student's starting place on the maths ladder (docs/MATHS-FOCUS-PLAN.md section 5). About 10 questions that
 * jump up while the answers are right and quick and step back when they aren't. Friendly and skippable; never called a test, and
 * it shows no score. The server checks the questions and stores only where to start.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { fetchMyLadder, sendPlacement, type MyLadder } from "../data/ladder";
import { FriendlyError } from "../data/profile";
import { PLACEMENT_QUESTIONS } from "../../shared/maths/config";
import type { PlacementAnswer } from "../../shared/maths/placementCheck";
import {
  isQuick,
  placementNext,
  placementQuestion,
  type PlacementStep,
} from "../../shared/maths/place";
import type { Question } from "../../shared/maths/skillPack";
import { QuestionModal, type MarkedAnswer } from "../maths/QuestionModal";
import { sameAnswer } from "../../shared/maths/banded";
import "../maths/ladderPath.css";

type Step =
  | "loading"
  | "intro"
  | "asking"
  | "saving"
  | "done"
  | "unavailable"
  | "trouble";

const errorText = (error: unknown) =>
  error instanceof FriendlyError
    ? error.message
    : "Something went wrong. Please try again.";

export default function Placement() {
  const [ladder, setLadder] = useState<MyLadder | null>(null);
  const [step, setStep] = useState<Step>("loading");
  /** The questions asked so far (the last one is on screen) and what was answered, side by side. */
  const [asked, setAsked] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [steps, setSteps] = useState<PlacementStep[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  /** What the student typed for the question on screen, and how long it took. */
  const given = useRef({ answer: 0, ms: 0 });
  const yearLevel = ladder?.focus.ladder?.yearLevel ?? null;
  const question = step === "asking" ? (asked[steps.length] ?? null) : null;

  useEffect(() => {
    let current = true;
    fetchMyLadder().then(
      (d) => {
        if (!current) return;
        setLadder(d);
        setStep(
          d.focus.ladder?.on && !d.focus.ladder.placed
            ? "intro"
            : "unavailable",
        );
      },
      () => current && setStep("unavailable"),
    );
    return () => {
      current = false;
    };
  }, []);

  /** The next question: from the skill the walk is on, and not a fact already asked of that skill. */
  function nextQuestion(
    done: readonly PlacementStep[],
    before: readonly Question[],
  ): Question | null {
    const skill = placementNext(yearLevel, done);
    if (!skill) return null;
    const used = before
      .filter((_, i) => done[i]?.skill === skill.id)
      .map((q) => q.factKey);
    return placementQuestion(skill, before.length + 1, Math.random, used);
  }

  function begin() {
    const first = nextQuestion([], []);
    if (!first) return void setStep("trouble");
    setSteps([]);
    setAnswers([]);
    setAsked([first]);
    setMessage(null);
    setStep("asking");
  }

  /** Marks it here for the feedback box; the server marks it again for real. */
  function mark(q: Question, answer: number, ms: number): MarkedAnswer {
    given.current = { answer, ms };
    const fact = q.parts
      .map((part) => (part === "?" ? String(q.answer) : part))
      .join(" ");
    return { correct: sameAnswer(answer, q.answer), fact, boxBefore: 0, boxAfter: 0 };
  }

  async function finish(all: PlacementAnswer[]) {
    setStep("saving");
    setMessage(null);
    try {
      await sendPlacement({ answers: all });
      setStep("done");
    } catch (error) {
      setMessage(errorText(error));
      setStep("trouble");
    }
  }

  async function skip() {
    setStep("saving");
    try {
      await sendPlacement({ skip: true });
      setStep("done");
    } catch (error) {
      setMessage(errorText(error));
      setStep("intro");
    }
  }

  function onDone(q: Question, result: MarkedAnswer) {
    const skill = placementNext(yearLevel, steps)!;
    const { answer, ms } = given.current;
    const nextSteps = [
      ...steps,
      {
        skill: skill.id,
        correct: result.correct,
        quick: result.correct && isQuick(ms, skill),
      },
    ];
    const nextAnswers = [
      ...answers,
      { skill: skill.id, parts: q.parts, answer, ms },
    ];
    setSteps(nextSteps);
    setAnswers(nextAnswers);
    if (nextSteps.length >= PLACEMENT_QUESTIONS)
      return void finish(nextAnswers);
    const fresh = nextQuestion(nextSteps, asked);
    if (!fresh) return void setStep("trouble");
    setAsked([...asked, fresh]);
  }

  return (
    <section className="placement" aria-labelledby="placement-title">
      <h1 id="placement-title" className="page-title">
        Find my starting place
      </h1>
      <div className="panel placement__panel">
        {step === "loading" && <p>Loading…</p>}
        {step === "unavailable" && (
          <>
            <p>There’s nothing to do here right now.</p>
            <Link to="/" className="button button--primary">
              Back to home
            </Link>
          </>
        )}
        {step === "intro" && (
          <>
            <p>
              Here are about {PLACEMENT_QUESTIONS} quick questions. They help
              the games start in a good place for you. There are no marks and no
              one sees how you did. If a question is tricky, just have a go.
            </p>
            <div className="focus-card__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={begin}
              >
                Let’s go
              </button>
              <button
                type="button"
                className="button button--light-outline"
                onClick={() => void skip()}
              >
                Skip it
              </button>
            </div>
            <p className="focus-card__small">
              If you skip, the games start from your class’s usual place, and
              you can’t do this later.
            </p>
            {message && <p role="alert">{message}</p>}
          </>
        )}
        {step === "asking" && question && (
          <>
            <p className="placement__count">
              Question {steps.length + 1} of {PLACEMENT_QUESTIONS}
            </p>
            <QuestionModal
              key={question.id}
              inline
              question={question}
              title="Warm-up"
              onSubmit={(typed, ms) => mark(question, typed, ms)}
              onDone={(result) => onDone(question, result)}
              timeScale={0.5}
            />
          </>
        )}
        {step === "saving" && <p role="status">Saving…</p>}
        {step === "done" && (
          <>
            <p role="status">
              <span aria-hidden="true">🎉</span> All done! The games are ready
              for you.
            </p>
            <Link to="/" className="button button--primary">
              Back to home
            </Link>
          </>
        )}
        {step === "trouble" && (
          <>
            <p role="alert">{message ?? "We couldn’t finish that."}</p>
            {answers.length >= PLACEMENT_QUESTIONS ? (
              <button
                type="button"
                className="button button--primary"
                onClick={() => void finish(answers)}
              >
                Try again
              </button>
            ) : (
              <button
                type="button"
                className="button button--primary"
                onClick={begin}
              >
                Start again
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
