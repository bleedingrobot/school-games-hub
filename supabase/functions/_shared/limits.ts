/**
 * Counts requests per student in this server's memory. A soft limit: each server copy counts
 * separately. (The same as the one in multiplayer/handler.ts, which is left as it is so the
 * live multiplayer function doesn't change.)
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private now: () => number) {}
  /** Records a request and says whether it's within `limit` per minute. */
  allow(key: string, limit: number): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.hits.clear();
    return true;
  }
}
