/**
 * If a page breaks while it draws, React would blank the whole site (just the red background). This catches it and
 * shows a kind message, a button to try again, and the error itself in small print, so a screenshot tells us what
 * went wrong. Games keep their progress on the server, so trying again carries on where the student was.
 * If the crash is a game file that a newer publish replaced, it reloads once by itself to get the new version.
 */
import { Component, type ReactNode } from 'react';
import { isChunkLoadError, isReloading, reloadForNewVersion, reloadFresh } from '../freshLoad';

interface State {
  error: Error | null;
  updating?: boolean;
}

export class CrashScreen extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)), updating: false };
  }

  componentDidCatch(error: unknown) {
    console.error('Page crashed:', error);
    if (isReloading() || (isChunkLoadError(error) && reloadForNewVersion())) this.setState({ updating: true });
  }

  render() {
    const { error, updating } = this.state;
    if (!error) return this.props.children;
    if (updating) {
      return (
        <section className="coming-soon crash" role="status">
          <h1>Getting the newest version…</h1>
        </section>
      );
    }
    const where = error.stack?.split('\n').slice(1, 4).map((l) => l.trim()).join('\n') ?? '';
    return (
      <section className="coming-soon crash" role="alert">
        <h1>Oops, something went wrong.</h1>
        <p>Nothing is lost. Press the button to carry on where you were.</p>
        <button type="button" className="button button--primary" onClick={reloadFresh}>
          Carry on
        </button>
        <details className="crash__details">
          <summary>For your teacher (what went wrong)</summary>
          <pre>
            {error.name}: {error.message}
            {where && `\n${where}`}
          </pre>
        </details>
      </section>
    );
  }
}
