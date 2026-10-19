# School Games Hub: privacy summary

*For the principal and board of Douglas Park School. Checked against the code and the live database, 15 October 2026. Updated 20 October 2026 for the games, training and maths features added since (checked against the code and its database setup, not by looking inside the live database).*

School Games Hub (https://bleedingrobot.github.io/school-games-hub/) is a games website for Years 4–6, run by James: chess, checkers, a space board game, a card game, noughts and crosses with powers, four maths games and a basic facts practice area. Students sign in with their school Google account, pick a made-up player name, build a cartoon avatar, and play computer opponents or each other.

**What is stored, and why**

- **Our database:** a random ID; a player name from word lists (e.g. "Speedy Otter 27"); avatar choices; student or teacher; hidden or not; when the account was made. For each game: the players' random IDs, the moves, the result and the time. Points, badges and achievements. *Why:* profiles without real names, checking nobody cheats, and the points. No real names, emails, photos or free text. (Since F.2: which school the student is in, and which class and group, as a teacher-typed name like "Room 12" with no student's name in it. Class names are shown only to the students and teachers of that class, after a correct Class Warp code, and never on a leaderboard.)
- **Gem Keep (times tables, since 17 Oct 2026):** each level played (stars, waves reached, how many maths questions were asked and answered right), the best stars and Level Keys per level, and **learning data**: for each times-table fact (e.g. 7 × 8), how often it was asked and answered right, the average answer time, a mastery box (0–4) and the last two days it was answered quickly. Never the answers typed. *Why:* so progress follows the student between devices, the game asks the facts they need, and teachers can see which facts a student (or the class) finds hard. **Since 17 Oct 2026, space games add to the same times-table records** when Mission Control maths is on (the teacher can switch it off): each question asked in a space game and whether it was answered right, never the typed answer.
- **Maths Monsters, Dragon Maths and Clan Quest (since 18 Oct 2026):** each saves the student's own game on the server so it follows them between Chromebooks: for Maths Monsters the adventure (where they are on the map, their monsters, items and badges); for Dragon Maths their hero and each fight; for Clan Quest their clan, its four heroes (names picked from lists), their empire, which class village they are in and their weekly village vote. Their maths answers go into the same kind of learning record as Gem Keep, by topic (for Clan Quest, the *kind* of question and the year band, e.g. "Percent of (Year 5)"), never the typed answer. Dragon Maths' Daily News and Clan Quest's news and raid notes are lines written by the game (e.g. "Speedy Otter 27 beat a master"), never typed by a student. When the server turns down a save that doesn't add up, it keeps a short reason code (Maths Monsters lists these for the teacher). *Why:* so the game carries on where they left off, can't be faked, and asks the maths they need.
- **Facts training (since 18 Oct 2026):** for each practice answer: the fact (e.g. 6 × 7), **the number they typed**, whether it was right, how long it took, how long that student takes just to type, and the day. Also a short typing-speed check and how many sessions they've done. *Why:* to colour each fact on the student's own facts map by how quickly *they* know it, with their typing time taken off. Training's records are kept apart from the games and are not ranked.
- **The maths ladder (since 19 Oct 2026):** where each student is on the skill ladder, and where the warm-up started them (or that they skipped it). Not their warm-up answers.
- **101 and Power Clash with classmates:** like chess and checkers with a friend: the players' random IDs, the moves, the result and the times. For 101, each player's own view of the cards.
- **Maths focus results (live since 19 Oct 2026):** when a teacher sets a maths focus, for each student the focus is for, three running totals: how many questions they answered on the focus's skills while it ran, how many were right, and how many were right and quick. Not the questions, not the answers typed, not when each was answered. *Why:* so the teacher can see how the class did during a focus. Only that class's teachers can see it; the student cannot.
- **Supabase's sign-in records:** school email, name from Google, a link to the Google profile photo, the Google account number, last sign-in time, and each signed-in device's internet (IP) address and browser type. *Why:* Supabase needs these to run Google sign-in. The site shows only the part of the email before the @ (the student's real name), and only on the teacher page.
- **Supabase's logs:** each request's IP address, rough location (city) and browser, deleted after 1 day.
- **The student's browser:** their sign-in session and whether sound is on. Signing out clears the session. For Gem Keep, a copy of their own progress and anything not yet saved (so it works through a Wi-Fi drop).

**Where it is (Privacy Principle 12)**

The database and server code are in **Sydney, Australia**, run by Supabase (a US company) in Amazon data centres. The live logs show every request entering through Auckland and running in Sydney. The website files come from GitHub Pages (US), which stores no student data. Sign-in happens inside the school's own Google Workspace, as an "Internal" app only Douglas Park accounts can use. A cloud service that only stores data for us is usually not a "disclosure" (Privacy Act 2020, section 11), but the school stays responsible for its security (Principle 5). The school's privacy officer should confirm this is acceptable.

**Who can see what**

- **Students:** their own games and points, and other students' player names, avatars and badges (boards, lobby, opponents). Never emails or real names. Database rules stop them reading other students' games or changing anything except their own name and avatar. This was tested.
- **Teachers:** (since F.2, only the students in their own classes; a school admin sees the whole school; nobody sees another school) every player's name, avatar, games, points and last 10 results. They can give a new random name, hide, delete, give teacher access, pause games against friends and start a new season. Since 16 Oct 2026 they also see each student's real name (the part of their school email before the @) next to the player name, so they know who is who. Nothing else from the email or Google account. For Gem Keep they see each student's levels, stars and a 12 × 12 times-table grid (not tried / learning / secure / fluent), the class's 10 hardest facts, and they set Gem Keep's maths settings for everyone. Maths Monsters, Dragon Maths and Clan Quest each have a teacher panel too (Maths Monsters and Clan Quest show the hardest questions and each student's progress); and the Skill map shows where each student in their classes is on the maths ladder. Students never see anyone's maths: the leaderboards and game boards show stars, monsters collected, levels or fame, never maths.
- **James (account owner):** everything, through the Supabase and GitHub dashboards, including sign-in records and the 1-day logs.

