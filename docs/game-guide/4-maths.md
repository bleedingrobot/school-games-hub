# 4. Maths questions: the one approved way

Maths is the most important shared system. A student has **one maths focus** at a time, decided by the server: a teacher focus for the student, then for their group, then for their class, then the student's own choice (if the class allows it), then **auto** (the ladder of 31 skills from bonds to 10 up to fractions, decimals and percentages). Plan: `docs/MATHS-FOCUS-PLAN.md`. Code: `shared/maths/`.

**Junior games (ages 5 to 8) are different.** They (find them with `grep -l JUNIOR_QUICK_MS supabase/functions/*/entry.ts`) don't use `makeFocusPack`: each makes its own round from the child's early-facts records (`shared/maths/skillPacks/earlyFacts.ts` keys, or its own), replays the taps on the server, and records the first tap of each go with `recordMathsAnswers(…, JUNIOR_QUICK_MS)`. Copy Weka for this, and follow LEARNING-DESIGN.md section 5.

**Don't copy the maths of** Maths Monsters' battles, Dragon Maths (except its bank question), Clan Quest's quests and shop, or Basic facts training: they use older year-band questions (`shared/maths/banded.ts`, `practical.ts`) or their own records. Copy Toon Flap or Marble Rush (way A below). Open to-dos, not for a game branch: Dragon Maths still needs `syncPlace` and `countForFocuses` after saving (as `monster/handler.ts` does); Marble still has its own copies of `seededRandom` and `publicQuestion`; `clans` and `monster` still use the 5-second `QUICK_MS` for every pack (waits for James).

### 4.1 The rules

