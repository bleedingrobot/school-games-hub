import { useEffect, useState } from 'react';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

export function DieFace({ value, size = 64 }: { value: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="die">
      <rect x={4} y={4} width={92} height={92} rx={20} fill="#fff" stroke="#14112e" strokeWidth={6} />
      {(PIPS[value] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={9} fill="#14112e" />
      ))}
    </svg>
  );
}

/**
 * The dice tray. While `rolling`, the faces flicker for show (the real number is already
 * decided by the engine); then the real faces appear.
 */
export function Dice({ values, rolling, calm }: { values: number[]; rolling: boolean; calm: boolean }) {
  const [flicker, setFlicker] = useState(values);
  useEffect(() => {
    if (!rolling || calm) return;
    const timer = setInterval(() => setFlicker(values.map(() => 1 + Math.floor(Math.random() * 6))), 70);
    return () => clearInterval(timer);
  }, [rolling, calm, values]);
  const shown = rolling && !calm ? flicker : values;
  return (
    <div className={`dice${rolling ? ' is-rolling' : ''}`}>
      {shown.map((v, i) => (
        <DieFace key={i} value={v} />
      ))}
    </div>
  );
}
