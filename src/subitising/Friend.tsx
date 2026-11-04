import { artUrl } from './art';

/** A small ladybird next to the feedback line: cheering for a right answer, gentle for a wrong one. */
export function Friend({ happy }: { happy: boolean }) {
  const url = artUrl(happy ? 'friend-happy' : 'friend-calm');
  if (url) return <img src={url} alt="" aria-hidden="true" className="sb-friend" loading="lazy" decoding="async" />;
  return (
    <svg className="sb-friend" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {happy && (
        <g stroke="#e0891a" strokeWidth="2.5" strokeLinecap="round">
          <path d="M8 22 L14 26M5 34 L12 34M56 22 L50 26M59 34 L52 34" />
        </g>
      )}
      <g stroke="#1f2a37" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M26 14 Q 22 6 17 7M38 14 Q 42 6 47 7" />
        <path d="M16 40 L9 44M16 50 L10 56M48 40 L55 44M48 50 L54 56" />
      </g>
      <ellipse cx="32" cy="38" rx="19" ry="18" fill="#d64545" stroke="#8c1d18" strokeWidth="1.5" />
      <path d="M32 21 V56" stroke="#8c1d18" strokeWidth="1.5" />
      <g fill="#1f2a37">
        <circle cx="22" cy="36" r="3.2" />
        <circle cx="42" cy="36" r="3.2" />
        <circle cx="24" cy="48" r="2.6" />
        <circle cx="40" cy="48" r="2.6" />
      </g>
      <path d="M14 26 Q 32 8 50 26 Q 32 18 14 26Z" fill="#1f2a37" />
      <circle cx="26" cy="22" r="3.4" fill="#fff" />
      <circle cx="38" cy="22" r="3.4" fill="#fff" />
      <circle cx="26.6" cy="22.4" r="1.5" fill="#1f2a37" />
      <circle cx="38.6" cy="22.4" r="1.5" fill="#1f2a37" />
      {happy ? (
        <path d="M27 28 Q 32 34 37 28" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M28 29.5 Q 32 32 36 29.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}
