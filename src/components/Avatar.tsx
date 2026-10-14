/** A simple placeholder face. The real avatar maker arrives in Stage 3. */
export function Avatar({ colour, size = 96, label }: { colour: string; size?: number; label?: string }) {
  return (
    <svg
      className="avatar"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="50" cy="50" r="50" fill={colour} />
      <circle cx="50" cy="54" r="30" fill="#ffe0bd" />
      <path d="M22 48c0-20 12-30 28-30s28 10 28 30c-6-8-16-12-28-12s-22 4-28 12z" fill="#3b2a20" />
      <circle cx="39" cy="54" r="4.5" fill="#1d1b3a" />
      <circle cx="61" cy="54" r="4.5" fill="#1d1b3a" />
      <circle cx="40.5" cy="52.5" r="1.5" fill="#fff" />
      <circle cx="62.5" cy="52.5" r="1.5" fill="#fff" />
      <path d="M40 66q10 9 20 0" stroke="#1d1b3a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="31" cy="64" r="4" fill="#ff8fa3" opacity="0.6" />
      <circle cx="69" cy="64" r="4" fill="#ff8fa3" opacity="0.6" />
    </svg>
  );
}