1. **Read the focus, never work it out.** On the server: `space_maths_context(player)` (server key only) returns `{ facts, settings, focus }`. In the browser: `fetchMyFocus()` (`my_maths_focus()`), or include `maths_focus_of(auth.uid())` in your own load function, as `my_gem_keep()` does. Always pass it through `parseFocus()`. Anything odd becomes auto. Keep the focus you have for the rest of a level or run, even if a new one could be read. A focus that ended mid-game takes effect next time (`currentFocus()` does the time check).
2. **Get questions from the pack.** `makeFocusPack(facts, focus, { enabledTables, division }, random)` from `shared/maths/focus.ts` gives a `SkillPack`, and `pack.nextQuestion(ctx)` gives one `Question`. This one function covers every case: auto off (the times-table campaign), auto on (the ladder from the student's place), a teacher or student focus. Pass a **seeded** `random` (`seededRandom(seed)` from `shared/maths/serverQuestions.ts`) so the server can make the same questions again.
3. **Asking for different kinds** goes in the `QuestionContext` you hand `nextQuestion`:
   - `multipleChoice: true` gives four choices to tap (follow the class switch: `settings.multipleChoice`).
   - `onlyFocus: true` asks only the focus skills, with no review or stretch (Gem Keep's Level Key).
   - `boxes: [0, 1]` gives only facts in those mastery boxes (easier: weakest first); `boxes: [3, 4]` gives confidence builders.
   - `missingFactor`, `division` follow the class's settings for times tables.
   - Easier or harder *within* the focus is the pack's job (60% focus, 30% review, 10% stretch). Don't pick skills yourself.
4. **Show every kind of question the ladder can make**, so a skill added later just works. Show it with `QuestionModal` (or pass a `ShownQuestion` to it), and never draw `parts` yourself. If you must build your own display (Marble's answer gates), handle **all** of these:
   - `parts`: text left to right with `'?'` as the blank; a part like `'3/4'` or `'?/8'` is a fraction; parts can be words (`'Round'`). Plus an optional `prompt` line above.
   - `choices` (numbers) with optional `choiceLabels` (`'2/3'`, `'0.25'`, `'25%'`). **When `choiceLabels` is set, the question can only be answered by picking**, whatever the multiple-choice switch says. There can be 2 or 4 choices.
   - `input: 'decimal'` means show a point key; `maxLength` is the longest answer (default 3).
   - `spoken`: what a screen reader says. Use it as the question's accessible name.
   One test should run every skill in `LADDER` through your game and check the server can mark it (copy `shared/archery/server.test.ts`).
5. **The server marks, never the browser.** Two safe ways (4.2 below). Either way the right answer comes from a question the server made or rebuilt, never from what the browser says.
6. **Record every marked answer** so it counts towards the student's records, their place on the ladder, the teacher's skill map and the focus results:
   - **Use `recordMathsAnswers(rpc, player, answers, once, '<name>')`** from `_shared/recordAnswers.ts`. `once` is something unique to this save (the run's seed and the question's slot), so a save sent twice counts once. It does everything below, and never throws.
   - What it does, so you don't write it again: splits the answers by pack (`groupByPack`); calls `record_fact_answers` once per pack with that pack's quick time (`quickMsForPack`, **not** `QUICK_MS`: the `generated` pack's is 8 s), `FLUENT_DAYS` and `TOP_BOX`; and, for a batch the records took for the first time, adds them to the teacher's focus results (`countForFocuses`).
   - `answers` are `FactAnswer`s: `{ key, correct, ms, at }`, where `key` is the question's `factKey`. `recordMathsAnswers` keeps each time to at most two minutes (`keptMs`). Fill the optional `given` on each `FactAnswer` with the pupil's answer (at least when it was wrong), so the teacher's views can show "Often answers 54".
7. **No warm-up yet? Do nothing special.** A student who hasn't done the placement warm-up starts at the first skill and climbs from their own answers (changed 20 Oct 2026). The home page's path card already offers the warm-up. Your game doesn't need to ask or block.
8. **A maths switch for your game, if it has optional maths:** a column `<game>_maths text default 'choose' check (… in ('off','choose','on'))` and `parseMathsSwitch()` from `shared/space/mathsSwitch.ts` (Marble copies Mission Control here). If maths is the whole game, you don't need one.
9. **Teacher settings page:** only if your game needs settings of its own. Make `src/pages/Teacher<Game>.tsx` (copy `TeacherMarble.tsx`), name it as `teacher.Settings` in your definition (it is given the class as `classId`), build it from the shared controls in `src/teacher/Settings.tsx`, and save through `teacher_set_<game>()`. The focus itself is set on the shared **Set focus** page. Never add focus controls of your own.

### 4.2 Two ways to mark

**A. The server makes the questions (recommended; Marble Rush).** It's best for anything with a score, a time or a reward.
1. The browser asks your function to start (`{ type: 'start' }`).
2. The function reads `space_maths_context(player)`, makes the pack from a fresh seed, makes N questions, and **stores the whole questions** in a table pupils can't read (`<game>_questions`: RLS on, no policy, no grant; compare `marble_questions`).
3. It sends the browser only what to show: `publicQuestion()` (`shared/maths/serverQuestions.ts`) strips `answer`, `factKey` and `params`.
4. The browser shows each one with `QuestionModal` and sends `{ seed, slot, value, ms }`.
5. The function loads the stored question, marks `value === question.answer`, claims the slot **once** (`<game>_claim_answer` returns false if it was already answered), and records it (rule 6).

**B. The browser makes the questions (Gem Keep).** Use this only when the game must keep going offline.
1. The browser builds the pack itself from `my_<game>()` (facts + settings + focus) and wraps it in `showingPack()` (`shared/maths/claim.ts`), so every answer carries `key`, `params` (the numbers the question was made from), `parts` (what was shown) and the value given.
2. Your function marks each one with `solveClaim()`, which rebuilds the question from its key and numbers and checks the parts match exactly. Anything that doesn't hold up is refused and not recorded.

### 4.3 Worked example: a new game asks 5 questions from the focus and saves the answers

Server side (`supabase/functions/<name>/entry.ts`, way A, trimmed). Copy the real error handling and limits from Marble.

```ts
import { makeFocusPack, parseFocus } from '../../../shared/maths/focus';
import { publicQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';

// start: make and keep 5 questions, send only what to show
const ctxRow = (await admin.rpc('space_maths_context', { player })).data;
const focus = parseFocus(ctxRow.focus);
const { enabledTables, division, multipleChoice } = ctxRow.settings;
const pack = makeFocusPack(ctxRow.facts, focus, { enabledTables, division }, seededRandom(seed));
const questions = [];
for (let i = 0; i < 5; i++) {
  const q = pack.nextQuestion({ multipleChoice, enabledTables, division });
  if (q) questions.push(q);
}
await admin.rpc('<game>_store_questions', { player, seed, questions });   // a table pupils can't read
return { seed, questions: questions.map((q, slot) => publicQuestion(q, slot)) };

// answer: mark it here, once, and record it
const stored = (await admin.rpc('<game>_load_questions', { player, seed })).data;
const q = stored.questions[slot];
const correct = value === q.answer;
if (!(await admin.rpc('<game>_claim_answer', { player, seed, slot, value, right_answer: correct })).data) return { already: true };
const answers = [{ key: q.factKey, correct, ms: Math.min(ms, 120_000), at: Date.now() }];
await recordMathsAnswers((n, a) => admin.rpc(n, a), player, answers, `${seed}:${slot}`, '<name>');
return { correct, answer: q.answer };   // the browser shows "7 × 8 = 56" after a wrong answer
```

Browser side (trimmed):

```tsx
const { seed, questions } = await startRound();          // src/data/<game>.ts → your function
<QuestionModal
  question={questions[i]}                                  // no answer in it: the server keeps it
  title="Bridge gate"
  onSubmit={async (value, ms) => {
    const r = await sendAnswer(seed, questions[i].slot, value, ms);
    return { correct: r.correct, fact: …, boxBefore: 0, boxAfter: 0, answer: r.answer };
  }}
  onDone={() => setI(i + 1)}
/>
```

Tests to copy: Marble's `handler.test.ts` (right, wrong, sent twice, a slot that doesn't exist, another student's seed) and `shared/archery/server.test.ts` (every ladder skill makes questions the server can mark).
