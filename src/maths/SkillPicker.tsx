/**
 * A list of the maths skills a focus can name, grouped by stage, as tick boxes. Used by the teacher's Set focus screen and by a
 * student choosing their own focus. Only skills the games can ask today are listed (the rest come as the ladder is built).
 */
import { useId } from 'react';
import { LADDER, type LadderStage } from '../../shared/maths/ladder';

export const STAGE_NAMES: Record<LadderStage, string> = {
  'early-facts': 'Early number facts',
  'times-tables': 'Times tables',
  'place-value': 'Place value',
  rounding: 'Rounding',
  'order-of-operations': 'Order of operations',
  'fractions-decimals-percentages': 'Fractions, decimals and percentages',
};

/** The skills on offer, in ladder order. */
export const OFFERED_SKILLS = LADDER.filter((s) => s.built);

export function SkillPicker({
  value,
  onChange,
  legend = 'Skills',
  disabled = false,
}: {
  value: string[];
  onChange: (skills: string[]) => void;
  legend?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const stages = [...new Set(OFFERED_SKILLS.map((s) => s.stage))];
  const toggle = (skill: string) =>
    onChange(OFFERED_SKILLS.map((s) => s.id).filter((s) => (s === skill ? !value.includes(s) : value.includes(s))));
  return (
    <fieldset className="skill-picker" disabled={disabled}>
      <legend>{legend}</legend>
      {stages.map((stage) => (
        <div key={stage} className="skill-picker__stage" role="group" aria-labelledby={`${id}-${stage}`}>
          <h3 id={`${id}-${stage}`}>{STAGE_NAMES[stage]}</h3>
          <ul>
            {OFFERED_SKILLS.filter((s) => s.stage === stage).map((skill) => (
              <li key={skill.id}>
                <label>
                  <input type="checkbox" checked={value.includes(skill.id)} onChange={() => toggle(skill.id)} /> {skill.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </fieldset>
  );
}
