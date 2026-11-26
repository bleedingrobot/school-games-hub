import { recommendKind } from './text';

/** "★ Main" or "Also good" next to a stat: how much it matters for this member's class (CLASS_MAIN, CLASS_ALSO). */
export function RecBadge({ cls, stat }: { cls: string; stat: string }) {
  const kind = recommendKind(cls, stat);
  if (!kind) return null;
  return kind === 'main' ? (
    <span className="cq-rec cq-rec--main" title={`The most important stat for a ${cls}`}> ★ Main<span className="sr-only"> stat for a {cls}</span></span>
  ) : (
    <span className="cq-rec cq-rec--also" title={`Also good for a ${cls}`}> Also good<span className="sr-only"> for a {cls}</span></span>
  );
}
