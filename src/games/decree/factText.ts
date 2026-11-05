/** The whole fact for a wrong answer, "7 × 8 = 56", made from what the question showed and the answer the server sent back. */
import type { ShownQuestion } from '../../maths/QuestionModal';

export function factText(q: Pick<ShownQuestion, 'parts' | 'choiceLabels'>, answer: number): string {
  const money = q.parts.includes('$');
  // A pick-one question's answer is the number of the choice: show the choice itself.
  const shown = q.choiceLabels?.[answer] ?? (money ? answer.toFixed(2) : String(answer));
  return q.parts.map((p) => (p.includes('?') ? p.replace('?', shown) : p)).join(money ? '' : ' ');
}
