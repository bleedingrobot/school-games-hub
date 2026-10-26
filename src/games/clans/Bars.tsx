/** A bar with the numbers written on it (never colour alone). */
export function Bar({ label, value, max, kind }: { label: string; value: number; max: number; kind: 'hp' | 'sp' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`cq-bar cq-bar--${kind}`} title={kind === 'hp' ? 'HP: how many hits you can take before being knocked out.' : 'SP: skill points, the fuel for spells.'} role="img" aria-label={`${label} ${Math.max(0, value)} of ${max}`}>
      <span className="cq-bar__fill" style={{ width: `${pct}%` }} />
      <span className="cq-bar__text">
        {label} {Math.max(0, value)}/{max}
      </span>
    </div>
  );
}
