import { useId, type ReactNode } from 'react';
import { problemWith, type Action, type Island, type Prices } from '../../../shared/isles/engine';
import { whyNot } from './words';

/**
 * A button for one choice in a turn. If the rules say it can't be made now, it is greyed out and says why underneath,
 * with the numbers ("Needs 85 coins. You have 40.").
 */
export function Choice({
  island,
  prices,
  action,
  onChoose,
  children,
  pip,
  lit,
  kind = 'button--primary',
}: {
  island: Island;
  prices: Prices;
  action: Action;
  onChoose: (action: Action) => void;
  children: ReactNode;
  pip?: string;
  lit?: string | null;
  kind?: string;
}) {
  const id = useId();
  const problem = problemWith(island, action, prices);
  return (
    <div className="si-choice">
      <button
        type="button"
        className={`button ${kind} si-choice__button${pip && lit === pip ? ' si-lit' : ''}`}
        data-pip={pip}
        disabled={problem !== null}
        aria-describedby={problem ? id : undefined}
        onClick={() => onChoose(action)}
      >
        {children}
      </button>
      {problem && <span id={id} className="si-choice__why">{whyNot(island, action, problem)}</span>}
    </div>
  );
}
