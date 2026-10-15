/** Websites allowed to call the server functions from a browser. */
const ALLOWED_ORIGINS = [
  'https://bleedingrobot.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    // Browsers ask "may I?" (a preflight) before each request. Remembering the answer for
    // 2 hours (Chrome's longest) halves the number of function calls during a game.
    'Access-Control-Max-Age': '7200',
    Vary: 'Origin',
  };
}

/** The sign-in token from the request, if there is one. */
export function bearerToken(request: Request): string | null {
  return request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1] ?? null;
}

/** The biggest request either function accepts. A 1,000-move game is about 15 KB. */
export const MAX_BODY_BYTES = 64 * 1024;

/** Reads a JSON request body. Null if it's missing, unreadable or bigger than MAX_BODY_BYTES. */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return null;
  try {
    const text = await request.text();
    return text.length > MAX_BODY_BYTES ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}
