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
    Vary: 'Origin',
  };
}

/** The sign-in token from the request, if there is one. */
export function bearerToken(request: Request): string | null {
  return request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1] ?? null;
}
