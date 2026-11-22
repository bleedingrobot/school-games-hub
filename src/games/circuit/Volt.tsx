/**
 * Volt, the friendly little robot plug who talks on the dashboard (docs/CIRCUIT-PLAN.md, section 5.7). A drawn stand-in:
 * the painting comes in Stage 5 and the guided first go in Stage 6.
 */
export function Volt({ line }: { line: string | null }) {
  return (
    <div className={`cr-volt${line ? ' cr-volt--talking' : ''}`}>
      <svg className="cr-volt__face" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
        <rect x="22" y="2" width="5" height="12" rx="2" fill="#facc15" />
        <rect x="37" y="2" width="5" height="12" rx="2" fill="#facc15" />
        <rect x="8" y="12" width="48" height="40" rx="12" fill="#1e293b" stroke="#22d3ee" strokeWidth="3" />
        <circle cx="24" cy="30" r="6" fill="#67e8f9" />
        <circle cx="40" cy="30" r="6" fill="#67e8f9" />
        <path d="M22 41 Q32 48 42 41" stroke="#f0abfc" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="26" y="52" width="12" height="9" rx="3" fill="#334155" />
      </svg>
      {line && <p className="cr-volt__line" role="status">{line}</p>}
    </div>
  );
}
