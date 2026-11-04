import { STAGES } from '../../shared/subitising/config';
import { growth, type Progress } from '../../shared/subitising/engine';
import { artUrl, type ArtName } from './art';
import { PlantSvg, type Level, type StageId } from './PlantSvg';

const WORDS = ['A seed', 'Sprouting', 'Growing', 'Nearly in flower', 'In flower'] as const;

/** One plant, from a seed (0) to a flower (4): the painted picture if there is one, else a drawn stand-in. */
function Plant({ stage, level }: { stage: StageId; level: Level }) {
  const url = artUrl(`plant-${stage}-${level}` as ArtName);
  if (url) return <img src={url} alt="" aria-hidden="true" className="sb-plant sb-plant--art" loading="lazy" decoding="async" />;
  return <PlantSvg stage={stage} level={level} />;
}

/** One plant in its own raised bed for each stage (seven now). They only ever grow. `grew` lists stages that just moved up a step. */
export function Garden({ progress, grew = [] }: { progress: Progress; grew?: number[] }) {
  return (
    <ul className="sb-garden" aria-label="Your garden" style={{ ['--sb-n' as string]: STAGES.length }}>
      {STAGES.map((s) => {
        const level = growth(progress.stages[s.id - 1]);
        return (
          <li key={s.id} className="sb-plant-card">
            <div className={grew.includes(s.id) ? 'sb-plantbox sb-grow' : 'sb-plantbox'}>
              <Plant stage={s.id as StageId} level={level} />
            </div>
            <div className="sb-bed" aria-hidden="true" />
            <div className="sb-plaque">
              <strong>{s.name}</strong>
              <span>{WORDS[level]}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
