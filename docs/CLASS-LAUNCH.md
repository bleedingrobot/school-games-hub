# Class launch checklist

For running a whole-class lesson (up to about 30 students) on School Games Hub: bots, friends, points, leaderboards, the teacher view, the space game (Wormholes & Black Holes) and the card game 101.
Live site: https://bleedingrobot.github.io/school-games-hub/

## The day before

- [ ] **Wake the database.** The free Supabase project goes to sleep after a week with nobody using it (holidays, a quiet week). Open the live site and sign in. If sign-in fails or says *"We couldn't load your profile"*, log in at supabase.com, open the project and click **Restore project**. It takes a few minutes and nothing is lost. Then try again.
- [ ] **Sign in on a school Chromebook** with your own school account.
- [ ] **Play a quick bot game:** checkers against **Very Easy**, then **Resign**. The result card should say **✓ Saved to your games**, and the game should appear under **Recent games** on the dashboard.
- [ ] **Play a quick friend game with yourself:** open the site on a second device (or ask a colleague). Press **Start game** on one, type the code on the other, make a move on each, then resign. Both screens should show the result.
- [ ] **If you'll use the space game:** **Play the bots → Wormholes & Black Holes**, pick **Asteroid Belt** and 1 bot, and play to the end (about 2 minutes). The podium should say **Saved!**
- [ ] **If you'll use 101:** **Play the bots → 101**, pick 1 bot and **Quick: to 50**, and play to the end (about 5 minutes). The podium should say **Saved! Points added.**
- [ ] **Check the friends switch:** open the **Teacher** page. It should say **Games against friends are on.** If it says paused, press **Switch games against friends back on**. It covers space games and 101 too. Decide on **Emoji reactions in space games** (off to start).
- [ ] Check the students know their school Google login, and the Chromebooks are charged.
- [ ] Print one **problem slip** per student (bottom of this page).

## A 30–45 minute lesson

1. **Sign in (5 min).** Everyone taps **Sign in with Google** and picks their school account. New students then pick a player name and build an avatar. Stagger it by table if you can: a whole class signing in during the same minute can briefly hit Supabase's sign-in limit (see below).
2. **Warm up against a bot (10 min).** Chess or checkers against **Very Easy** or **Easy**. Remind them: games only count once you've each made 10 moves, and leaving early earns nothing.
3. **Play a friend (15–20 min).** In pairs: one taps **Play a friend → Start game**, reads out the 5-character code, and the partner types it in under **Join a game**. (Or choose **Anyone in the lobby** and let others tap **Join**.) Each student has one waiting game at a time.
4. **Rematch.** At the end, both press **Rematch**: the colours swap.
5. **Points and boards (5 min).** Look at the dashboard (points, level, badges) and the **Leaderboard**. The **How points work** page explains it all in student words. Boards need 3 games this week (or 5 games against friends for "All time"), so not everyone will be on them in the first lesson.
6. **Sign out** (tap their avatar, then **Sign out**) if Chromebooks are shared.

### A space game lesson instead (30–45 min)

Wormholes & Black Holes is a dice race, so it suits a younger group, a quick finish to the week, or students who don't play chess or checkers yet. Winning is luck, so it only gives taking-part points and never touches the leaderboards.

1. **Sign in (5 min)** as above.
2. **How to play (5 min).** Everyone opens **Play the bots → Wormholes & Black Holes → How to play**. It has a picture and one line for every square and item. Pick **Classic** mode for a gentler first game (just wormholes and black holes). Short on Chromebooks? **Who's playing → Pass-and-play** lets 2–4 students share one (just for fun: not saved, no points).
3. **Against the bots (10 min).** **Asteroid Belt** with 1–3 bots takes 2–4 minutes. Landing on stars and other squares shows a space fact, collected on each student's **Star chart**.
4. **With classmates (15–20 min).** Groups of 2–4: one taps **Play a friend → Start a game → Wormholes & Black Holes**, picks a board, and reads out the code. The others type it in. The host can fill empty seats with bots, then presses **Launch**. For the whole class on the same board, write a galaxy code on the board (e.g. `Comet-Kiwi-48`) or use **Galaxy of the day**.
5. **Rematch** at the end starts a new waiting game with the same board.

