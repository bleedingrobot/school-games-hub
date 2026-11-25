/** One printable QR sign-in badge, as on the class sheet, plus a big on-screen version a pupil can scan off a screen. */
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { badgeLink } from '../data/badge';
import { printBadges } from './badgePrint';

/** "ava.kingi" → "Ava Kingi": the school email's name part, tidied for the card. */
export function cardName(realName: string): string {
  return realName
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** A QR code as one SVG path (black squares on white), with the usual 4-square quiet edge. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { d, size: n + 8 };
  }, [text]);
  return (
    <svg className="badge-card__qr" viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.size} height={path.size} fill="#fff" />
      <path d={path.d} fill="#000" />
    </svg>
  );
}

export interface CardPupil {
  player: string;
  displayName: string;
  realName: string;
  code: string;
}

export function BadgeCard({ pupil, className, onShow, children }: { pupil: CardPupil; className: string | null; onShow?: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  const name = cardName(pupil.realName) || pupil.displayName;
  return (
    <li ref={ref} className="badge-card">
      <QrCode text={badgeLink(pupil.code)} label={`Sign-in badge for ${name}`} />
      <div className="badge-card__words">
        <p className="badge-card__name">{name}</p>
        <p className="badge-card__player">{pupil.displayName}</p>
        <p className="badge-card__class">{className ? `${className} · ` : ''}School Games Hub</p>
        <p className="badge-card__tip">📷 Scan me to play!</p>
        <div className="badge-card__tools">
          <button type="button" className="button button--light badge-card__renew" onClick={() => printBadges(ref.current)}>
            Print this card
          </button>
          {onShow && (
            <button type="button" className="button button--light badge-card__renew" onClick={onShow}>
              Show big
            </button>
          )}
          {children}
        </div>
      </div>
    </li>
  );
}

/** The badge filling the screen, so a pupil can scan it straight off the teacher's laptop or iPad. */
export function BigBadge({ pupil, onClose }: { pupil: CardPupil; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const name = cardName(pupil.realName) || pupil.displayName;
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="big-badge" role="dialog" aria-modal="true" aria-label={`Sign-in badge for ${name}`}>
      <div className="big-badge__box">
        <QrCode text={badgeLink(pupil.code)} label={`Sign-in badge for ${name}`} />
        <p className="big-badge__name">{name}</p>
        <p className="big-badge__tip">📷 Scan me to play!</p>
        <button ref={close} type="button" className="button button--primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
