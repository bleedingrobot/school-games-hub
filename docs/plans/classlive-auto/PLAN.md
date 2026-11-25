# Class Live games that start by themselves

**Status: LIVE 25 Nov 2026 NZ (PR #831, migration `20261125001700_classlive_auto`). The newer map games added the same day (migration `20261125001800_classlive_auto_more`).**

James asked (25 Nov 2026 NZ): "Can we get the server to start a class live game at set times and run it if there are enough players?" and "We'll need an admin page for all the settings."

## James's answers (question cards, 25 Nov 2026 NZ)

| Question | Answer |
|---|---|
| Which games start by themselves | Serpent Chain, Mystery Mural and Four Corners (they already work fully on pupils' iPads); then (James via the coordinator, 25 Nov 2026 NZ) Shark Bay, Ghost Tag, Colour Clash, Musical Thrones and Floor is Lava, which also run on the clock from pupils' devices. Star Web stays teacher-run: its shared sky needs a big screen. |
| Who gets the pop-up | The whole school (every pupil with Class Live on), like a lobby game. No year filter. |
| Not enough players at the start time | Call it off and say so on the iPads. |
| Big screen | No. Scheduled games are on pupils' iPads only; no teacher can open or run them. |

## How it works

1. **Times** (`classlive_times`, one row per time, school admins only through `classlive_times_list/save/remove`): days of the week, time (NZ), game (any Class Live game but Star Web), minutes (2, 3, 5, 10 or 15; never untimed, since nobody can end it), fewest players (2 to 40, default 6), how many minutes before the start the pop-up opens (1 to 15, default 3), the host name on the pop-up (default "Games Hub"), the Serpent level or the game's map or hall (or surprise), on/off.
2. **Opening** (`classlive_auto_open()`, pg_cron every minute): for each time that is on, on today's NZ weekday, inside its pop-up window, with no room yet for that time today, it makes a lobby room: no class and no teacher, the school, a free 4-digit code, the host, `schedule_id` + `slot` (NZ date, unique), `starts_at`. The session is written with `game: null` and `auto: { startsAt, min, level }`; pupils' devices play the music (`padMusic`). Every pupil of the school hears the new room (the lobby rooms rule) and gets "Games Hub is starting Serpent Chain. Join now?".
3. **The game is made on the first step** (`mutate` in `shared/classlive/server.ts`: `gameFor`), the same as a teacher's Open.
4. **Starting**: any step at or after `startsAt` (pupils' devices `look` every 2 s, and `look` now steps the room whenever something is due) starts it if `order.length >= min`, else ends it with `why: 'few'` (called off, no points). The iPad says "Not enough players joined this time."
5. **Running**: everything that a projector's `view` used to move on (time up, Mural guessing, Four Corners rounds) is moved on by pupils' `look` steps. Points as a lobby game (`classlive_finish` now pays rooms with no class).
6. **Tidying** (same cron): a scheduled room still in the lobby 2 minutes after its start, or still open 10 minutes after its end, is closed.

## Rules kept

- Rooms with no class: `class_id` and `teacher` may be null only when `schedule_id` is set. `classlive_open` (a teacher's Open) never closes them. Teacher steps refuse them (`row.teacher !== who`).
- At most 40 players (`MAX_PLAYERS`); the 41st gets "This room is full."
- Only school admins see and change the times (Admin, "Class Live times" tab).
