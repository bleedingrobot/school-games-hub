/**
 * Loads the 3D viewer only when a Forge screen needs it, so the rest of Star Trader never downloads three.js. Until the
 * viewer folder exists (or if it fails to load) this gives null and the Forge shows a flat picture instead.
 */
import type { CreateViewer } from './viewer/types';

const found = import.meta.glob('./viewer/index.ts');

export async function loadViewer(): Promise<CreateViewer | null> {
  const load = found['./viewer/index.ts'];
  if (!load) return null;
  try {
    const m = (await load()) as { createSystemViewer?: CreateViewer };
    return m.createSystemViewer ?? null;
  } catch {
    return null;
  }
}
