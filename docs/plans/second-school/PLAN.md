# Adding a second (very small) school

Plan only, written 25 Nov 2026. Nothing built yet. Stages are at the bottom; each later thread starts from its stage card.

## The short answer

The hub was made ready for more schools on 18 Oct 2026 (Maths focus F.2): every account has a `school_id` from its email
domain, every read checks `my_school()`, and lobbies, codes, boards, clans, seasons and Class Live stay inside a school.
An audit of all ~216 migrations since then (25 Nov) found **one small leak, no big ones**. What is missing is mostly
outside the code (Google, privacy sign-off), a few Douglas Park labels, an owner screen and some small-school polish.

Live database today: 1 school (Douglas Park, id 1, `douglaspark.school.nz`), 225 pupils, 19 teachers, 10 classes,
1 site owner, 1 school admin, 110 MB. The Supabase organisation is already on **Pro**.

## What already works for a second school

- **Sign-in:** the sign-up hook and profile trigger accept only an email domain in `school_domains` for an active school
  (`20261018002300_schools.sql`). The app sends no `hd` hint. Badge sign-in (`badge_sign_in`) needs the pupil's school to be active.
- **New school setup triggers:** adding a `schools` row gives it its own default settings row (`give_school_settings`,
  games start on) and its own "Everyone else" village (`give_school_village`).
- **Roles:** student, teacher (own classes), school admin (whole school: `profiles.school_admin`), site owner
  (`site_owners`: adds schools, sees counts only via `owner_schools()`).
