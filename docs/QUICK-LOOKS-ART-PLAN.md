# Quick looks: graphics upgrade plan

*Written 4 November 2026 for James, as part of the Quick looks review ([SUBITISING-REVIEW-PLAN.md](SUBITISING-REVIEW-PLAN.md)). James asked for the review to include a graphics upgrade. Final art is painted by James's gaming PC (ComfyUI) in the evening ([prompts/quick-looks-art.md](prompts/quick-looks-art.md)). The code goes in first with stand-in art, so the paintings slot in by file name.*

**Status: Q.A1 (code with stand-ins) built 4 Nov 2026; screenshots in project files `quick-looks-art/`. Paintings (Q.A2) not made yet.**

## What it looks like now

A plain white card on pale blue. The garden (the only reward) is four tiny brown ovals with a dot, and only the first plant ever grows into a simple drawn flower. The Training home and the pupil dashboard show Quick looks as a text tile with an emoji (👀). Screenshots: project files `subitising-review/01-home.png`, `05-answering.png`, `12-garden-after.png`.

## The look: a painted garden

In the same family as the home page cards and Marble Rush (bright, clean storybook painting, soft sky, no text in the art):

1. **Garden scene behind the home and summary screens.** A wide painted garden at the bottom of a sunny hill: a low fence, a path, and **four empty garden beds** in a row. The white card becomes a panel over the top of the scene (like the home cards), with the garden beds showing below it.
2. **Four painted plants, one per stage, five growth steps each** (20 small cut-out pictures). Each stage gets its own plant so the garden looks different as it fills: stage 1 a daisy, stage 2 a sunflower, stage 3 a kōwhai, stage 4 a pōhutukawa. Steps: seed in soil, sprout, leafy, bud, in flower. They stand in the four beds.
3. **The practice screen stays calm.** The flash picture keeps its plain pale tray and flat dots (the research document asks for no distractions on the picture, and the dots must stay 100% clear). Only the frame around it changes: the tray sits on a soft painted wooden board, and the garden scene shows very faint behind the card.
4. **Answer buttons as chunky wooden number tiles** (CSS only: warm wood colour, a darker edge, a press-down effect). Dark numbers on light wood, 7:1 contrast.
5. **A small friend on the feedback line.** A painted ladybird (or a tūī) beside "Yes!" and a calm version beside "Let me show you again". Small, never covering the picture.
6. **A painted Quick looks card** on the Training home and a picture on the dashboard tile, using the garden scene, like the home game cards.
7. **Growing moment on the summary.** A plant that moved up a step does a small grow (scale up from the soil; none with "less motion").

## Stand-ins until the paintings arrive

The code looks for each picture by name in `src/subitising/art/`. Until a picture is there, it draws a stand-in: a soft CSS gradient sky and grass for the scene, and better drawn SVG plants (one kind per stage, five steps) instead of the brown blobs. So the upgrade can go live before the paintings, and each painting improves it with no code change.

## Pictures to paint (ComfyUI, James's PC)

| Name | Size | What |
|---|---|---|
| `garden-scene` | 1600 x 900 | Sunny garden at the foot of a green hill, low wooden fence, gravel path, four empty raised garden beds in a row along the bottom third, soft blue sky with a few clouds at the top (the panel covers the top half) |
| `plant-1-0` … `plant-1-4` | 512 x 512 cut-out | Daisy: seed in soil, sprout, leafy, bud, white daisy in flower |
| `plant-2-0` … `plant-2-4` | 512 x 512 cut-out | Sunflower: same five steps, tall sunflower at the end |
| `plant-3-0` … `plant-3-4` | 512 x 512 cut-out | Kōwhai: same five steps, small kōwhai tree with yellow flowers |
| `plant-4-0` … `plant-4-4` | 512 x 512 cut-out | Pōhutukawa: same five steps, small pōhutukawa with red flowers |
| `friend-happy`, `friend-calm` | 512 x 512 cut-out | A friendly ladybird: cheering, and a gentle encouraging smile |

All in one look: bright flat storybook painting, the same as the home cards. The plants in the same soil mound and light so they line up in the beds. 3 tries each; a Sonnet helper suggests picks and James chooses on a picking page. WebP, a `-small` copy for Chromebooks.

## Steps

| Step | What | Live on its own? |
|---|---|---|
| **Q.A1** | Code: scene + panel layout, plant slots with better stand-in SVG plants, wooden number tiles, friend slot, painted-card slots on Training home and dashboard, growing moment. Screenshots at iMac, iPad, Chromebook and phone sizes | Yes |
| **Q.A2** | Paint the pictures on James's PC ([prompts/quick-looks-art.md](prompts/quick-looks-art.md)), pick, add to `src/subitising/art/` | Yes |

Checks for every step: axe clean, answer tiles 7:1, flash timing unchanged, "less motion" turns off the grow, no sideways scroll at 390 px, the page stays fast on a Chromebook (pictures lazy-loaded, small copies on narrow screens).
