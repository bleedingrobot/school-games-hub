/**
 * Every skill on the ladder, through the Battle Cry: the server makes a ladder fight's questions for a focus on that one
 * skill, the page is given what to show (never the answer), the child answers in the question box, and the server marks
 * it right (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.1 rule 4). A skill added to the ladder later is checked here too.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, type OpenFight, type ServerState } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import type { MathsFocus } from '../../../shared/maths/focus';
import { LADDER } from '../../../shared/maths/ladder';
import { markQuestion, sameAnswer, type MathsContext } from '../../../shared/maths/serverQuestions';
import { publicFight } from '../../../supabase/functions/clans/handler';
import { Fight } from './Fight';
import { newSession } from './session';

const SEED = 777;
const focusOn = (skill: string): MathsFocus => ({ source: 'teacher-class', skills: [skill], onlyThese: true, endsAt: null, canChoose: false, own: null });

function ladderFight(skill: string, multipleChoice: boolean): ServerState {
  const maths: MathsContext = { facts: [], settings: { enabledTables: [2, 3, 4, 5, 6, 7, 8, 9, 10], division: true, multipleChoice }, focus: focusOn(skill) };
  const made = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: 20_000 });
  if (!made.ok || !made.state) throw new Error('create failed');
  const started = applyAction(made.state, { type: 'fightStart', depth: 0, boss: false, ladder: true }, { seed: SEED, today: 20_000, maths });
  if (!started.ok || !started.state) throw new Error('fightStart failed');
  return started.state;
}

afterEach(cleanup);

describe('every ladder skill as a Battle Cry', () => {
  for (const skill of LADDER.filter((s) => s.built)) {
    for (const multipleChoice of [false, true]) {
      it(`${skill.id}${multipleChoice ? ' (multiple choice)' : ''}`, async () => {
        const state = ladderFight(skill.id, multipleChoice);
        const fight = state.fight as OpenFight;
        const q = fight.questions![0];
        expect(q, skill.id).toBeTruthy();
        const right = markQuestion(q)!.answer;
        const open = publicFight(fight);
        expect(JSON.stringify(open.questions)).not.toMatch(/"answer"|"factKey"|"params"/);
        // The server's check, the way cryCheck marks it.
        const checks: boolean[] = [];
        const onCheck = async (_round: number, answer: number) => {
          const correct = sameAnswer(answer, right);
          checks.push(correct);
          return { correct, answer: right, given: answer };
        };
        const u = userEvent.setup();
        render(<Fight session={newSession(state.clan, SEED)} open={open} onCheck={onCheck} onRound={() => {}} onFinish={() => {}} />);
        const box = await screen.findByRole('dialog', { name: 'Battle Cry!' });
        expect(screen.getByLabelText(q.spoken)).toBeInTheDocument();
        const i = q.choices?.indexOf(right) ?? -1;
        if (q.choices && i >= 0) {
          // Choice buttons are named as they are spoken ("7 tenths"), so press the right one by its place.
          await u.click(box.querySelectorAll<HTMLButtonElement>('.question__choice')[i]);
        } else {
          box.focus();
          await u.keyboard(String(right));
          await u.keyboard('{Enter}');
        }
        expect(await screen.findByText(/Correct!/)).toBeInTheDocument();
        expect(checks).toEqual([true]);
      });
    }
  }
});
