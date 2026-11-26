# Class Live on Cloudflare: Ghost Tag pilot

**Status (26 Nov 2026 NZ):** stage 1 built (this PR). Live once James adds the Cloudflare secrets and the publish deploys the Worker.

**Why:** on 26 Nov 2026 the database crashed during Ghost Tag: ~75 spot saves a second from one class (memory note
`db-crash-26nov`, scaling plan https://claude.ai/artifact/Bdgkc4FdtP4AEziaFBjAK9). Spots don't need a database.

**Who:** only James's teacher login (`EDGE_TEACHERS` in `shared/classlive/edge.ts`) and only Ghost Tag. Every other class
and game stays on the database, with the one-live-game lock (PR #891).

## How stage 1 works

- `cloudflare/classlive-edge/` is a Worker with one Durable Object per room (`GhostRoom`, location hint `oc`). The rules
  for spots are `EdgeRoom` in `shared/classlive/edge.ts` (speed limit and teleports as `classlive_move`; what each pupil
  sees as `classlive_ghost_move`).
- The `classlive` server function sets `session.edge` when James opens Ghost Tag. For such a room it:
  - sends the room an `EdgeSync` after every save (who is a ghost, invisible, frozen, lit; teleports; who it moved);
  - reads spots from the room when it checks for catches (`roomSpots`), not from `classlive_spots`;
  - gives devices a signed ticket (`action: 'edge'`), so the room trusts Supabase's sign-in without calling Supabase.
- Devices (`src/games/classlive/edgeLink.ts`): pads send their spot every 0.1 s (only when moved; once a second when
  still); the room sends every device its frame every 0.1 s. Questions, answers, catches, points and trophies are
  unchanged (server function + database). The projector's 0.5 s `view` tick is the database's only steady load.
- Deploy: the "edge" job in `.github/workflows/deploy.yml`. It needs repo secrets `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`; it makes the shared secret from `SUPABASE_ACCESS_TOKEN` and sets it on both sides, with the
  Worker's address (`CLASSLIVE_EDGE_URL`, `CLASSLIVE_EDGE_SECRET` function secrets). If the Supabase token is ever
  changed, run "Test and publish" by hand so both sides get the new secret.
- Cost (Workers Paid, US$5/month): incoming WebSocket messages count 20 to 1, so a class of 28 at 10 a second is about
  14 requests a second, ~50k an hour of play; 1M a month are included. The object stays awake while sockets are open.
- Turn it off: empty `EDGE_TEACHERS` (or unset the two function secrets). Rooms already open keep `edge` until they end.

## Next stages (not built)

2. Watch James's first games (Cloudflare dashboard, Supabase load). If good, add other moving games (Shark Bay, Four
   Corners, Glitches, Floor is Lava, Colour Clash) and other teachers.
3. Move the whole session (the clock, catches, the `view` tick) into the room, writing only joins, scores and trophies
   to Supabase; then the one-live-game lock can be loosened.