**Deleting**

- **One student:** Teacher page → the student → **Delete** → type their player name. This removes their sign-in record (email, name, devices), profile, games, points and achievements. Opponents keep the shared game, with nothing pointing back. Logs expire within a day. There are no backups, so it can't be undone.
- **End of year:** delete leavers, then type `NEW SEASON`. That clears every finished game, point, rating and achievement, and all Gem Keep progress and times-table records, keeping accounts, names and avatars. It **keeps** Maths Monsters adventures, Dragon Maths heroes (they restart with their own 5-week seasons), Clan Quest clans (fame has its own season), the other maths topics' learning records, ladder places and Facts training records. Those go only when a student is deleted. Whether a new season should also clear them is a decision for the school.

**Deliberately not there:** ads, tracking, analytics, outside fonts, chat or messages of any kind, free typing, photo uploads. Computer opponents run on the student's own Chromebook.

**Honest limits of the free services**

- No uptime promise and no official support. If Supabase has a problem, the site stops until it's fixed (saved games are safe).
- It sleeps after a week unused (e.g. holidays). Waking it is one click and loses nothing.
- If a usage limit were passed (a class uses a small part of them), Supabase warns, then may slow or stop the site until the next month. No card is on file, so there can't be a bill.
- Free terms can change. James would tell the school before anything moved or cost money.
- Games against the computer happen on the student's device, so a determined student could fake one. They earn only small, capped points and never affect rankings.
- The code is public on GitHub. It contains no passwords, keys or student data.

**What the school needs to do**

1. Approve the site under the school's privacy policy, including storage in Australia.
2. Decide whether to tell parents (a short newsletter note is suggested: school accounts, made-up names, no chat).
3. Name a second person who can look after the site if James is away.
4. Agree the yearly routine: delete leavers, then start a new season.

Nothing more is needed from the Google Workspace admin: the app is "Internal" and students already sign in without extra approval.
