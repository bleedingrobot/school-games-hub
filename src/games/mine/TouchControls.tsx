/**
 * The on-screen thumb sticks and buttons for phones and tablets. A stick has a round base; push the knob and the ship
 * moves (left stick) or turns (right stick). Big buttons fire, launch a missile, go up and down, and use a door or pad.
 * Right-handed: the look stick is under the right thumb. Left-handed swaps the sides.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Controls, TouchButton } from './controls';

const STICK = 120;
const KNOB = 52;

function Stick({ label, onChange, className }: { label: string; onChange: (x: number, y: number) => void; className: string }) {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  function update(e: ReactPointerEvent) {
    const r = base.current?.getBoundingClientRect();
    if (!r) return;
    const reach = (r.width - KNOB) / 2;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > reach) {
      dx = (dx / len) * reach;
      dy = (dy / len) * reach;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / reach, dy / reach);
  }
  function end(e: ReactPointerEvent) {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  }
  return (
    <div
      ref={base}
      className={`mn-stick ${className}`}
      role="presentation"
      aria-label={label}
      style={{ width: STICK, height: STICK }}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="mn-stick__knob" style={{ width: KNOB, height: KNOB, transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function HoldButton({ controls, which, className, children, label }: { controls: Controls; which: TouchButton; className: string; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className={`mn-touchbtn ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        controls.setButton(which, true);
      }}
      onPointerUp={() => controls.setButton(which, false)}
      onPointerCancel={() => controls.setButton(which, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export function TouchControls({ controls, hand, canUse, onUse }: { controls: Controls; hand: 'right' | 'left'; canUse: boolean; onUse: () => void }) {
  return (
    <div className="mn-touch" data-hand={hand}>
      <div className="mn-touch__side mn-touch__side--move">
        <HoldButton controls={controls} which="up" className="mn-touchbtn--small" label="Rise">▲</HoldButton>
        <HoldButton controls={controls} which="down" className="mn-touchbtn--small" label="Sink">▼</HoldButton>
        <Stick label="Move" className="mn-stick--move" onChange={(x, y) => controls.setMove(x, y)} />
      </div>
      <div className="mn-touch__side mn-touch__side--look">
        <div className="mn-touch__fire">
          <HoldButton controls={controls} which="missile" className="mn-touchbtn--missile" label="Missile">🚀</HoldButton>
          <HoldButton controls={controls} which="fire" className="mn-touchbtn--fire" label="Laser">FIRE</HoldButton>
        </div>
        <Stick label="Look" className="mn-stick--look" onChange={(x, y) => controls.setLook(x, y)} />
      </div>
      {canUse && (
        <button type="button" className="mn-touchbtn mn-touchbtn--use" onClick={onUse}>
          Use
        </button>
      )}
    </div>
  );
}
