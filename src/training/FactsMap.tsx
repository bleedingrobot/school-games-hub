import { useState } from 'react';
import { BANDS, UNTRIED } from '../../shared/training/config';
import { buildMap, familyLines } from '../../shared/training/map';
import type { TrainingState } from '../../shared/training/records';
import { BandChip } from './BandChip';

export function FactsMap({ state, today, onBack }: { state: TrainingState; today: string; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const map = buildMap(state, today);
  const lines = open ? familyLines(open, state, today) : [];
  const openCell = open ? map.flat().find((c) => c.familyKey === open) : null;
  return (
    <section className="tr-screen tr-map-screen">
      <div className="tr-row tr-row-between">
        <h2>My facts map</h2>
        <button type="button" className="tr-btn" onClick={onBack}>
          Back
        </button>
      </div>
      <div className="tr-map-wrap">
        <div className="tr-map" role="grid" aria-label="Times tables facts map">
          <div className="tr-map-corner" aria-hidden>
            ×
          </div>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={`h${i}`} className="tr-map-head" aria-hidden>
              {i + 1}
            </div>
          ))}
          {map.map((row, r) => [
            <div key={`r${r}`} className="tr-map-head" aria-hidden>
              {r + 1}
            </div>,
            ...row.map((cell, c) => {
              const band = cell.timesBand === null ? UNTRIED : BANDS[cell.timesBand];
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  role="gridcell"
                  className={`tr-cell${cell.due ? ' tr-due' : ''}${cell.familyKey === open ? ' tr-open' : ''}${cell.timesBand === null ? ' tr-untried' : ''}`}
                  style={{ background: band.bg, color: band.fg }}
                  onClick={() => setOpen(cell.familyKey === open ? null : cell.familyKey)}
                  aria-label={`${r + 1} times ${c + 1} is ${cell.product}: ${cell.timesBand === null ? UNTRIED.label : BANDS[cell.timesBand].label}${cell.due ? ', ready to practise again' : ''}`}
                >
                  {cell.product}
                  {cell.divisionBand !== null && <i className="tr-div" style={{ background: BANDS[cell.divisionBand].bg }} aria-hidden />}
                </button>
              );
            }),
          ])}
        </div>
        <div className="tr-legend" aria-label="Colour key">
          {BANDS.map((b) => (
            <span key={b.id} className="tr-chip" style={{ background: b.bg, color: b.fg }}>
              {b.label}
            </span>
          ))}
          <span className="tr-chip tr-untried" style={{ background: UNTRIED.bg, color: UNTRIED.fg }}>
            {UNTRIED.label}
          </span>
        </div>
        <p className="tr-small">The small corner dot shows division. A soft glow means it’s a good day to practise that one again.</p>
      </div>
      {open && openCell && (
        <aside className="tr-family" aria-live="polite">
          <h3>
            {openCell.a} and {openCell.b} family
          </h3>
          <ul>
            {lines.map((l) => (
              <li key={l.text}>
                <span>{l.text}</span>
                <BandChip band={l.band} />
              </li>
            ))}
          </ul>
        </aside>
      )}
    </section>
  );
}
