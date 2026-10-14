# School Games Hub — original brief (from James, 15 Oct 2026)

Where this brief and docs/PLAN.md disagree, **PLAN.md wins**. It records the decisions made after this brief was reviewed.

## Your role
Act as my senior software engineer, technical architect, and development partner. Help me build a fun, polished, safe website where students at my primary school can play games together. I am a primary school teacher, not an experienced software developer. I use GitHub and VS Code, and I can follow instructions, run commands, and edit files with guidance, but I need you to make sensible technical decisions for me. Work directly in the project files. Inspect before changing, explain important decisions in plain English, and help me complete the project one stage at a time.

## 1. Vision
"School Games Hub" for Years 4–6 using school Google accounts. Sign in, create a fun avatar, play against AI opponents or other signed-in students, earn points, see leaderboards. A collection of games over time. The first release has two excellent, fully working games: **Chess** and **Checkers (English/American draughts)**. Adding more games later must not need a rebuild.

## 2. Technical constraints
Free to run, with no required paid subscriptions. Secure Google sign-in with school accounts. A database for profiles, results, rankings and achievements. Real-time multiplayer. AI opponents at different levels. Maintainable by a non-expert. No home server. Never claim a service is permanently free when it has quotas. No unnecessary services or frameworks.

## 3. Authentication
- Recognised, secure auth. Restrict to the school Workspace domain.
- No unauthenticated access to profiles, games or leaderboards.
- No student passwords. Store no Google passwords and no unnecessary personal information.
- Use a stable internal ID, not the display name.
- Handle sign-in, sign-out, expired sessions and auth errors properly.
- Prefer chosen display names and generated avatars over real names.
- Ask for the school domain only when it's needed. **Never invent it or hard-code a placeholder that could become a production security rule.**

## 4. Chess
- Full standard rules: all pieces, legal-move validation, check, checkmate, stalemate, draw conditions, castling, en passant and promotion.
- Turn indicator, highlighting of the selected piece and its legal moves, move history.
- New game and resign. Clear results. Responsive on laptops, tablets and Chromebooks.
- Use a reputable rules library.
- Bots at Very Easy (frequent mistakes), Easy (reasonable, misses things) and Medium (consistent). Use an open-source engine and no paid AI. Explain the difficulty settings and test that bot moves are legal, including special rules.
- Multiplayer:
  - create a game, join a game, invite by in-app invite or code
  - play live, seeing the opponent's avatar and name and whose turn it is
  - recover from disconnects and rejoin
  - finish, resign or abandon safely
- **The server validates moves and results.** Never trust the browser. No simultaneous moves, no out-of-turn moves, no illegal moves.

## 5. Checkers
- English/American 8×8 rules: diagonal moves, mandatory captures, multi-jumps, king promotion, kings moving both ways, valid game endings.
- Legal-move indicators, a move summary, and new game / resign / rematch.
- Bots at Very Easy, Easy and Medium.
- Single-player and real-time multiplayer, using the same system as chess.
- Use a well-tested rules implementation, or write thorough tests. Don't confuse it with international draughts.

## 6. Profiles and avatars
- Students choose a display name and build a personalised avatar they can change later.
- The profile shows games played, W/L/D, achievements and rankings.
- Avatars are simple, colourful, inclusive and age-appropriate: faces, hair or hats, colours, accessories, themes (creatures, robots, animals, space). Procedurally assembled and original, or open-source.
- No photo or image uploads.
- Prevent impersonation, inappropriate names, and names that reveal personal information. Students can change their name.

## 7. Points, achievements, leaderboards
- Games played and W/L/D, with separate stats for chess and checkers.
- Points/XP, levels or ranks, achievements and badges.
- Weekly and all-time boards, per-game boards, recent results and progress.
- Transparent scoring that rewards participation and improvement. No farming by starting and abandoning games.
- Elo-style ratings, explained simply for children.
- Bot games are kept separate from competitive rankings.
- Everything is calculated or verified on the backend.
- No emails or IDs on leaderboards. Boards must stay fair as more games and students are added.

## 8. Safety and privacy
- Only authorised school accounts get in, enforced in the backend and database, not just the UI.
- Secure database policies and server validation. Collect the minimum data.
- No ads, no tracking, no unnecessary analytics.
- No chat, no DMs, no free text in the first release. Controlled names and avatars.
- Emails are never exposed. Students can't access or modify other students' data. No unauthorised joining, no cheating, no score manipulation.
- No personal data in logs. Error messages are friendly and reveal nothing technical.
- Before launch: review school privacy requirements, Workspace policies, NZ privacy obligations and school approvals. Explain the security limits of the free services.

## 9. Design
- A polished, modern gaming hub for primary students, not a school portal.
- Bright and friendly, with clear navigation, big buttons and attractive game cards.
- Playful but restrained animation. Responsive, with accessible contrast and readable text, and keyboard-friendly where practical.
- Clear feedback for moves, wins and achievements.
- Dashboard: avatar and name, a prominent Play button, Chess and Checkers cards, the multiplayer lobby, bot difficulty choice, recent games, stats, a leaderboard link, achievements.
- It must be obvious how to start a game. No clutter.

## 10. Technical quality
- TypeScript and reusable components.
- Interface, game rules, auth, database access and multiplayer kept separate.
- Secrets handled safely: no privileged keys in the frontend and no secrets committed.
- Schema and migrations kept in the repo.
- Automated tests for game rules, scoring, auth restrictions and important backend operations.
- Error handling and logging with no student information in them.
- Reproducible local setup.
- A README for a non-expert. Simple architecture with no premature abstraction. Established libraries for the hard parts.

## 11. Stages
1. Inspect and plan
2. Foundation: app, styling, routing, dev environment, version control and deployment config; the dashboard and visual design with clearly labelled dev-only sample data
3. Authentication and profiles: Google sign-in, domain restriction, protected routes, secure database policies, profiles and avatars. A login *screen* is not finished authentication.
4. Chess vs bots
5. Checkers vs bots
6. Multiplayer: matchmaking, codes, trusted validation, reconnection
7. Progression: histories, verified results, stats, points, achievements, leaderboards
8. Deploy and school testing: production auth and database, a test with two separate accounts, and a student test checklist

The order can change if a dependency needs it; explain why.

## 12. How to work with me
- Be proactive. Inspect files before changing them. Make technical decisions yourself.
- Only ask about things I'm likely to know, like the school domain or the Google admin settings.
- For external services, give me one clear set of actions at a time: exactly where to click, what to enter, and what I should see.
- Never assume I've already configured a service.
- Never claim something works unless it's been tested; say what's untested.
- Run tests, builds and type checks after meaningful changes. Fix the problems you find.
- Keep the README and PLAN up to date, and keep changes small and understandable.
- Flag anything that affects privacy, security, cost or maintenance.
- **Never ask me to paste passwords, secret keys or credentials into the chat.** Use placeholders and guide me to enter them in the right place.
- Never deploy an insecure temporary workaround as if it were production-ready.
- If something can't be done reliably on the free tier, tell me before building it.

## 13. Definition of done (for a controlled school trial)
- School accounts can sign in, and unauthorised accounts are rejected by the backend.
- Avatars can be created and customised.
- Chess and checkers both work against all three bots.
- Two separate accounts can play chess, and checkers, against each other live.
- Results and leaderboards update correctly.
- Students can't modify each other's profiles, scores or results.
- It works on Chromebooks and tablets.
- Tests, builds and security checks pass.
- It's deployed on the agreed free services with no surprise paid dependency.
- There are clear maintenance and redeploy instructions.
