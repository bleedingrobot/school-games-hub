/**
 * The Skill map's "By skill" view, for an iPad in portrait or a phone: one card per skill the class is using, most pupils first,
 * with name chips for who is on it now and who has slipped back on it. Tapping a chip opens the same side panel (a sheet from the
 * bottom on a narrow screen) as a cell in the grid. It uses the same maps as the grid; nothing new is loaded.
 */
import type { MapStudent } from '../data/skillMap';
import type { LadderSkill } from '../../shared/maths/ladder';
import { cellFor, classCounts, LEVELS, stageLabel, type Look, type StudentMap } from '../../shared/maths/skillMap';

interface Props {
  skills: LadderSkill[];
  /** The pupils shown (after a "who needs a look" filter). */
  students: MapStudent[];
  /** Every pupil's map, for the class counts. */
  maps: Map<string, StudentMap>;
  looks: Map<string, Set<Look>>;
  /** A pupil to light up (?pupil= from the Students tab). */
  marked?: string | null;
  onPick: (student: string, skill: string) => void;
}

export default function SkillMapBySkill({ skills, students, maps, looks, marked, onPick }: Props) {
  const all = [...maps.values()];
  const cards = skills
    .map((skill, order) => {
      const here = students.filter((s) => maps.get(s.id)?.current?.id === skill.id);
      const slipped = students.filter((s) => {
        const m = maps.get(s.id)!;
        return m.current?.id !== skill.id && cellFor(m, skill.id)?.level === 'learning';
      });
      const secure = students.filter((s) => {
        const level = cellFor(maps.get(s.id)!, skill.id)?.level;
        return level === 'secure' || level === 'fluent';
      });
      return { skill, order, here, slipped, secure };
    })
    .filter((c) => c.here.length + c.slipped.length + c.secure.length > 0)
    .sort((a, b) => b.here.length - a.here.length || a.order - b.order);

  if (cards.length === 0) return <p className="panel__empty">Nobody here has started these skills yet.</p>;

  return (
    <div className="skill-cards">
      {cards.map(({ skill, here, slipped, secure }) => {
        const counts = classCounts(all, skill.id);
        const w = (n: number) => `${all.length ? (n / all.length) * 100 : 0}%`;
        const chip = (s: MapStudent, now: boolean) => {
          const level = cellFor(maps.get(s.id)!, skill.id)?.level ?? 'not-started';
          const mine = looks.get(s.id);
          const flag = now && (mine?.has('stuck') || mine?.has('hard')) ? 'hard' : now && mine?.has('nearly') ? 'nearly' : undefined;
          return (
            <li key={s.id}>
              <button
                type="button"
                className="skill-cards__kid"
                data-level={level}
                data-now={now || undefined}
                data-look={flag}
                data-marked={marked === s.id || undefined}
                onClick={() => onPick(s.id, skill.id)}
              >
                {s.name}
                {flag === 'nearly' ? ' ↑' : ''}
                <span className="sr-only">
                  : {LEVELS[level].label}
                  {flag === 'nearly' ? ', nearly ready to move up' : flag === 'hard' ? ', needs a look' : ''}
                </span>
              </button>
            </li>
          );
        };
        return (
          <section key={skill.id} className="skill-cards__card" aria-labelledby={`card-${skill.id}`}>
            <h3 id={`card-${skill.id}`} className="skill-cards__name">
              {skill.label}
              <span className="skill-cards__meta">
                {stageLabel(skill.stage)} · {counts.secure + counts.fluent} of {all.length} secure
              </span>
            </h3>
            <span className="skill-map__bar skill-cards__bar" aria-hidden="true">
              <i data-level="fluent" style={{ width: w(counts.fluent) }} />
              <i data-level="secure" style={{ width: w(counts.secure) }} />
              <i data-level="learning" style={{ width: w(counts.learning) }} />
            </span>
            <div className="skill-cards__group">
              <span className="skill-cards__label">Now here</span>
              {here.length ? <ul>{here.map((s) => chip(s, true))}</ul> : <span className="skill-cards__none">nobody</span>}
            </div>
            {slipped.length > 0 && (
              <div className="skill-cards__group">
                <span className="skill-cards__label">Slipped back</span>
                <ul>{slipped.map((s) => chip(s, false))}</ul>
              </div>
            )}
            {secure.length > 0 && (
              <details className="skill-cards__group">
                <summary>
                  <span className="skill-cards__label">Secure</span> {secure.length} pupil{secure.length === 1 ? '' : 's'}
                </summary>
                <ul>{secure.map((s) => chip(s, false))}</ul>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
