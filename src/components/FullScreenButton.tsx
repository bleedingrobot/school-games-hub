import { useEffect, useState } from 'react';

// Safari on older iPads and Macs only has the webkit- names.
type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = () => document as WebkitDocument;

export function canGoFullScreen() {
  const d = doc();
  return Boolean(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

function isFullScreen() {
  const d = doc();
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}

/** Opened from a Home Screen icon (or installed on a Chromebook): there's no browser bar to hide. */
export function isHomeScreenApp() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)') : null;
  return standalone || Boolean(media?.matches);
}

async function enter() {
  const root = document.documentElement as WebkitElement;
  try {
    if (root.requestFullscreen) await root.requestFullscreen();
    else await root.webkitRequestFullscreen?.();
  } catch {
    // Refused (for example inside a frame): nothing to do, the page carries on as it was.
  }
}

async function leave() {
  const d = doc();
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
  } catch {
    // Already out.
  }
}

/** Fills the screen with the whole hub, so moving between games keeps it full. Where the browser can't (iPhone, some iPads), it explains Add to Home Screen instead. */
export function FullScreenButton() {
  const [full, setFull] = useState(isFullScreen);
  const [tip, setTip] = useState(false);
  const supported = canGoFullScreen();

  useEffect(() => {
    const changed = () => setFull(isFullScreen());
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('webkitfullscreenchange', changed);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('webkitfullscreenchange', changed);
    };
  }, []);

  if (isHomeScreenApp()) return null;

  if (!supported) {
    return (
      <div className="fullscreen-help">
        <button type="button" className="icon-button" aria-label="Full screen" aria-expanded={tip} onClick={() => setTip(!tip)} title="How to fill the screen">
          <Corners shrink={false} />
          <span className="icon-button__label">Full screen</span>
        </button>
        {tip && (
          <div className="fullscreen-help__tip" role="note">
            <p>
              <strong>To fill the screen:</strong> tap <strong>Share</strong> <span aria-hidden="true">⬆️</span>, then{' '}
              <strong>Add to Home Screen</strong>. Open the Games Hub from the new icon.
            </p>
            <button type="button" className="button button--light" onClick={() => setTip(false)}>
              Got it
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="icon-button"
      aria-label={full ? 'Exit full screen' : 'Full screen'}
      aria-pressed={full}
      onClick={() => (full ? leave() : enter())}
      title={full ? 'Leave full screen' : 'Fill the screen'}
    >
      <Corners shrink={full} />
      <span className="icon-button__label">{full ? 'Exit full screen' : 'Full screen'}</span>
    </button>
  );
}

/** Four corners pointing out (go full screen), or in (shrink back). */
function Corners({ shrink }: { shrink: boolean }) {
  const d = shrink
    ? 'M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5'
    : 'M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5';
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
