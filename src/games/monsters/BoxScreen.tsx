/**
 * The monster box: monsters that did not fit in the team of six. Move one into the team, or send a
 * team member to the box. The team is never empty and never more than six. No typing, no renaming.
 */
import { MAX_TEAM } from '../../../shared/monsters/engine';
import type { Monster } from '../../../shared/monsters/rules';
import { TeamList } from './ui';

export interface BoxProps {
  team: Monster[];
  box: Monster[];
  onToBox: (teamIndex: number) => void;
  onToTeam: (boxIndex: number) => void;
}

export function BoxScreen({ team, box, onToBox, onToTeam }: BoxProps) {
  return (
    <div className="bx">
      <section aria-labelledby="bx-team">
        <h3 id="bx-team">Your team ({team.length} of {MAX_TEAM})</h3>
        <TeamList
          team={team}
          active={-1}
          action={() => ({ label: 'Move to box', enabled: team.length > 1 })}
          onPick={onToBox}
        />
        {team.length <= 1 && <p className="mb-empty">Your team needs at least one monster.</p>}
      </section>
      <section aria-labelledby="bx-box">
        <h3 id="bx-box">Monster box ({box.length})</h3>
        {box.length ? (
          <TeamList
            team={box}
            active={-1}
            action={() => ({ label: 'Move to team', enabled: team.length < MAX_TEAM })}
            onPick={onToTeam}
          />
        ) : (
          <p className="mb-empty">The box is empty. When your team is full, new monsters you catch come here.</p>
        )}
        {box.length > 0 && team.length >= MAX_TEAM && <p className="mb-empty">Your team is full. Send someone to the box first.</p>}
      </section>
    </div>
  );
}
