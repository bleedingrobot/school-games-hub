/**
 * Where the 960 × 540 field sits on the canvas, between the HUD's strips (docs/ARCHERY-PLAN.md, section 10).
 */
import { FIELD_H, FIELD_W } from '../../../../shared/archery/config';

export interface ViewInsets { top: number; right: number; bottom: number; left: number }

export interface Layout {
  /** The canvas's size in CSS px. */
  cw: number;
  ch: number;
  /** Backing-store pixels per CSS px. */
  ratio: number;
  /** CSS px per field px. */
  s: number;
  /** Where the field's top-left corner is, in CSS px, with the camera at rest. */
  ox: number;
  oy: number;
  /** How far below the field (in field px) the deep rock must reach to fill the canvas. */
  below: number;
  insets: ViewInsets;
}

/** The share of the field's top that may sit under the top HUD strip (always sky there). */
export const TUCK = 0.18;

export function computeLayout(cw: number, ch: number, insets: ViewInsets, ratio: number): Layout {
  cw = Math.max(1, cw);
  ch = Math.max(1, ch);
  const left = Math.max(0, insets.left), right = Math.max(0, insets.right);
  const top = Math.max(0, insets.top), bottom = Math.max(0, insets.bottom);
  const aw = Math.max(40, cw - left - right);
  const ah = Math.max(40, ch - top - bottom);
  const sw = aw / FIELD_W;
  // The field may tuck TUCK of its height under the top strip (but not past the canvas's top).
  const sh = Math.min(ah / (FIELD_H * (1 - TUCK)), (ch - bottom) / FIELD_H);
  const s = Math.max(0.05, Math.min(sw, sh));
  const fw = FIELD_W * s, fh = FIELD_H * s;
  const ox = Math.round((left + (aw - fw) / 2) * ratio) / ratio;
  // Any spare height: shared between sky above and deep rock below.
  const visibleH = fh - Math.min(top, fh * TUCK);
  const spare = Math.max(0, ah - visibleH);
  const fieldBottom = ch - bottom - spare * 0.5;
  const oy = Math.round((fieldBottom - fh) * ratio) / ratio;
  const below = Math.ceil((ch - (oy + fh)) / s) + 40;
  return { cw, ch, ratio, s, ox, oy, below, insets: { top, right, bottom, left } };
}
