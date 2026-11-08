import { useEffect } from 'react';

export interface DemoBarProps {
  /** The game's class prefix: the bar is `<prefix>-demo`. */
  prefix: string;
  skipLabel: string;
  replayLabel?: string;
  canSkip: boolean;
  onSkip: () => void;
  onReplay?: () => void;
}

/** The small bar under a demo: Skip (only once `canSkip`) and, if the game wants it, Replay. In line, never covering a choice. Escape also skips. */
export function DemoBar({ prefix, skipLabel, replayLabel, canSkip, onSkip, onReplay }: DemoBarProps) {
  useEffect(() => {
    if (!canSkip) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSkip, onSkip]);
  return (
    <div className={`${prefix}-demo`}>
      {canSkip && (
        <button type="button" className={`${prefix}-button`} onClick={onSkip}>
          {skipLabel}
        </button>
      )}
      {replayLabel && onReplay && (
        <button type="button" className={`${prefix}-button`} onClick={onReplay}>
          {replayLabel}
        </button>
      )}
    </div>
  );
}
