/** The preview's server: the real `circuit` handler on a pretend database, all in this page. It never calls the live site. */
import { memoryServices, type MemoryOptions } from '../../../shared/circuit/memoryServices';
import { makeHandler } from '../../../supabase/functions/circuit/handler';
import { fromPost, type CircuitBackend } from './backend';

/** The real handler on a pretend database, all in this page (the preview and tests). */
export function pretendCircuit(opts: MemoryOptions = {}): CircuitBackend & { db: ReturnType<typeof memoryServices> } {
  const db = memoryServices(opts);
  const handler = makeHandler(db);
  const backend = fromPost(async (body) => {
    const r = await handler(new Request('http://preview/circuit', {
      method: 'POST', headers: { Authorization: 'Bearer pupil:preview', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  });
  return { ...backend, db };
}
