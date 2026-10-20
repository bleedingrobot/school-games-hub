# Bond Match: playtest kit (M.3)

Bond Match is not in the live app. You try it in the stand-alone preview. Nothing is sent anywhere; bests are kept in that browser only.

## Run the preview

From `~/projects/school-games-hub-bond-match` (branch `bond-match`):

```
npx vite --config vite.bond-match-preview.config.ts
```

Open the address it prints. Open the same address on a phone on the same Wi-Fi with `npx vite --config vite.bond-match-preview.config.ts --host`.

Handy extras on the address: `?seed=7` gives the same shuffle every game; `?mismatchMs=60000` keeps a wrong pair on show.

To clear remembered bests and settings, clear the site data in the browser.

## 8 things to try with kids

1. **Whole numbers shelf.** Play To 10, then To 20 and one of the 100s. Do the kids work out what to do without being told?
2. **Decimals shelf.** Play To 1 (tenths) and To 1 (hundredths). Can they tell 0.05 from 0.50?
3. **Fractions shelf.** Play Halves, Quarters and Eighths. Do the little bar pictures help? Try "Hide pictures" too.
4. **Each size.** Small, Medium, then Large. Is Large (4 across, 5 down) too much?
5. **On a phone.** Are the cards big enough to tap? Can they read fractions and the corner marks (● A, ◆ B)?
6. **Keyboard only.** Arrow keys to move, Enter or Space to flip. Can you finish a game?
7. **Reduced motion on.** Turn it on in the device settings. Cards should change with no 3D flip.
8. **Sound on.** Press the sound button. Flip, match and finish sounds should play. Is it too much, or too little?

Also try on purpose: flip two cards that make the right total but are different marks (for example ● A and ◆ B). Read the message to a child and ask what they think it means.

## What to write down

- **Stuck points:** where did a child stop and ask "what do I do?"
- **Confusing messages:** the "3 + 4 = 7" line, and the "Right total, wrong set!" message. What did they think it meant?
- **Stars:** gold is within 1.5 times the fewest flips, silver within 2.5 times. Did the stars feel fair? Did a good game get bronze, or a lucky one get gold? (Write the bond, size and flips.)
- Which bonds were too easy or too hard.
- Anything that was hard to read or tap.
