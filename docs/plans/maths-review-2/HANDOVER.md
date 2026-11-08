# Maths review 2 fix plan: handover (9 Nov 2026, NZ)

The first account stopped here at about 97% of its weekly use. This note tells the next session where things are.

**Tracker:** the fix plan page https://claude.ai/artifact/XQDGyC5rytsfNV2dAUi8Rd. Status is kept in its database, collection `status`, one doc per card (S1 to S36). Each doc has `state` (todo, started or done), `parts`, `updated` and `note`. Read a doc first, then write with `if_version`. The page's status is the truth; this note is a snapshot.

## How the work was run

- One main session, plus cheap Sonnet helpers, one card or part each. Each helper makes its own worktree: `git worktree add /Users/jriley/games-hub-<card> -b <branch> origin/main`, then `ln -s "/Users/jriley/Games Hub/node_modules" node_modules`.
- Helpers open a PR and wait for green checks. They don't merge and don't touch the page.
- The main session reviews each PR, merges it (squash) and updates the page. Merging to main deploys migrations, any function whose `index.ts` changed, and the site.
- Before a migration merges, check its number is free on main. Two PRs once both picked 0600, and the second would have been silently skipped. The next free number is **20261108001000**.
- Never have two cards editing the same game's files at once. Do one game's cards in turn.
- To brief a helper on a game part, point it at an earlier PR for the same card and say "copy this pattern". That was the cheapest way to work.
- Nothing has been hand-played in a browser, because helpers can't open the preview. Everything was checked by tests and CI only.

## Done and live

- S1 to S13, S17, S18, S21, S22, S23, S24, S28, S29, S30, S31, S36.
- S15: the kit part (#346), Parrot (#355) and Lizard (#356) and Swamp Hen (#357).
- S16 step 1: the rule 7 wording (#331).
- S19: the kit part (#347).
- S34: part 1 (kit slips) and part 3 (Quick looks usual slip).

There are no WIP branches left.

## Next, in order

1. **S15:** the finish screens for Robin and Pigeon. Copy #357.
2. **S19 parts 2 to 6:** one game at a time, using the kit from #347. Each part may need a migration.
3. **S16 step 2:** kit `sister.ts` first, then the games. James OK'd the wording in #331.
4. **S14** (lucky guess, all twelve games), then S25, then S35. S33 comes after S15.
5. **S34 parts 2 and 4:** save and show the usual slip, in the older and newer games.
6. **S32,** after S16's game parts.

## Waiting on James

- **S34 part 1b:** Beanstalk keeps one key per pair. It touches `shared/maths`, which needs James's OK.
- **S20:** Kingfisher isn't built yet.
- **Lizard finish screen:** it still shows the "x first time" score chip. Should it go? The plan's "no scores" note suggests yes.
- **Worth playing in a browser:**
  - the Show me first demos: Robin, Lizard, Swamp Hen, Parrot, Hop, Pipi, Penguin Pairs, Weka, Tūī and Beanstalk;
  - the Pigeon number-line reasons;
  - the Beanstalk stages and missing-leaf goes;
  - the new finish lines;
  - the Penguin Pairs fair buttons at phone width.
