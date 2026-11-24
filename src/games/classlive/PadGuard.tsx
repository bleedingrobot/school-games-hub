/**
 * If a pupil's game pad breaks while it draws (two pupils saw the crash screen at the end of a Mystery Mural, 25 Nov
 * 2026 NZ), this draws it again a moment later instead of the whole page's crash screen: the game lives on the server,
 * so a fresh pad carries on where the pupil was. After three tries it lets the page's crash screen show the error.
 */
import { Component, type ReactNode } from 'react';

const TRIES = 3;

export class PadGuard extends Component<{ children: ReactNode }, { broken: boolean; tries: number }> {
  state = { broken: false, tries: 0 };
  private timer: number | undefined;

  static getDerivedStateFromError() {
    return { broken: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Class Live pad crashed:', error);
    if (this.state.tries >= TRIES) throw error;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.setState((s) => ({ broken: false, tries: s.tries + 1 })), 800);
  }

  componentWillUnmount() {
    window.clearTimeout(this.timer);
  }

  render() {
    if (!this.state.broken) return this.props.children;
    return <div className="cl-c-center"><p className="cl-c-say" role="status">One moment…</p></div>;
  }
}
