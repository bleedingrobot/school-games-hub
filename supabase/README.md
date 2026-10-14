# Supabase (sign-in, database, server checks)

- `migrations/` — the database setup, applied in order. Never edit one that's already been
  pushed to the live project; add a new file instead.
- `tests/database/` — automatic checks of the database rules (pgTAP).
- `functions/` — server functions. Edit `handler.ts`, then run `npm run build:functions` to
  rebuild `index.ts`, the single file that's deployed. Run them locally with
  `npm run functions:serve` (with the local copy running).
- `config.toml` — settings for the local test copy only. The live project's settings are
  changed in the Supabase dashboard.

Local test copy (needs Docker): `npx supabase start`, then `npm run test:db`.
Stop it with `npx supabase stop`.
