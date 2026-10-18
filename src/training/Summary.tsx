import { FACT_BY_KEY, promptText } from '../../shared/training/facts';
import { recordBand, type TrainingState } from '../../shared/training/records';
import { summaryMessage, type SessionSummary } from '../../shared/training/summary';
import { BandChip } from './BandChip';

export function Summary({ summary, state, onHome, onMap }: { summary: SessionSummary; state: TrainingState; onHome: () => void; onMap: () => void }) {
  const changed = summary.improved.slice(0, 12);
  return (
    <section className="tr-screen tr-summary">
      <h2>{summaryMessage(summary)}</h2>
      <p>You practised {summary.practised} {summary.practised === 1 ? 'fact' : 'facts'} today.</p>
      {changed.length > 0 && (
        <ul className="tr-changes">
          {changed.map((c) => (
            <li key={c.factKey}>
              <span>{promptText(FACT_BY_KEY.get(c.factKey)!)}</span>
              <BandChip band={recordBand(state.records[c.factKey])} />
            </li>
          ))}
        </ul>
      )}
      <div className="tr-row">
        <button type="button" className="tr-btn" onClick={onMap}>
          My facts map
        </button>
        <button type="button" className="tr-btn tr-btn-primary" onClick={onHome}>
          Done
        </button>
      </div>
    </section>
  );
}
