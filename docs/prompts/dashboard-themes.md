> **Done (checked 21 Oct 2026):** the compact home page and three themes are on `main` (a893951). Kept as a record; don't run it again.

# Prompt: compact home page with three pupil themes (D.2–D.4b)

Paste everything below the line into a new Claude session in `~/projects/school-games-hub`.

---

You are making the **home page (dashboard) of James's School Games Hub** (games for his Year 4–6 class) more compact and better looking, and adding **three themes each pupil picks on their profile page**. Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks. Read `docs/GAME_DEVELOPMENT_GUIDE.md` first (branches, tests, going live).

## Background
- The full plan is `~/.claude/plans/games-hub-could-you-sequential-wreath.md`. Read it. This prompt covers steps D.2, D.3, D.4 and D.4b. D.1 (mock-ups) is done.
- The approved mock-up page is https://claude.ai/artifact/CBqrZQr9SK7YSuCLSDvKvo. Read it with the Artifact tool (`action: "read"`). Its source is also at `/tmp/claude-1000/-home-james/f64140e5-8d6e-480f-9f85-0ed3d4ff164d/scratchpad/home-page-looks.html` if that file still exists. The layout, sizes and the three looks' `--h-*` colour/font/shadow tokens come from there. Match it closely.
- James's choices (20 Oct 2026):
  - Game cards stay as cards that keep their own bot-level buttons, about half today's height, 3 across on a Chromebook.
  - Bottom boxes are shrunk and tucked. Recent games shows the last 3. Achievements shows the count plus the next 3. The My stats tables move to the profile page, and the home page links to them. Maths focus and maths path become one "My maths" box with the path folded away.
  - All three looks become **themes**: **Tidy school** (`tidy`, the default), **Game menu** (`menu`) and **Soft and bright** (`soft`). Each pupil picks one in the avatar section of their profile.

## Rules
- Work on a new branch `dashboard` in a worktree at `~/projects/school-games-hub-dashboard`, made from an up-to-date `origin/main` (`git fetch` first; local `main` may be behind). **Never commit to `main`.**
- **No database or server changes.** The home page keeps its one request (`fetchMyHomePage`). If something seems to need a migration, stop and ask James.
- Merging to `main` and pushing puts it live. **Only do that if James says so, in words, in this session.**
- Kids use slow school Chromebooks. Add no big images, no new libraries and no heavy effects. Buttons stay at least 40px tall. Keyboard focus must stay clearly visible in every theme.
- Never write an expression-bodied `useEffect` that returns a DOM call's result. That caused the red-screen crash in October.

## Steps
1. **Layout (D.2 and D.3).** Rebuild the home page to the mock-up's layout in `src/pages/Dashboard.tsx`, `src/components/GameCard.tsx`, `BotLevelPicker.tsx`, `MathsFocusCard.tsx` / `MathsPathCard.tsx` (merge them into one "My maths" box or wrap them in one), and the dashboard part of `src/styles.css`. Move `StatsTable` and `SpaceStatsLine` to `src/pages/Profile.tsx` as a "My stats" section. Reuse `LevelBar`, `AchievementList` and `pickAchievements` from `src/components/Progress.tsx`. Keep every existing link and label that tests or pupils rely on, unless the plan moves it. Moving "You moved up!" and the placement offer into the folded path would hide them, so they must still show open when they apply. Teachers see the same page minus the pupil-only parts, as now.
2. **Theme tokens.** Put each theme's tokens in styles.css under `[data-hub-theme="tidy" | "menu" | "soft"]`, and write the layout's CSS only against those tokens, so building the layout once serves all three themes. Copy the Soft theme's card rules from the mock-up (white card, colour band, coloured level button). Check text and buttons are readable (contrast at least 4.5:1) in each theme.
3. **Saving the theme (D.4b).** Save it as one more short code inside the avatar data: `{"theme":"menu"}`. The live `is_valid_avatar` check already allows that, so no migration is needed. Check this on a throw-away database copy (`scripts/scratch-db.sh`) before relying on it. `save_my_avatar` replaces the whole avatar, and `normaliseAvatar` (in `src/avatar/avatarParts.ts`) drops unknown keys. So add `themeOf(avatar)` (unknown or missing → `tidy`) beside `normaliseAvatar`, and make sure **saving the avatar keeps the theme and saving the theme keeps the avatar**.
4. **Picker.** Add a "My theme" row of three small preview tiles to the avatar panel on the profile page. Tapping one changes the page straight away, and a Save button stores it, with the same status line as Save avatar ("Saved!"). Leaving without saving goes back to the saved theme.
5. **Applying.** In `src/components/Layout.tsx`, set `data-hub-theme` from the signed-in profile. **Games keep their own look:** check which routes are game screens (they share this Layout) and make sure the theme doesn't change them. Scope it to the hub pages (home, profile, lobby, leaderboard, training, warp) and leave teacher pages on `tidy`. Signed-out pages use `tidy`.
6. **Tests and checks (D.4).** Update the tests that look for moved things: `src/App.test.tsx` (My stats region, "85 points to level 4", recent games, "Play a friend") and `src/pages/DashboardHome.test.tsx` (recent list now 3 long), plus the maths card tests. Add tests for the following: the theme is kept when the avatar is saved and vice versa; an unknown theme falls back to `tidy`; the picker changes `data-hub-theme`; the stats tables now show on the profile page. Run `npm run check:quick`, then `npm run check`. Then look at it running (`npm run dev`) in all three themes at 1366px, 768px and 375px. There should be no sideways scrolling, and all 10 game cards should take about 1½ screens on a Chromebook. Bond Match (branch `bond-match`) will add an 11th card, so make sure the grid takes it.
7. **Hand over (D.5).** Commit on `dashboard` and push the branch (not `main`). Publish a preview test page James can try, with a theme switcher, built from the real components and fake data. `src/pages/homePageFake.ts` and the existing `*:preview` / `marble:single` build scripts show how. Tell James in plain words what changed, what to try, and that it is not live. Update the memory note `dashboard-tidy.md`. **Stop.** Go-live is only on James's word.

## Undo
Nothing is live until the merge. After a merge, revert the merge commit and push. Saved theme codes in avatars are harmless: the old site ignores them.
