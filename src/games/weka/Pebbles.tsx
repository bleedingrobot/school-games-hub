/**
 * The same question again with pebbles (James, 6 Nov 2026; a real choice since maths review R9): after a right answer
 * on a full or split-first go, two ten-frames show it. The bigger number sits as gold pebbles in the first ten-frame
 * and the smaller as silver in the second. The child drags as many silver pebbles across as they think make ten (8 + 5:
 * 2 move, 3 stay), then taps Check. Nothing stops by itself. Right: "10 is full. 2 gone, 3 left." Too few or too many:
 * Bella says how many spaces or how many to put back (a tap on a pebble in the first frame puts it back). A wrong first
 * check tells the game this go was not right first time (help only; the saved maths record is not changed), and after
 * two wrong checks the right number moves across to show it. A tap on a silver pebble moves it too, so it works
 * without dragging and from the keyboard.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PointingHand } from '../../kit/PointingHand';
import { pebbleAskLine, pebbleFewLine, pebbleManyLine, pebbleRightLine, pebbleShowLine, type Go } from '../../../shared/weka/round';
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
  /** The first wrong Check: this go was not right first time. */
  onFirstWrong?: () => void;
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

export function Pebbles({ go, guided = false, sound, last, say, onFirstWrong, onNext }: Props) {
  /** Which silver pebbles (by their place in the second ten-frame) have moved across, in order. */
  const [arrived, setArrived] = useState<number[]>([]);
  const left = Array.from({ length: go.small }, (_, i) => i).filter((i) => !arrived.includes(i));
  /** Checks that were wrong, the words after the last Check, and whether the step is finished. */
  const [wrongs, setWrongs] = useState(0);
  const [result, setResult] = useState('');
  const [done, setDone] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hint, setHint] = useState(false);
  const [over, setOver] = useState(false);
  const firstFrame = useRef<HTMLDivElement>(null);
  const moved = arrived.length;

  useEffect(() => {
    say(pebbleAskLine(go));
    // Once per go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hand shows the way when the child waits.
  useEffect(() => {
    setHint(guided && !done && moved < go.toTen);
    if (done || moved >= go.toTen) return;
    const t = window.setTimeout(() => setHint(true), HINT_MS);
    return () => window.clearTimeout(t);
  }, [moved, done, wrongs]);

  function moveAcross(index: number) {
    if (done || !left.includes(index)) return;
    setArrived((a) => [...a, index]);
    setResult('');
    if (sound) playSound('tap');
  }

  function putBack(index: number) {
    if (done || !arrived.includes(index)) return;
    setArrived((a) => a.filter((i) => i !== index));
    setResult('');
    if (sound) playSound('tap');
  }

  function finish(line: string) {
    setResult(line);
    setDone(true);
    if (sound) playSound('badge');
    say(line);
  }

  /** Check: right finishes; too few or too many say so; the second wrong check moves the right number across. */
  function check() {
    if (done || moved === 0) return;
    if (moved === go.toTen) return finish(pebbleRightLine(go));
    const w = wrongs + 1;
    setWrongs(w);
    if (w === 1) onFirstWrong?.();
    if (w >= 2) {
      setArrived(Array.from({ length: go.toTen }, (_, i) => i));
      return finish(pebbleShowLine(go));
    }
    const line = moved < go.toTen ? pebbleFewLine(go.toTen - moved) : pebbleManyLine(moved - go.toTen);
    setResult(line);
    if (sound) playSound('tap');
    say(line);
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
        <Frame label={done ? WORDS.tenFull : WORDS.pebblesIn(go.big + moved)} src={frameSrc} refEl={firstFrame} glow={over} full={done} extra={
          arrived.slice(Math.max(0, 10 - go.big)).map((i) => (
            <button key={i} type="button" className="wk-pebble wk-pebble--back" onClick={() => putBack(i)} disabled={done} aria-label={WORDS.putBackPebble}>
              <Stone metal="silver" />
            </button>
          ))
        }>
          {Array.from({ length: 10 }, (_, i) => {
            const mine = i - go.big;
            const index = mine >= 0 ? arrived[mine] : undefined;
            return (
              <span key={i} className="wk-frame__cell">
                {i < go.big ? (
                  <span className="wk-pebble"><Stone metal="gold" /></span>
                ) : index !== undefined ? (
                  <button type="button" className="wk-pebble wk-pebble--arrived wk-pebble--back" onClick={() => putBack(index)} disabled={done} aria-label={WORDS.putBackPebble}>
                    <Stone metal="silver" />
                  </button>
                ) : null}
              </span>
            );
          })}
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
        <p className={`wk-pebbles__said${result ? '' : ' wk-pebbles__said--empty'}`} aria-live="polite">
          {done ? `${go.big} + ${go.toTen} = 10, 10 + ${go.rest} = ${go.total}` : result || '.'}
        </p>
        {done ? (
          <button type="button" className="wk-button wk-next" onClick={onNext}>
            {last ? WORDS.finish : WORDS.next} <span aria-hidden="true">➜</span>
          </button>
        ) : (
          <button type="button" className="wk-button wk-next" onClick={check} disabled={moved === 0}>
            {WORDS.check}
          </button>
        )}
      </div>
    </div>
  );
}

/** One ten-frame: the painted tray when there is one (a clay board drawn in code until then), two rows of five. */
export function Frame({ label, src, children, refEl, glow, full, extra }: {
  label: string; src?: string; children: React.ReactNode; refEl?: React.RefObject<HTMLDivElement | null>; glow?: boolean; full?: boolean; extra?: React.ReactNode;
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
      {extra !== undefined && <div className="wk-frame__extra">{extra}</div>}
      <span className="wk-frame__label" aria-hidden="true">{label}</span>
    </div>
  );
}
