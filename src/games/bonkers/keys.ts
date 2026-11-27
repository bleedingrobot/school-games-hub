import { useEffect } from 'react';

/**
 * Enter or Space presses the screen's big button (James, 28 Nov 2026: "make sure enter or space bar progresses
 * through the turn"): Answer it!, Next fight!, Fight!, See what you got, Back home. Left alone while a question
 * pop-up is open (it has its own keys), and when a button or box has the focus (the key already works there).
 */
export function useEnterGoes(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const go = document.querySelector<HTMLButtonElement>('.bq-btn--big:not([disabled])');
      if (!go) return;
      e.preventDefault();
      go.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
