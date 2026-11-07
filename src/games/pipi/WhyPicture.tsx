/**
 * The pictures for a wrong shell (maths review R5). Little round shells in a row stand for the pipi: teal for the ones
 * showing, coral for the ones hiding, the same two colours in "7 = 4 + 3". Each kind of mistake lights a different part.
 */
import type { Go, WrongKind } from '../../../shared/pipi/round';
import { WORDS } from './words';

type Dot = 'show' | 'hide';

function Row({ dots, count = false, countAll = false, glow = false, aside = false, extra = 0, label }: { dots: Dot[]; count?: boolean; countAll?: boolean; glow?: boolean; aside?: boolean; extra?: number; label?: string }) {
  let hidden = 0;
  return (
    <div className="pp-dots" aria-hidden="true">
      {label && <span className="pp-dots__label">{label}</span>}
      {dots.map((d, i) => {
        if (d === 'hide') hidden++;
        return (
          <span
            key={i}
            className={`pp-dot pp-dot--${d}${glow ? ' pp-dot--glow' : ''}${aside && d === 'show' ? ' pp-dot--aside' : ''}${(count && d === 'hide') || countAll ? ' pp-dot--counted' : ''}`}
            style={{ ['--pp-n' as string]: countAll || d === 'show' ? i : hidden }}
          >
            {countAll ? i + 1 : count && d === 'hide' ? hidden : ''}
          </span>
        );
      })}
      {Array.from({ length: extra }, (_, i) => (
        <span key={`x${i}`} className="pp-dot pp-dot--extra" style={{ ['--pp-n' as string]: i }} />
      ))}
    </div>
  );
}

const split = (showing: number, hiding: number): Dot[] => [...Array<Dot>(showing).fill('show'), ...Array<Dot>(hiding).fill('hide')];

/** What a wrong shell of this kind looks like in the pipi's own colours. */
export function WhyPicture({ go, kind }: { go: Go; kind: WrongKind }) {
  const { whole, showing, hiding } = go;
  switch (kind) {
    case 'shown': // the showing ones lit, the hiding ones dashed and counted
      return <Row dots={split(showing, hiding)} count />;
    case 'whole': // all of them glow, then the showing ones step aside
      return <Row dots={split(showing, hiding)} glow aside />;
    case 'add': // the whole, and the extra dots that adding the showing ones would put on
      return (
        <>
          <Row dots={split(showing, hiding)} extra={showing} />
          <p className="pp-sum">{`${whole} + ${showing} = ${whole + showing}`}</p>
        </>
      );
    case 'part': // the showing group and the popped-up group join
      return <Row dots={split(showing, hiding)} glow />;
    case 'before': // both tides, the same whole
      return (
        <>
          <Row dots={split(hiding, showing)} label={WORDS.firstTide} />
          <Row dots={split(showing, hiding)} label={WORDS.nowTide} />
        </>
      );
    case 'off1': // counted slowly, one by one
      return go.kind === 'altogether' ? <Row dots={split(showing, hiding)} countAll /> : <Row dots={split(showing, hiding)} count />;
  }
}

/** "7 = 4 + 3", coloured to match the dots, filling in part by part (`filled` of 3), over the row of dots. */
export function SplitSum({ go, filled }: { go: Go; filled: number }) {
  return (
    <>
      <p className="pp-sum pp-sum--split" aria-label={`${go.whole} = ${go.showing} + ${go.hiding}`}>
        <span className="pp-sum__whole">{go.whole}</span>
        <span className={filled >= 2 ? 'pp-sum__on' : 'pp-sum__off'}> = <b className="pp-sum__show">{go.showing}</b></span>
        <span className={filled >= 3 ? 'pp-sum__on' : 'pp-sum__off'}> + <b className="pp-sum__hide">{go.hiding}</b></span>
      </p>
      <Row dots={split(go.showing, go.hiding)} />
    </>
  );
}
