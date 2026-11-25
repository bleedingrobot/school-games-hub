Building or changing a game? Read [docs/game-guide/README.md](docs/game-guide/README.md) first: the rules, the start-to-live checklist, and which part to read next (branches, migration numbers, shared files, maths questions, art and voice, testing and going live).

Merging to main (many threads merge at once, and every red "Test and publish" emails James):
- If your PR changes shared code (types, `src/maths/`, shared components, `shared/`) or a migration, update it from main right before merging and merge only once its checks are green again. Two PRs that each pass can still break the build together.
- After merging, check that your "Test and publish" run on main went green before saying it's live. Flaky tests and Supabase hiccups are retried automatically (vitest `retry` on CI, retries in `scripts/apply-live-migrations.sh` and the function deploy), so a red run is a real problem: fix it first, before anything else merges.
- Never fix a flaky test by raising the retry count; make the test wait properly (see docs/TESTING.md).
