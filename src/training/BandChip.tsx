import { BANDS, UNTRIED } from '../../shared/training/config';
import type { BandIndex } from '../../shared/training/speed';

/** A colour and its label. Students only ever see these, never seconds. */
export function BandChip({ band, text }: { band: BandIndex | null; text?: string }) {
  const b = band === null ? UNTRIED : BANDS[band];
  return (
    <span className="tr-chip" style={{ background: b.bg, color: b.fg }}>
      {text ?? b.label}
    </span>
  );
}