- **Kept apart (checked):** profiles, every board and hall (`board_pupils`, `hall_of_fame`, trophies, Hard workers,
  clan scoreboards, Dragon Maths hall, Daily News), "who's here" lists, duels and invites (Archery, Dragon Maths, Clan duels,
  board invites), clan raids, Class Warp codes (lookup joins school), Class Live lobby (`classlive_my_school`, codes looked
  up per school), Showdown and Class Live rooms (class members/teachers only), all 10 realtime tables, the four game
  servers (another school's game code looks like a wrong code), the `season-crowns` cron job (loops per school),
  `clan_nightly` (loops per active school), school season (`hub_season(school)`, columns on `schools`).
- **Composite classes:** pupils pick their own year (`pupil-years`), the ladder is per pupil, so a Y1-8 class works.
- **Tests:** `schools.test.sql` (84 checks) and `clans_schools.test.sql` (51) already try school 2 reading school 1.

## What needs doing

### Not code (James)
1. **Agreement and privacy.** The school's principal and board approve it with their own copy of
   `docs/PRIVACY-SUMMARY.md`; set `schools.board_approved_on`. The summary promises "nothing is shared with other schools"
   and that a leaving school's data is deleted, so the delete function (stage S3) must exist before go-live.
2. **Google sign-in.** If the Google Cloud OAuth app is "Internal" to Douglas Park, switch it to **External, In production**.
   Basic scopes (email, profile) need no Google review. The new school's Workspace admin must mark the app as
   **trusted** (Admin console, API controls), or Google blocks their under-18 pupils.
3. **Their email domain** must be their own (not a shared provider domain), because the domain is what decides the school.
4. **First teacher:** they sign in once, then `make_school_admin('<email>')` is run in SQL (or from the owner screen, S3).

### Code gaps found by the audit
- **Leak (small):** `answer_totals` / `hub_answer_totals()` (`20261105000800`) has no `school_id`, so each school would see
  both schools' combined "questions answered" counts. Fix: add `school_id` to the key, fill it from profiles, filter by `my_school()`.
- **Untested:** cross-school checks for the space, card and power lobbies (`lobby()` relies on their row rules), `hall_of_fame`,
  `trophies_board`, `hub_answer_totals`, Class Live lobby and Showdown policies. Add them to `schools.test.sql`.
- **Game servers:** `multiplayer/handler.ts:344` (`maker &&`) and the card/power/space handlers (`theirs &&`) skip the school
  check when the other player's record is missing. Treat missing as "not found".
- **Names are unique across all schools** (`profiles.display_name`, plus lower-case index from `own_names`). Fine for a tiny
  school, but the "taken" answer for a typed name can hint a name exists elsewhere. Make that message neutral.
- **Douglas Park labels:** sign-in banner and text (`src/pages/SignIn.tsx:19,33`), top-bar banner (`src/components/Layout.tsx:17,49`),
  error text (`src/auth/signInErrors.ts:14` and its test), app name in `public/manifest.webmanifest`. Show the school's own
  name (already in `my_school_info()`) and a plain "Games Hub" look before sign-in.
- **No owner screen:** `owner_add_school`, `owner_add_school_domain`, `owner_set_school_active`, `owner_schools` have no UI,
  and there is **no delete-a-school function** yet.

### Small-school fit (5 to 25 pupils, one or two composite classes)
- **Fine as is:** Showdown boss health scales per pupil below 8; Four Corners items go to 2; Serpent and Mural have floors;
  a "clan" is one pupil's four heroes, so no minimum clan size; raids need only 2 or 3 classmates; boards show top 10 so
  a small school just sees everyone; bots exist for Archery, chess, checkers, 101, Bond Match, and practice clans for duels.
- **Will feel thin:** live classmate challenges (often nobody online), "My class" / "My year" board chips that equal
  "Whole school", medals that everyone gets, an empty Hall of fame early on, Showdown in 4 teams (1 or 2 pupils each).
- **Will feel stuck:** the Clan Quest village building cost is in gold from the whole village, so 5 pupils fill it slowly
  (a couple of weeks a level). Scale cost by active pupils.
- **Must be set on day one:** the school season date (`lord_season_start`, `clans_clock_from` on the school's default
  settings row) or Clan Quest has no countdown and no giant. Classes, and whether to use a default class.

### Cost and limits
Supabase Pro is already paid (about US$25 a month) and covers it: a school of 5 to 25 adds roughly 2 to 10% to today's
225 pupils. Realtime connections (500 on Pro) and function calls stay well under the limits. Sign-in rate limits are per
internet address, so the other school doesn't use up Douglas Park's. Disk 110 MB of 8 GB.

## Stages

Each stage is one PR, merged and live (pre-approved), except where marked.

| # | Stage | Size | Needs James |
|---|---|---|---|
| S1 | **Close the gaps:** `answer_totals` per school, game-server missing-record check, neutral "name taken", new cross-school tests (lobbies, halls, trophies, totals, Class Live, Showdown) | S | no |
| S2 | **School labels:** banner, name and sign-in text from the school (plain "Games Hub" look before sign-in, Douglas Park keeps its banner), manifest name | S | the new school's logo, if any |
| S3 | **Owner screen + delete a school:** owner-only page (list schools with counts, add school and domain, switch on/off, board-approved date, make school admin) and `owner_delete_school(id, typed name)` that removes every account and row of that school, tested on a scratch copy | M | yes before it is ever **run** (deletes data) |
| S4 | **Small-school polish:** hide board chips that equal Whole school, Clan village cost scaled by active pupils, Showdown hint to use class or 2 teams under 8, Admin tab "Getting started" checklist (season date, classes, badges) | M | no |
| S5 | **Opening day** (with James, after his non-code items): add the school, first teacher signs in, school admin, class, season date, badges; check from outside both ways on the live site (school 2 sees nothing of school 1 and back) | S | yes: domain, approval date, first teacher |
| S6 | **Optional later: play together.** An opt-in "partner school" link so lobby, Class Live and some boards can include both schools. Only if James picks it and both boards agree | L | yes |

S1 to S4 can go ahead before the school is ready; nothing changes for Douglas Park pupils except S4's board chips.

## Questions put to James (25 Nov 2026)
1. How their pupils sign in (own Google accounts recommended; Microsoft or badge-only would add a stage).
2. Play alone or alongside Douglas Park (recommended: separate now, opt-in sharing later = S6).

Answers go here when they come in.
