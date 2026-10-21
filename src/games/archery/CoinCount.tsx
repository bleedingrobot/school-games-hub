/** The pupil's coins: a gold coin and the number, read out as "320 coins". */
export function CoinCount({ coins, onEarn }: { coins: number; onEarn?: () => void }) {
  return (
    <span className="ar-coins">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="17" r="13" fill="#b9780c" />
        <circle cx="16" cy="15" r="13" fill="#ffc83d" stroke="#2a1c14" strokeWidth="2" />
        <circle cx="16" cy="15" r="9" fill="none" stroke="#e39a17" strokeWidth="2" />
        <path d="M16 9.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z" fill="#fff3b8" />
      </svg>
      <b>{coins}</b>
      <span className="ar-sr"> coins</span>
      {onEarn && (
        <button type="button" className="button button--light ar-btn ar-coins__plus" aria-label="Earn more coins in a speed round" onClick={onEarn}>+</button>
      )}
    </span>
  );
}