### A 101 lesson instead (30–45 min)

101 is a card game with real maths in it: adding up a hand, spotting pairs, and the 3s that cancel your highest card. It's about remembering cards and choosing when to knock, so it suits any group. Points go up like chess and checkers, but it never touches badges or leaderboards.

1. **Sign in (5 min)** as above.
2. **How to play (5 min).** Everyone opens **Play the bots → 101 → How to play**. Go through the scoring examples together: they're the maths of the game.
3. **Against the bots (10–15 min).** **Quick: to 50** with 1 or 2 Easy bots. The scoring show at the end of each round writes out the working ("The 3 cancels the Queen: 10 → 0"). Ask students to check it.
4. **With classmates (15–20 min).** Groups of 2–4: one taps **Play a friend → Start a game → 101**, picks the number of players and **Quick: to 50**, and reads out the code. The cards are dealt as soon as everyone's joined (or the host presses **Start now**). A Quick game with classmates takes about 10–15 minutes.
5. **Rematch** at the end starts a new waiting game the same size.

## What to watch for

- Students stuck at sign-in. Write down the exact words (see the table below).
- Pairs who can't find each other's game: check the code is typed exactly (case and spaces don't matter).
- Players who walk away: after 2 minutes, the partner gets a **Claim the win** button. Walking away counts as a loss for the one who left.
- A player name being used to tease: **Teacher** page → the student → **New name**.
- In 101 with classmates, each turn has 60 seconds; then it's skipped, and 3 skips in a row puts a student out (no points). Nobody can see anyone else's face-down cards, even by reloading: the peek happens once.
- In space games, each turn has 30 seconds (15 for a choice). A student who misses 3 turns in a row goes on **autopilot**, so the game carries on for everyone. They can tap **Take the controls**, but that game no longer earns them points.
- A student who needs a break from friend games: **Teacher** page → the student → **Hide**. They can still play bots.

## If something goes wrong in class

- **Friend games causing trouble?** **Teacher** page → **Pause games against friends**. Everyone's lobby says *"Your teacher has paused games against friends for now."* Games already going can still be resigned or claimed. Bot games carry on. Press **Switch games against friends back on** to undo.
- **Can't open the Teacher page?** In supabase.com: **SQL Editor**, paste `update public.app_settings set multiplayer_enabled = false where id;` and click **Run** (`true` switches it back on).
- **Reloading the page is always safe.** Games against friends carry on where they were, and so do games after a Chromebook lid is closed and opened (unfinished games are at the top of the dashboard with **Carry on**).
- **Lots of students see errors at once:** it's probably Supabase or the school Wi-Fi. Check status.supabase.com. Switch everyone to bot games (they keep working while the internet is patchy, and save at the end).

### What the error words mean

| The student sees | What it means | What to do |
|---|---|---|
| *access_not_configured* (on Google's page) | The school's Google admin hasn't allowed the app for that account | Note the student, tell the Google admin |
| *That isn't a Douglas Park school account* | They picked a personal Google account | Sign in again with the school account |
| *Sign-in was cancelled* | They closed the Google window | Press the button again |
| *Something went wrong signing in* / *Sign-in isn't working right now* | Google or Supabase hiccup, or too many sign-ins from the school at once | Wait a minute, try again |
| *We couldn't load your profile* | The database is asleep or down | Wake it (see "The day before") |
| *You were signed out. Please sign in again.* / *Please sign in again.* | Their session ran out or they were deleted | Sign in again |
| *We couldn't reach the server…* | The Wi-Fi dropped (the site already tried twice) | Check Wi-Fi, try again |
| *We couldn't save this game* (with **Try again**) | The save didn't get through | Press **Try again**. Saving twice is safe |
| *That's a lot of games today!* | 300 bot games in a day: a script, not a person | Talk to the student |
| *We couldn't find a game with that code* | Mistyped, already started, cancelled, or waited over 10 minutes | Make a new game |
| *Someone else has already joined that game* | Two people tried to join one game | Make a new game |
| *That's your own game!* | They typed their own code | Give the code to a friend |
| *It's not your turn yet* / *The game changed just then* | A double tap or a slow screen | Nothing: the board catches up |
| *Slow down a little!* | Over 60 taps a minute | Wait a minute |
| *Your teacher has paused games against friends* | The switch is off | Switch it on if that's not what you wanted |
| *Playing friends isn't available for you right now* | That student is hidden | Show them again on the Teacher page |
| *📡 Live updates have dropped* | The live connection is down | Nothing: the page checks every few seconds |
| *😴 … seems to be away* | Their partner closed the page or lost Wi-Fi | Wait, or claim the win after 2 minutes |
| *You need at least 2 players to launch. Share the code!* | Space game: the host is alone in the waiting room | Share the code, or add bots |
| *That game is full, or it has already launched* | Space game: 4 rockets already, or it started | Make a new game |
| *That game stopped waiting* / *The host hasn't launched yet* | Space game: the waiting room timed out, or it's not started | Make a new game / wait for the host |
| *Autopilot is flying your rocket* | They missed 3 turns in a row | Tap **Take the controls** (that game won't earn points) |
| *Wait a few seconds before sending another* / *That's all the reactions for this game* | Space game emoji: one every 5 seconds, 20 a game | Nothing |
| *You need at least 2 players to start. Share the code!* | 101: the host is alone in the waiting room | Share the code |
| *That game is full, or it has already started* | 101: every seat is taken, or the cards are dealt | Make a new game |
| *You're out of this game.* | 101: they pressed Leave, or missed 3 turns in a row | Start a new game; that one earns nothing |
| *There's still time on the clock.* | 101: a page asked to skip a turn a moment too early | Nothing: it sorts itself out |
| *Reactions are switched off* | The Teacher page switch is off | Switch it on if you want them |

## How students report problems (no typing, nothing personal)

- The site has no chat and no typing, so problems go on **paper slips**, not in the app.
- Students tick boxes and draw a face. They don't write their real name. They can copy their **player name** from the screen (e.g. "Zippy Meerkat 79") if they like.
- For anything odd, they put a hand up and show you. Note the **time** and the **player name**.

## Looking up a problem afterwards

With a **player name** and a rough **time**:

1. **Quick look:** **Teacher** page → **Find a player** → type the name → tap them. It shows their last 10 games, with results and how each ended.
2. **Full look:** in supabase.com, open **SQL Editor**, paste this, change the name and time, and click **Run**. It only reads. It lists that player's games within an hour either side.

```sql
-- Change the name and the time (NZ time, 24-hour), then click Run. It only reads.
with asked as (
  select 'Speedy Otter 27'::text as player_name,
         ('2026-10-20 13:45'::timestamp at time zone 'Pacific/Auckland') as around
),
who as (select p.id from public.profiles p, asked where p.display_name = asked.player_name)
select to_char(g.finished_at at time zone 'Pacific/Auckland', 'Dy DD Mon HH24:MI') as nz_time,
       'bot' as kind, g.game, g.bot_level as against, g.result, g.reason, g.player_moves as their_moves,
       g.counts_for_points as counted, null::text as status
from public.bot_games g, who, asked
where g.player = who.id and g.finished_at between asked.around - interval '1 hour' and asked.around + interval '1 hour'
union all
select to_char(coalesce(m.finished_at, m.created_at) at time zone 'Pacific/Auckland', 'Dy DD Mon HH24:MI'),
       'friend', m.game, coalesce(o.display_name, 'nobody yet / deleted'),
       case when m.status <> 'finished' then null when m.winner is null then 'drawn'
            when (m.winner = 'first') = (m.first_player = who.id) then 'won' else 'lost' end,
       m.reason, cardinality(m.moves), m.counts_for_points, m.status
from public.mp_games m
cross join who cross join asked
left join public.profiles o on o.id = case when m.first_player = who.id then m.second_player else m.first_player end
where who.id in (m.first_player, m.second_player, m.created_by)
  and coalesce(m.finished_at, m.created_at) between asked.around - interval '1 hour' and asked.around + interval '1 hour'
union all
select to_char(coalesce(s.finished_at, s.created_at) at time zone 'Pacific/Auckland', 'Dy DD Mon HH24:MI'),
       'classmates', 'space', s.rockets || ' rockets',
       case when s.status = 'finished' then 'place ' || s.places[array_position(array[s.seat1, s.seat2, s.seat3, s.seat4], who.id)] end,
       s.ending, null, s.counts[array_position(array[s.seat1, s.seat2, s.seat3, s.seat4], who.id)], s.status
from public.space_games s, who, asked
where who.id in (s.seat1, s.seat2, s.seat3, s.seat4, s.host)
  and coalesce(s.finished_at, s.created_at) between asked.around - interval '1 hour' and asked.around + interval '1 hour'
union all
select to_char(coalesce(c.finished_at, c.created_at) at time zone 'Pacific/Auckland', 'Dy DD Mon HH24:MI'),
       'classmates', '101', num_nonnulls(c.seat1, c.seat2, c.seat3, c.seat4) || ' players',
       case when c.status = 'finished' then
         case when c.places[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], who.id)] = 0 then 'out'
              else 'place ' || c.places[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], who.id)] end end,
       c.ending, null, c.counts[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], who.id)], c.status
from public.card_games c, who, asked
where who.id in (c.seat1, c.seat2, c.seat3, c.seat4, c.host)
  and coalesce(c.finished_at, c.created_at) between asked.around - interval '1 hour' and asked.around + interval '1 hour'
order by 1;
```

How to read it: `reason` says how each game ended (`checkmate`, `resigned`, `abandoned` = left or walked away, `agreed-draw`...). `counted` is false for games that were too short or abandoned (they earn nothing). A friend game with `status` = `playing` is still going. Space games say `place 1`, `place 2`... and end `docked` (someone reached the station), `mission-clock` (out of fuel) or `abandoned` (everyone left). 101 games with classmates say `place 1`, `place 2`... or `out` (they left or missed 3 turns), and end `finished` or `abandoned` (nobody played for 10 minutes); 101 bot games show as `bot` games with `game` = `101`. If the student changed their name since, use **Find a player** on the Teacher page to see their new one (a teacher's **New name** shows the new name straight away).

Server problems are in Supabase under **Edge Functions → (function) → Logs**, kept for one day. They never contain names, only what went wrong.

## The sign-in limit for a whole class

Supabase allows about 150 sign-ins and session refreshes every 5 minutes from one internet address, in bursts of up to 30. The whole school shares one address, so 30 students signing in during the same minute, plus reloads, can get close. If students see *Something went wrong signing in*, wait a minute and try again. The limit can be raised in Supabase (**Authentication → Rate Limits → Token refreshes**); see the README.

---

**Problem slip** *(cut out, one per student)*

Player name (from the screen, optional): ______________________

Which part? ☐ Signing in  ☐ Name or avatar  ☐ Checkers  ☐ Chess  ☐ Playing a friend  ☐ Space game  ☐ 101  ☐ Points or leaderboard

What happened? ☐ I got stuck  ☐ A piece wouldn't move  ☐ The bot did something weird  ☐ My friend's moves didn't show
☐ It said it couldn't save  ☐ Something looked broken  ☐ My points looked wrong  ☐ Too hard  ☐ Too easy

How was it?  😀  🙂  😐  🙁  *(circle one)*  Time: ______
