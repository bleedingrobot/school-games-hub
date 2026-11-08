# Maths review 2 fix plan: handover (9 Nov 2026, morning NZ)

The first account stopped here because its weekly use reached 92%. This note tells the next session where things are.

**Tracker:** the fix plan page https://claude.ai/artifact/XQDGyC5rytsfNV2dAUi8Rd. Status is kept in its database, collection `status`, with one doc per card (S1 to S36). Its fields are `state` (todo, started or done), `parts`, `updated` and `note`. Read a doc first and write with `if_version`. The page's own status is the truth; this note is a snapshot.

## How the work was run

- Use one main session and cheap Sonnet helpers, one card or part each. Each helper makes its own worktree: `git worktree add /Users/jriley/games-hub-<card> -b <branch> origin/main`, then `ln -s "/Users/jriley/Games Hub/node_modules" node_modules`.
- Helpers open a PR and wait for green checks. They don't merge and don't touch the page.
- The main session reviews each PR, merges it (squash) and updates the page. Merging to main deploys: migrations, any function whose `index.ts` changed, and the site.
- Before a migration merges, check its number is free on main. Two PRs once both picked 0600, and the second would have been silently skipped. The next free number is **20261108001000** (0900 was the last used).
- Two cards must never edit the same game's files at the same time. Do one game's cards in turn.
- Nothing was hand-played in a browser, because helpers can't open the preview. Tests and CI only.

## Done and live

- S1 to S12: all done except S12's Pigeon part.
- S17, S21, S23, S24, S28, S29, S30, S36.
- S13: Swamp Hen and Lizard.
- S15 and S19: the kit parts.
- S18: the Lizard, Robin and Swamp Hen parts.
- S31: Hop, Pipi, Penguin Pairs and Quick looks.
- S34: part 1 (kit slips) and part 3 (Quick looks usual slip).

## Half-built, saved as WIP commits (pushed, not tested, no PR)

Each worktree still exists on the Mac. To finish one, check out the branch, read the card's plan, finish, test, then open a PR.

| Card | Branch | Worktree | Where it stopped |
|---|---|---|---|
| S13 Pigeon share | fix/pigeon-three-wrong | games-hub-s13p | Copying Swamp Hen #337 and Lizard #341 into Pigeon. 4 files edited. |
| S22 Beanstalk missing leaf | fix/beanstalk-missing-leaf | games-hub-s22 | Round, words, voice lines and 4 new clips edited. Rebuild the beanstalk function before the PR. |
| S31 Weka and Tūī Show me first | feat/weka-tui-show-me-first | games-hub-s31w | Weka mostly built (DemoScene.tsx, demo.ts, server seen action). Tūī only started. The helper's last note was "case clash; rename the scene file", so check the file-name case. |

## Next, in order

1. **Pigeon** (one card at a time, all the same files): finish S13 Pigeon, then S18 Pigeon, then S12 Pigeon (copy Robin #335), then S15 Pigeon.
2. **S15:** finish screens for Parrot, Lizard, Swamp Hen and Robin, using the kit `finishBand` from #346.
3. **S19 parts 2 to 6:** per game, using the kit from #347. Each part may need a migration.
4. **S22**, then **S31 part 6** (Beanstalk).
5. **S31 parts 1 and 5** (Weka and Tūī).
6. **S14** (lucky guess, all twelve games), then S25, then S35. S33 comes after S15.
7. **S34 parts 2 and 4** (save and show the usual slip, older and newer games).
8. **S32** after S16's game parts.

## Waiting on James

- **PR #331, S16 step 1:** the rule 7 wording, "Now you try" becomes a sister question. It's docs only. S16's game parts and S32 wait for James's OK.
- **S34 part 1b:** Beanstalk keeps one key per pair. It touches `shared/maths`, which needs James's OK.
- **S20:** Kingfisher isn't built yet.
- Nothing has been checked by hand in a browser. Worth playing: the Show me first demos (Robin, Lizard, Swamp Hen, Parrot, Hop, Pipi, Penguin Pairs), the Pigeon number-line reasons, Beanstalk stages and the Penguin Pairs fair buttons at phone width.
