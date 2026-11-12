/** How recent things are, for the teacher's live lists. Its own small file so the home page's header doesn't bring the whole
 * class setup page with it (dashboard plan D7). */
export const LIVE_MS = 30_000;

/** "just now", "3 minutes ago", "2 hours ago", or the day. */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}
