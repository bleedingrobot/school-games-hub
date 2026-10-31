/** A number as a card or the mismatch line shows it: "7", "0.30", or a stacked fraction for "3/8". */
export function Value({ text }: { text: string }) {
  const m = /^(\d+)\/(\d+)$/.exec(text);
  if (!m) return <span className="bm-num">{text}</span>;
  return (
    <span className="bm-frac" aria-hidden="true">
      <span className="bm-frac__top">{m[1]}</span>
      <span className="bm-frac__bottom">{m[2]}</span>
    </span>
  );
}

/** A small bar of `den` equal parts with `num` filled in: a hint of how big the fraction is. Never the only information. */
export function FractionBar({ num, den }: { num: number; den: number }) {
  return (
    <span className="bm-bar-pic" aria-hidden="true" data-testid="fraction-picture">
      {Array.from({ length: den }, (_, i) => <span key={i} className={i < num ? 'bm-bar-pic__part bm-bar-pic__part--on' : 'bm-bar-pic__part'} />)}
    </span>
  );
}
