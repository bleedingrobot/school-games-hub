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
