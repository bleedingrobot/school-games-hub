/**
 * Where the website finds Supabase. Both values are PUBLIC on purpose: they're built
 * into every copy of the website anyway. The database rules do the protecting.
 * Never put a "secret" or "service_role" key here.
 *
 * For local testing, a .env.local file can point these at the local Supabase copy.
 */
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://zqzhetlzvtptnkmeiumi.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY: string = 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_XF2d1vXZaULSdOExwlneAg_p1RCQqmu';

/** Only used as a hint so Google shows school accounts first. The real checks are on the server. */
export const SCHOOL_DOMAIN = 'douglaspark.school.nz';
