# School Games Hub: privacy summary

*For the principal and board of Douglas Park School. Checked against the code and the live database, 15 October 2026.*

School Games Hub (https://bleedingrobot.github.io/school-games-hub/) is a chess and checkers website for Years 4–6, run by James. Students sign in with their school Google account, pick a made-up player name, build a cartoon avatar, and play computer opponents or each other.

**What is stored, and why**

- **Our database:** a random ID; a player name from word lists (e.g. "Speedy Otter 27"); avatar choices; student or teacher; hidden or not; when the account was made. For each game: the players' random IDs, the moves, the result and the time. Points, badges and achievements. *Why:* profiles without real names, checking nobody cheats, and the points. No real names, emails, classes, photos or free text.
- **Supabase's sign-in records:** school email, name from Google, a link to the Google profile photo, the Google account number, last sign-in time, and each signed-in device's internet (IP) address and browser type. *Why:* Supabase needs these to run Google sign-in. The site shows only the part of the email before the @ (the student's real name), and only on the teacher page.
- **Supabase's logs:** each request's IP address, rough location (city) and browser, deleted after 1 day.
- **The student's browser:** their sign-in session and whether sound is on. Signing out clears the session.

**Where it is (Privacy Principle 12)**

The database and server code are in **Sydney, Australia**, run by Supabase (a US company) in Amazon data centres. The live logs show every request entering through Auckland and running in Sydney. The website files come from GitHub Pages (US), which stores no student data. Sign-in happens inside the school's own Google Workspace, as an "Internal" app only Douglas Park accounts can use. A cloud service that only stores data for us is usually not a "disclosure" (Privacy Act 2020, section 11), but the school stays responsible for its security (Principle 5). The school's privacy officer should confirm this is acceptable.

**Who can see what**

- **Students:** their own games and points, and other students' player names, avatars and badges (boards, lobby, opponents). Never emails or real names. Database rules stop them reading other students' games or changing anything except their own name and avatar. This was tested.
- **Teachers:** every player's name, avatar, games, points and last 10 results. They can give a new random name, hide, delete, give teacher access, pause games against friends and start a new season. Since 16 Oct 2026 they also see each student's real name (the part of their school email before the @) next to the player name, so they know who is who. Nothing else from the email or Google account.
- **James (account owner):** everything, through the Supabase and GitHub dashboards, including sign-in records and the 1-day logs.

**Deleting**

- **One student:** Teacher page → the student → **Delete** → type their player name. This removes their sign-in record (email, name, devices), profile, games, points and achievements. Opponents keep the shared game, with nothing pointing back. Logs expire within a day. There are no backups, so it can't be undone.
- **End of year:** delete leavers, then type `NEW SEASON`. That clears every finished game, point, rating and achievement, keeping accounts, names and avatars.

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
