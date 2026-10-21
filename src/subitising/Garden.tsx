import { STAGES } from '../../shared/subitising/config';
import { growth, type Progress } from '../../shared/subitising/engine';

const WORDS = ['A seed', 'Sprouting', 'Growing', 'Nearly in flower', 'In flower'] as const;

/** One plant, from a seed (0) to a flower (4). Drawn plain so it works in any size. */
function Plant({ level }: { level: 0 | 1 | 2 | 3 | 4 }) {
  const stem = 6 + level * 14;
  return (
    <svg viewBox="0 0 80 100" className="sb-plant" aria-hidden="true">
      <ellipse cx="40" cy="90" rx="26" ry="8" fill="#8a6a45" />
      {level === 0 ? (
        <circle cx="40" cy="82" r="5" fill="#5b3f22" />
      ) : (
        <>
          <line x1="40" y1="88" x2="40" y2={88 - stem} stroke="#3a8a4a" strokeWidth="5" strokeLinecap="round" />
          {level >= 2 && <ellipse cx="30" cy={88 - stem * 0.55} rx="10" ry="5" fill="#4da45c" transform={`rotate(-30 30 ${88 - stem * 0.55})`} />}
          {level >= 3 && <ellipse cx="50" cy={88 - stem * 0.75} rx="10" ry="5" fill="#4da45c" transform={`rotate(30 50 ${88 - stem * 0.75})`} />}
          {level === 4 ? (
            <g>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="40" cy={88 - stem - 9} rx="6" ry="10" fill="#f0a73a" transform={`rotate(${a} 40 ${88 - stem})`} />
              ))}
              <circle cx="40" cy={88 - stem} r="6" fill="#fff2b0" />
            </g>
          ) : (
            <circle cx="40" cy={88 - stem} r={level === 3 ? 6 : 4} fill="#6fbf7d" />
          )}
        </>
      )}
    </svg>
  );
}

/** Four plants, one for each stage. They only ever grow. */
export function Garden({ progress }: { progress: Progress }) {
  return (
    <ul className="sb-garden" aria-label="Your garden">
      {STAGES.map((s) => {
        const level = growth(progress.stages[s.id - 1]);
        return (
          <li key={s.id} className="sb-plant-card">
            <Plant level={level} />
            <strong>{s.name}</strong>
            <span className="sb-small">{WORDS[level]}</span>
          </li>
        );
      })}
    </ul>
  );
}
