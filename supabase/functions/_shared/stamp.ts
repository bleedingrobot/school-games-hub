/**
 * Stamps (signatures) only the server can make: an HMAC-SHA256 of some text, as URL-safe
 * base64. The key is made from the server's own secret key and a purpose, so there's nothing
 * new to set up, and a stamp made for one purpose is no use for another.
 */
const encoder = new TextEncoder();

async function hmac(key: Uint8Array | string, text: string): Promise<Uint8Array> {
  const raw = typeof key === 'string' ? encoder.encode(key) : key;
  const imported = await crypto.subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(text)));
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns a function that stamps text for one purpose. Null stamps if there's no secret. */
export function stamper(secret: string, purpose: string): (text: string) => Promise<string | null> {
  let key: Promise<Uint8Array> | null = null;
  return async (text) => {
    if (!secret) return null;
    key ??= hmac(secret, `school-games-hub:${purpose}`);
    return base64Url(await hmac(await key, text));
  };
}
