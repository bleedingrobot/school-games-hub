/**
 * How to play, on the big screen before a Class Live game starts (James, 24 Nov 2026): one screen with a few big lines
 * and a picture each, for the game and the mode the teacher picked. Bella reads it line by line (each line lights up as
 * she says it). The class watches, then the teacher presses "Let's play!" to start.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenView } from '../../../shared/classlive/server';
import { SERPENT_LEVEL_ABOUT, SERPENT_LEVEL_NAMES } from '../../../shared/classlive/serpent';
import { speak, stopSpeaking } from '../../speech';
import { painted } from './paintedArt';
import { MAP_WORDS } from '../../../shared/classlive/corners';
import { HALL_WORDS } from '../../../shared/classlive/thrones';
import { HOWTO, VOICE_FOLDER } from './voiceLines';

type Game = ScreenView['game'];
interface Step { icon: string; text: string; say: string }
interface Sheet { title: string; mode: string | null; modeSay: string | null; steps: Step[]; art: string | null }

const STAR_MODE: Record<string, string> = { small: 'Facts up to 5 times', middle: 'Facts up to 10 times', big: 'Facts up to 12 times', own: 'A fact your teacher picked' };

export function sheetFor(game: Game): Sheet {
  if (game.kind === 'stars') {
    const { x, y, p } = game.anchor;
    const H = HOWTO.stars;
    return {
      title: 'How to play Star Web', mode: STAR_MODE[game.level] ?? null, modeSay: null, art: painted('back', 'star-sky', true),
      steps: [
        { icon: '🌟', text: `We know ${x} × ${y} = ${p}.`, say: H[0] },
        { icon: '✏️', text: 'Use it to work out new facts: turn it round, double, halve, times by 10, or one more group.', say: H[1] },
        { icon: '✨', text: 'Send your fact. Each new one becomes a star on the big screen.', say: H[2] },
        { icon: '🐋', text: 'Light up every arm of the web to bring out the sky creature!', say: H[3] },
      ],
    };
  }
  if (game.kind === 'serpent') {
    const H = HOWTO.serpent;
    return {
      title: 'How to play Serpent Chain', mode: `${SERPENT_LEVEL_NAMES[game.chain.level]}: ${SERPENT_LEVEL_ABOUT[game.chain.level]}`, modeSay: HOWTO.serpentLevel[game.chain.level],
      art: painted('serpent', 'coil'),
      steps: [
        { icon: '🐍', text: `Start at ${game.chain.start}. Do each sum along the serpent, one box at a time.`, say: H[0] },
        { icon: '🔢', text: 'Write each answer on your device. You get two tries.', say: H[1] },
        { icon: '💎', text: 'Every right answer moves your gem up the serpent.', say: H[2] },
        { icon: '⚡', text: 'Right answers from the whole class wake the serpent. Reach the head, then keep going on the bonus tail!', say: H[3] },
      ],
    };
  }
  if (game.kind === 'thrones') {
    const H = HOWTO.thrones;
    return {
      title: 'How to play Musical Thrones', mode: HALL_WORDS[game.hall].name, modeSay: null, art: painted('pick', 'thrones', true) ?? painted('thrones', `hall-${game.hall}`, true),
      steps: [
        { icon: '🕹️', text: 'Move your avatar with the joystick, or the arrow keys.', say: H[0] },
        { icon: '💃', text: 'Dance while the music plays. Be on a glowing dance tile when it stops for a bonus crown.', say: H[1] },
        { icon: '🪑', text: 'When the music stops, sit on a throne! There are fewer every round.', say: H[2] },
        { icon: '🏰', text: 'Left standing? Answer 3 questions in the courtyard to come back. 3 right in a row wins a 🗡️ Crown thief!', say: H[3] },
        { icon: '👑', text: 'A throne is 1 crown, a golden throne is 3. Most crowns wins!', say: H[4] },
      ],
    };
  }
  if (game.kind === 'corners') {
    const H = HOWTO.corners;
    return {
      title: 'How to play Four Corners', mode: MAP_WORDS[game.map].name, modeSay: null, art: painted('pick', 'corners', true) ?? painted('corners', `map-${game.map}`, true),
      steps: [
        { icon: '🕹️', text: 'Move your avatar with the joystick, or the arrow keys.', say: H[0] },
        { icon: '⏱️', text: 'Get to a corner before the countdown ends!', say: H[1] },
        { icon: '🎲', text: 'The dice picks a corner. Anyone there, or in no corner, goes to jail.', say: H[2] },
        { icon: '🔒', text: 'In jail, answer 3 questions to come back.', say: H[3] },
        { icon: '⚡', text: 'Grab power-ups, then answer a question in a corner to switch them on. Most safe rounds wins!', say: H[4] },
      ],
    };
  }
  const H = HOWTO.mural;
  return {
    title: 'How to play Mystery Mural', mode: null, modeSay: null, art: painted('back', 'gallery', true),
    steps: [
      { icon: '🖼️', text: 'A mystery picture is hiding under the tiles.', say: H[0] },
      { icon: '✅', text: 'Answer maths questions on your device. Each right answer flips a tile. You can see your tiles on your device.', say: H[1] },
      { icon: '⏱️', text: 'Keep answering until the time is up. The more tiles we flip, the more we see.', say: H[2] },
      { icon: '🤔', text: 'Then read the six riddles and pick the one that fits the picture!', say: H[3] },
    ],
  };
}

export function HowTo({ game, players, muted, onPlay, onBack }: { game: Game; players: number; muted: () => boolean; onPlay: () => void; onBack: () => void }) {
  // The screen updates as pupils join: the reading must not restart, so it keys on the game's kind only.
  const sheet = useMemo(() => sheetFor(game), [game]);
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [at, setAt] = useState(-1);
  // Bella reads the title's lines in turn; each line lights up while she says it.
  useEffect(() => {
    const sh = sheetRef.current;
    const lines = [...sh.steps.map((s) => s.say), ...(sh.modeSay ? [sh.modeSay] : [])];
    let dead = false;
    let timer = 0;
    let step = -1;
    const next = (i: number) => {
      if (dead || i <= step) return;
      step = i;
      setAt(i);
      if (i >= lines.length) return;
      // Never stuck on a line: move on after a while even if the clip never says it has ended.
      timer = window.setTimeout(() => next(i + 1), mutedRef.current() ? 2600 : 9000);
      if (!mutedRef.current()) speak(lines[i], VOICE_FOLDER, () => { window.clearTimeout(timer); timer = window.setTimeout(() => next(i + 1), 350); });
    };
    timer = window.setTimeout(() => next(0), 500);
    return () => { dead = true; window.clearTimeout(timer); stopSpeaking(); };
  }, [game.kind]);
  const play = () => { stopSpeaking(); onPlay(); };
  return (
    <div className={`cl-how cl-how--${game.kind}`} role="dialog" aria-label={sheet.title}>
      {sheet.art && <div className="cl-how__art" style={{ backgroundImage: `url(${sheet.art})` }} aria-hidden="true" />}
      <div className="cl-how__card">
        <h1 className="cl-how__title">{sheet.title}</h1>
        {sheet.mode && <p className={`cl-how__mode ${at >= sheet.steps.length ? 'cl-how__mode--on' : ''}`}>{sheet.mode}</p>}
        <ol className="cl-how__steps">
          {sheet.steps.map((s, i) => (
            <li key={i} className={`cl-how__step ${at === i ? 'cl-how__step--on' : ''} ${at > i ? 'cl-how__step--done' : ''}`} style={{ animationDelay: `${0.15 + i * 0.18}s` }}>
              <span className="cl-how__icon" aria-hidden="true">{s.icon}</span>
              <span className="cl-how__text">{s.text}</span>
            </li>
          ))}
        </ol>
        <div className="cl-how__go">
          <button type="button" className="cl-btn cl-btn--small" onClick={() => { stopSpeaking(); onBack(); }}>Back</button>
          <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={play}>Let's play!</button>
        </div>
        <p className="cl-how__who">{players} {players === 1 ? 'pupil' : 'pupils'} ready</p>
      </div>
    </div>
  );
}
