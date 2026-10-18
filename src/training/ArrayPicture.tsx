interface Props {
  rows: number;
  cols: number;
}

/** A grid of dots: `rows` rows of `cols`. A gap after every fifth row and column makes big ones easy to count. */
export function ArrayPicture({ rows, cols }: Props) {
  const r = 9;
  const step = 22;
  const gap = 8;
  const x = (c: number) => 12 + c * step + Math.floor(c / 5) * gap;
  const y = (i: number) => 12 + i * step + Math.floor(i / 5) * gap;
  const width = x(cols - 1) + 12;
  const height = y(rows - 1) + 12;
  return (
    <svg className="tr-array" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${rows} rows of ${cols}`}>
      {Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (_, c) => <circle key={`${i}-${c}`} cx={x(c)} cy={y(i)} r={r} className={`tr-dot${i % 2 ? ' tr-dot-b' : ''}`} />),
      )}
    </svg>
  );
}
