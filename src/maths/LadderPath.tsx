/**
 * A student's own path along the maths ladder (docs/MATHS-FOCUS-PLAN.md section 5b): secure skills filled in, "You are here",
 * the rest greyed, and a line saying how far along they are. A small strip that opens into the whole path. Only their own
 * progress, no ranks, and skills have names, never year levels. Times-table skills open into their tables.
 */
import { useId, useState } from 'react';
import { STEP_SECURE_SHARE } from '../../shared/maths/selector';
import { CAMPAIGN_STEPS } from '../../shared/maths/config';
import { parseFactKey, tableFacts } from '../../shared/maths/facts';
import type { LadderProgress, SkillProgress } from '../../shared/maths/ladder';
import type { FactStats } from '../../shared/maths/leitner';
import './ladderPath.css';

/** How a skill is shown: 'secure', 'here' (the one they're on) or 'next'. */
function state(p: SkillProgress): 'secure' | 'here' | 'next' {
  return p.status === 'secure' ? 'secure' : p.status === 'current' ? 'here' : 'next';
}

const STATE_TEXT = { secure: 'Secure', here: 'You are here', next: 'Coming up' } as const;
const SYMBOL = { secure: '✓', here: '▶', next: '' } as const;

/** The tables a skill covers (×3, ×4, ×8), with whether each one is secure (the same 70% rule as the skill). */
function tablesOf(p: SkillProgress, byKey: Map<string, FactStats>): { table: number; secure: boolean }[] {
  if (p.skill.stage !== 'times-tables') return [];
  const step = CAMPAIGN_STEPS.find((s) => `tables-${s.add.join('-')}` === p.skill.id);
  if (!step) return [];
  return step.add.map((table) => {
    const keys = tableFacts(table).filter((k) => parseFactKey(k)!.b <= (step.upTo ?? 12));
    const share = keys.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / keys.length;
    return { table, secure: p.status === 'secure' || share >= STEP_SECURE_SHARE };
  });
}

export function LadderPath({
  progress,
  facts,
  teacherSkills = [],
}: {
  progress: LadderProgress;
  facts: readonly FactStats[];
  /** The skill ids a teacher's focus is on, if one is running. */
  teacherSkills?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const built = progress.skills.filter((p) => p.skill.built && !(p.status === 'upcoming' && p.share === 1));
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const teacher = new Set(teacherSkills);
  const here = built.find((p) => p.status === 'current');

  return (
    <div className="ladder-path">
      <p className="ladder-path__count">
        <strong>
          {progress.secureCount} of {progress.builtCount}
        </strong>{' '}
        skills secure
      </p>
      <ol className="ladder-path__strip" aria-label="My maths path">
        {built.map((p, i) => {
          const s = state(p);
          return (
            <li key={p.skill.id} className="ladder-path__stop" data-state={s} data-pick={teacher.has(p.skill.id) || undefined}>
              <span className="ladder-path__dot" aria-hidden="true">
                {SYMBOL[s]}
              </span>
              <span className="sr-only">
                {i + 1}. {p.skill.label}. {STATE_TEXT[s]}.{teacher.has(p.skill.id) ? ' Your teacher’s pick.' : ''}
              </span>
            </li>
          );
        })}
      </ol>
      {here ? (
        <p className="ladder-path__here">
          <strong>You are here:</strong> {here.skill.label}
        </p>
      ) : (
        <p className="ladder-path__here">You have every skill on the path secure. Brilliant!</p>
      )}
      {teacher.size > 0 && (
        <p className="ladder-path__pick">
          <span aria-hidden="true">⭐</span> Your teacher’s pick:{' '}
          {built
            .filter((p) => teacher.has(p.skill.id))
            .map((p) => p.skill.label.replace(/^Times tables: /, ''))
            .join(', ')}
        </p>
      )}
      <button type="button" className="button button--light-outline" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide my whole path' : 'See my whole path'}
      </button>
      {open && (
        <ol id={panelId} className="ladder-path__list">
          {built.map((p) => {
            const s = state(p);
            const tables = tablesOf(p, byKey);
            return (
              <li key={p.skill.id} className="ladder-path__row" data-state={s}>
                <span className="ladder-path__dot" aria-hidden="true">
                  {SYMBOL[s]}
                </span>
                <span className="ladder-path__what">
                  <span className="ladder-path__name">{p.skill.label}</span>
                  <span className="ladder-path__state">
                    {STATE_TEXT[s]}
                    {teacher.has(p.skill.id) && ' · Your teacher’s pick'}
                  </span>
                  {tables.length > 0 && (
                    <ul className="ladder-path__tables" aria-label="Tables in this skill">
                      {tables.map((t) => (
                        <li key={t.table} data-secure={t.secure || undefined}>
                          ×{t.table}
                          <span className="sr-only">{t.secure ? ' secure' : ' not yet'}</span>
                          <span aria-hidden="true">{t.secure ? ' ✓' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
