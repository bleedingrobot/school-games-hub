/**
 * The same question again with pebbles (James, 6 Nov 2026): after a right answer on a full or split-first go, two
 * ten-frames show it. The bigger number sits as gold pebbles in the first ten-frame and the smaller as silver in the
 * second; the child drags silver pebbles across until the first ten-frame is full (8 + 5: 2 move, 3 stay), and Bella
 * says "8 and 2 make 10. 10 and 3 make 13." A tap on a silver pebble moves it too, so it works without dragging and
 * from the keyboard. Help only: never sent or recorded.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PointingHand } from '../../kit/PointingHand';
import { pebbleAskLine, pebbleDoneLine, type Go } from '../../../shared/weka/round';
import { playSound } from '../sounds';
import { paint } from './art';
import { Stone } from './WekaArt';
import { WORDS } from './words';

/** After this long without a move, a hand shows which pebble to drag. */
const HINT_MS = 7000;
/** A press that moves less than this is a tap. */
const TAP_PX = 8;

interface Props {
  go: Go;
  /** The child's very first go: the hand shows the way straight away. */
  guided?: boolean;
  sound: boolean;
  last: boolean;
  say: (text: string) => void;
  onNext: () => void;
}

interface Drag {
  index: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export function Pebbles({ go, guided = false, sound, last, say, onNext }: Props) {
  /** Which silver pebbles (by their place in the second ten-frame) are still there, and how many have moved across. */
  const [left, setLeft] = useState<number[]>(() => Array.from({ length: go.small }, (_, i) => i));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hint, setHint] = useState(false);
  const [over, setOver] = useState(false);
  const firstFrame = useRef<HTMLDivElement>(null);
  const moved = go.small - left.length;
  const done = go.big + moved >= 10;

  useEffect(() => {
    say(pebbleAskLine(go));
    // Once per go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hand shows the way when the child waits.
  useEffect(() => {
    setHint(guided && !done);
    if (done) return;
    const t = window.setTimeout(() => setHint(true), HINT_MS);
    return () => window.clearTimeout(t);
  }, [moved, done]);

  function moveAcross(index: number) {
    if (done || !left.includes(index)) return;
    const next = left.filter((i) => i !== index);
    setLeft(next);
    if (sound) playSound('tap');
    if (go.big + go.small - next.length >= 10) {
      if (sound) playSound('badge');
      say(pebbleDoneLine(go));
    }
  }

  const inFirst = (x: number, y: number) => {
    const r = firstFrame.current?.getBoundingClientRect();
    return !!r && x >= r.left - 20 && x <= r.right + 20 && y >= r.top - 20 && y <= r.bottom + 20;
  };

  function down(index: number, e: ReactPointerEvent<HTMLButtonElement>) {
    if (done) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // No live pointer (a synthetic press): the drag still works while the pointer stays over the pebble.
    }
    setDrag({ index, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false });
  }
  function move(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const far = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > TAP_PX;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved: drag.moved || far });
    setOver(inFirst(e.clientX, e.clientY));
  }
  function up(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    // A tap, or a drop on the first ten-frame, moves it across; a drop anywhere else puts it back.
    if (!drag.moved || inFirst(e.clientX, e.clientY)) moveAcross(drag.index);
    setDrag(null);
    setOver(false);
  }

  const frameSrc = paint('frames/ten-frame');
  const hintAt = hint && !drag ? left[0] : null;
  const sum = go.kind === 'turn' ? `${go.small} + ${go.big}` : `${go.big} + ${go.small}`;

  return (
    <div className="wk-pebbles">
      <p className="wk-pebbles__same">
        <span className="wk-pebbles__tag">{WORDS.sameQuestion}</span> <span className="wk-pebbles__sum">{sum}</span>
      </p>
      <div className="wk-pebbles__frames">
        <Frame label={done ? WORDS.tenFull : WORDS.pebblesIn(go.big + moved)} src={frameSrc} refEl={firstFrame} glow={over} full={done}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="wk-frame__cell">
              {i < go.big ? (
                <span className="wk-pebble"><Stone metal="gold" /></span>
              ) : i < go.big + moved ? (
                <span className="wk-pebble wk-pebble--arrived"><Stone metal="silver" /></span>
              ) : null}
            </span>
          ))}
        </Frame>
        <Frame label={WORDS.pebblesIn(left.length)} src={frameSrc}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="wk-frame__cell">
              {left.includes(i) && (
                <button
                  type="button"
                  className={`wk-pebble wk-pebble--move${drag?.index === i ? ' wk-pebble--held' : ''}${hintAt === i ? ' wk-pebble--hint' : ''}`}
                  style={drag?.index === i && drag.moved ? { translate: `${drag.x - drag.startX}px ${drag.y - drag.startY}px` } : undefined}
                  onPointerDown={(e) => down(i, e)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onDragStart={(e) => e.preventDefault()}
                  onPointerCancel={() => { setDrag(null); setOver(false); }}
                  // The keyboard and screen readers click without a pointer (detail 0); a pointer is handled above.
                  onClick={(e) => { if (e.detail === 0) moveAcross(i); }}
                  disabled={done}
                  aria-label={`${WORDS.movePebble}${hintAt === i ? `, ${WORDS.guideHere}` : ''}`}
                >
                  <Stone metal="silver" />
                  {hintAt === i && <PointingHand prefix="wk" className="wk-pebbles__hand" />}
                </button>
              )}
            </span>
          ))}
        </Frame>
      </div>
      <div className="wk-pebbles__end">
        <p className={`wk-pebbles__said${done ? '' : ' wk-pebbles__said--empty'}`} aria-live="polite">
          {done ? `${go.big} + ${go.toTen} = 10, 10 + ${go.rest} = ${go.total}` : ''}
        </p>
        {done && (
          <button type="button" className="wk-button wk-next" onClick={onNext}>
            {last ? WORDS.finish : WORDS.next} <span aria-hidden="true">➜</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** One ten-frame: the painted tray when there is one (a clay board drawn in code until then), two rows of five. */
export function Frame({ label, src, children, refEl, glow, full }: {
  label: string; src?: string; children: React.ReactNode; refEl?: React.RefObject<HTMLDivElement | null>; glow?: boolean; full?: boolean;
}) {
  return (
    <div className="wk-frame-wrap">
      <div
        ref={refEl}
        className={`wk-frame${src ? ' wk-frame--painted' : ''}${glow ? ' wk-frame--over' : ''}${full ? ' wk-frame--full' : ''}`}
        style={src ? { backgroundImage: `url(${src})` } : undefined}
        role="group"
        aria-label={label}
      >
        <div className="wk-frame__grid">{children}</div>
      </div>
      <span className="wk-frame__label" aria-hidden="true">{label}</span>
    </div>
  );
}
