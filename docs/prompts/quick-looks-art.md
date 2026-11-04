# Prompt: Quick looks garden art (step Q.A2), to run when the gaming PC is on

Paste everything below the line into the project chat on an evening when James's gaming PC (ComfyUI) is on. Saved 4 Nov 2026.

---

Paint the Quick looks garden art (step Q.A2 of `docs/QUICK-LOOKS-ART-PLAN.md`) for the School Games Hub. Reply to James in plain, short words. Use Sonnet helpers for looking at paintings. Ask James questions only on clickable cards.

1. Read `docs/QUICK-LOOKS-ART-PLAN.md` (the picture list and the look) and one existing art script for the ComfyUI method, e.g. `scripts/isles-art.py`. Start a branch from `main`.
2. Check the PC: `curl -s http://100.97.96.115:8188/system_stats`. If it doesn't answer, ask James to start ComfyUI (steps in project memory, home-art-plan) and stop there. Never draw the art in code.
3. Write `scripts/quick-looks-art.py` with the style of the home page cards (bright, clean, flat storybook painting, soft sky, no text). Positive wording only. Paint 3 tries of each picture in the plan's table into an inbox folder outside `src/`; cut out the plants and the ladybird (rembg, as the other scripts do).
4. A Sonnet helper checks each set: right for 5 to 11-year-olds, no lettering or melted shapes, the four plants share the same soil mound, light and size so they line up in the garden beds. Show James the tries on one picking page with the suggested pick marked, and ask on cards.
5. Save the picks as WebP (and `-small` copies) in `src/subitising/art/` with the names in the plan. The screens already look for them by name.
6. Screenshots at iMac, iPad, Chromebook and phone sizes; check the flash picture area is still plain. Run the type check and the full tests, open a PR and take it to live (pre-approved). Update the plan's status and the work board.
