# Review of QR badge sign-in (11 Nov 2026)

Status: review and plan only, no code changed. Checked against `main` at `7149b3a` (after #403). The feature itself is
described in `docs/BADGE-SIGN-IN-PLAN.md` (live 4 Nov, PR #199, sign-in fix #215). Screenshots and the scan lab pictures
are in the project files folder `badge-review/`.

## Summary for James

- **It works and it is safe from guessing.** Each card holds a 122-bit random code and the site link, nothing else. Only the
  pupil's own teachers can read codes, only the server can turn one into a sign-in, badges never sign in a teacher, and a
  renewed card stops working at once. 31 pupils have badges (one class); 22 used one in the last week; the server log for
  the last day shows only good sign-ins.
- **One safety gap:** "Lost card" stops the old card, but **anyone already signed in with it stays signed in** on their
  device. Sign-ins never run out (pupils' oldest is 20 days; 66 sign-ins for 18 pupils). If a card is photographed and
  used at home, renewing it doesn't throw that person out. Fix first (B1, small).
- **Scanning is the weak spot for little hands.** The scanner asks the camera for no particular size and then shrinks the
  picture to 640 wide, and the card's code has 41×41 tiny squares (40 mm across). In the scan lab, with the real reader,
  a clean card read fine from about 2.5 screen pixels a square, but dim light, a 40° tilt or glare needed 4 or more, and
  a bent card failed at every size. On an iPad's wide front camera a card at arm's length gives about 1 to 2 pixels a
  square. Likely result: children hold the card very close and wait. Fix: bigger picture, bigger code (B2).
- **A 5 year old has to read.** Every message is small text ("That badge doesn't work any more. Ask your teacher for a
  new one."), nothing is read aloud, there's no "got it!" moment when the code is seen, and after any problem the child
  must tap "Try again" then "Scan my badge" again. Bella should say every message (B3).
- **Teachers:** printing a whole class is easy (8 cards to an A4 page, prints cleanly). But there's no way to print one
  card after "Lost card", the card has no picture a non-reader can recognise, teachers can't see who has never used
  their badge, and **a new pupil can't get a badge until an adult signs them in once with Google**. New Season and end of
  year leave badges working (good), but cards keep the old class name.
- **Not tested on the live site:** this cloud computer can't reach the live site or the server, and there is no test
  pupil. Everything below was checked in the code, the live database (read only), a local copy of the site with a fake
  camera, and a scan lab. Six things only a real iPad can answer are in section 7: 10 minutes for you or a helper.

## 1. How it works now

1. **Teacher makes and prints badges.** Teacher page → Students → **📷 Sign-in badges** (`/#/teacher/<class>/badges`). The
   first visit makes a code for every pupil in the class (`teacher_class_badges`). **Print badges** prints only the cards,
   8 to an A4 page, 2 columns: QR code (40 mm), name from the school email ("Ava Kingi"), player name, class, "📷 Scan me
   to play!". **Lost card** (with a confirm) makes that pupil a new code; the screen says to print it and throw the old
   one away. Only pupils who have signed in once (with Google) are listed.
2. **Pupil signs in.** Either: on the sign-in page tap the big **📷 Scan my badge** button, the camera opens under it
   (front camera on iPads and laptops, back camera on phones, with Switch camera), hold the card up to the yellow box. Or:
   point the iPad's Camera app at the card, which opens the link in Safari. Both land on `/#/badge/<code>`, which shows
   "Signing you in…" and then loads the home page afresh.
3. **Server.** The page sends the code to the `badge` server function. It checks the format, asks the database
   (`badge_sign_in`, server key only) whose code it is (a student at an active school only), notes `used_at`, makes a
   one-time sign-in key with `auth.admin.generateLink` (no email is sent) and returns its hash. The page signs in with
   `verifyOtp`, checks the sign-in was saved, then reloads home. Whoever was signed in on that device is replaced.
   Limit: 60 scans a minute per internet address, counted in each server copy's memory.
4. **How long things last.** A badge works until the teacher presses Lost card, the pupil is deleted, stops being a
   student, or the school is switched off. It never runs out. A sign-in made with a badge lasts until someone signs out
   on that device (Profile → Sign out) or another badge is scanned there: there is no time limit (`auth.sessions.not_after`
   is empty for every pupil). Lost card does not end existing sign-ins.

Screens (local copy, fake camera): `badge-review/ipad-1-sign-in.png`, `ipad-3-not-a-badge.png`, `ipad-4-camera-off.png`,
`phone-2-old-badge.png`, `phone-3-not-a-badge.png`, `laptop-3-not-a-badge.png`, `teacher-badge-page-laptop.png`, and the
printed sheet `print-pages.png` / `badge-sheet.pdf` (30 made-up pupils, 4 pages).

## 2. Does it work?

**Live numbers (read only, 11 Nov):** 31 badges, all in one class; 22 used, all within the last 7 days; last use
10 Nov 23:21 UTC. Server log, last 24 h: 5 sign-ins, all 200, no 404/429/503.

**Local copy with a fake camera** (Chromium, phone 390×844, iPad 820×1180, laptop 1366×768; the badge server answer and
sign-in were stood in, so this checks the page, not the server):

| Case | What the child sees | Result |
|---|---|---|
| Old or wrong badge | Card "🙈 Oops! That badge doesn't work any more. Ask your teacher for a new one." + **Try again** (goes back to the sign-in page, camera closed) | Works, about 0.8 s after the camera opens. Small text, needs reading, two taps to try again. |
| Another QR code (not a badge) | Camera stays on; small line under it "That QR code isn't a sign-in badge." | Works. The line stays even after the right card is shown. |
| Camera permission refused | Red text "The camera is off. Ask your teacher to let this site use the camera." + Close | Works, but says nothing about how (iPad: Settings → Safari → Camera → Allow). |
| No camera at all | "This device can't use its camera here. Ask your teacher." | Works. |
| Good badge | "Signing you in…" then a full reload to home | Page flow works; the live run needs a real pupil (section 7). |
| Phone | The camera opens below the Scan button, mostly off the screen | Child has to scroll to see the camera. |
| Laptop 1366×768 | Camera fits; Switch camera and Close are below the fold | Minor. |

**Scan lab** (the site's own reader, `jsqr@1.4.0`, with the same settings; 639 made-up camera pictures 640×480 with
the card's real 41×41 code; 3 tries each; full table in `badge-review/scan-lab-samples.png` and below). "Pixels a square"
is how big one black square of the code is in the camera picture.

| Condition | 1 | 1.5 | 2 | 2.5 | 3 | 4 | 5 | 6 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| Clean, straight on | – | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dim room (30% light, noise) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| Very dim (15%) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Tilted 25° | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tilted 40° | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Turned 30° | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Light glare on the card | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Slightly blurred | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bent / crumpled (even lightly) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Dim + tilted + blurred | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

- "–": read 3 of 3 at 1 pixel but failed at 1.5 and 2, a lucky line-up of pixels, so ignore it.
- A code holding only the 32-character code (29×29 squares) read at 1.5 pixels a square where the link needed 2.5, and a
  higher error-correction level (53×53) was worse, not better, at the same card size.
- Brightening the picture before reading did not help the dim cases (the reader already adjusts); only more pixels did.
- The lab's bends are rougher than a real crumple, and jsQR is known to be poor with bent codes, so treat "bent fails"
  as a strong warning to check on a real iPad, not as proven.
- **Why the pixels are low:** `BadgeScanner.tsx` calls `getUserMedia({ video: { facingMode } })` with no size, so most
  browsers give 640×480; it then shrinks anything wider to 640. On a newer iPad's wide front camera (about 120°) a 40 mm
  code at 30 cm is about 24 pixels across, under 1 pixel a square; at 15 cm about 1.2. Older iPads and laptop webcams
  (about 60-70°) do better, about 2 to 3 at 25 cm. The child will need to hold the card very close.

**Other risks found in the code:**
- **Home-screen app:** the site can be added to the iPad home screen as an app (`manifest.webmanifest`,
  `apple-mobile-web-app-capable`). The iPad Camera app route opens Safari, which keeps its own sign-in, so a pupil who
  scans with the Camera app is signed in in Safari, not in the home-screen app. Check which one the class uses.
- **Rate limit:** 60 scans a minute per internet address. A whole school usually shares one address, so two or three
  classes signing in at 9 am could hit "Too many scans" (the limit is per server copy, so in practice it's looser, but
  it isn't predictable). Guessing is impossible anyway (122 bits), so this limit protects little.
- The reader runs on every camera frame (60 a second on newer iPads), which is heavy on old iPads and drains battery.

## 3. Is it easy for a 5 year old?

Goal: hold up the badge and be playing within a few seconds, with no reading and no adult.

- **Finding their card:** cards show a name and a player name in small print, and every QR looks the same. A child who
  can't read their name can't find their own card. The avatar is already sent to the page (`teacher_class_badges` returns
  it) but not printed.
- **Starting:** "Scan my badge" is the first big button (good), but the page around it is full of words ("Student sign
  in", "Use your Douglas Park school account", Google button, a 5-item list).
- **Holding it up:** the instruction "Hold your badge up to the camera" is text only. Because the picture is small (above)
  the child has to bring the card very close, and nothing tells them closer or further.
- **The moment it reads:** no sound, no tick, no flash; the screen just changes to "Signing you in…" (a spinning star),
  then reloads. That part is fine and quick.
- **When something goes wrong:** every message is reading-only and small, and the "Oops" card sends them back to the
  sign-in page, so they need two taps to try again. "Ask your teacher" is the right advice but needs reading.
- **Bella:** yes, she should read every scanner line aloud, with the text kept for adults. Suggested lines: "Hold your
  badge up to the camera." · "Closer!" (when a code is seen but can't be read, if B2 can tell) · "Got it! Signing you
  in." · "That's not a sign-in badge. Try your own card." · "That card is old. Ask your teacher for a new one." · "The
  camera is off. Ask your teacher." · "Hmm, the internet isn't working. Ask your teacher." Clips are made on James's Mac
  later; ship with the text.

## 4. Is it safe?

| Question | Answer | Evidence |
|---|---|---|
| Can a code be guessed? | No. 32 hex characters from `gen_random_uuid()` (122 random bits); the server rejects anything else before looking. | migration `20261104001300`, handler |
| Is anything private in the QR? | No. It holds the site link and the code only. The printed card shows the name from the school email and the class, in words beside the code. | `BadgeSheet.tsx` |
| Does a badge sign in only that pupil? | Yes: the code maps to one pupil; teachers can never be signed in by a card; only students at an active school. | `badge_sign_in` |
| Lost, copied or photographed card | Teacher taps Lost card: new code, the old card stops working at once (tested). **But sign-ins already made with the old card stay signed in, with no time limit.** | `teacher_renew_badge` doesn't touch `auth.sessions`; live: no session has `not_after` |
| Who can read codes? | Only teachers of that class (or `require_teacher_of` for renew). Pupils and signed-out visitors can't read the table or call the server function. | RLS on, no grants; DB test |
| Can a teacher see misuse? | No. `used_at` is stored (last use only) but not shown. | `BadgeSheet.tsx` |
| Does a card work at home? | Yes, anywhere, any time. Fine for homework; a choice for James if he'd rather not (section 8). | |
| Rate limit | 60 a minute per address, in memory per server copy. Little protection, some risk of blocking a school at 9 am. | `handler.ts` |

**Tests:** the database test (13 checks) covers: teacher gets codes for own class, same codes on reprint, no badge for a
teacher, another school's teacher can't read or renew, pupils and anon can't read the table or turn a code into a
sign-in, server key works, wrong code → nothing, renew changes the code and the old one stops working. The function test
covers good / wrong / junk / missing code. **Missing:** a pupil at a switched-off school; a pupil whose role changed to
teacher; a teacher at the same school who doesn't teach the class; renew clears `used_at`; the function's 429, 503,
405 and OPTIONS answers; and (after B1) that Lost card ends old sign-ins.

## 5. For teachers

| Task | Now | Gap |
|---|---|---|
| Print a whole class | One button; 8 cards an A4 page; prints cleanly across pages (checked with 30 pupils: 4 pages). | Fine. |
| Reprint one badge | Lost card makes a new code; then Print prints the whole class again. | No "print this one card": wastes a page and confuses (which card is new?). |
| Reprint without a new code | Print again: same codes. | Fine. |
| Add a new pupil | They appear only after signing in once with Google (an adult types the school email and password). | A Year 1 pupil can't do this alone. Bigger fix: teacher adds by school email (section 8). |
| Pupil moves class | Badge keeps working (it belongs to the pupil). | Card shows the old class name. |
| New Season (points) | Badges untouched. | Fine. |
| End of year | Leavers deleted → their badges go with them (cascade). Others keep working. | Admin end-of-year page doesn't mention badges; cards show last year's class. Add a line "print new badges for new classes". |
| Who hasn't used their badge? | Not shown. | Show "last used" / "not used yet" on the badge page. |

## 6. The plan

In order. Sizes: S = under a day for one thread, M = a day or so, L = several days.

| Card | What | Gives | Size | Database? |
|---|---|---|---|---|
| **B1** | Lost card also signs that pupil out everywhere; add the missing database and function tests; make the rate limit fit a whole school. | A lost or photographed card can't keep playing as the pupil. Safety covered by tests. | S | Yes |
| **B2** | Read badges better: ask the camera for 1280×720 or more, read the middle of the full picture without shrinking, use the browser's own QR reader where it has one, read ~10 times a second, print the code bigger (about 50 mm) with a shorter link. Keep old cards working. Add the scan lab as a test. | Cards read from arm's length, in a dim room, at an angle. | M | No |
| **B3** | A scanner a 5 year old can use: camera opens full screen at once, Bella says every line, a big tick and chime when read, problems show a picture and go back to the camera by themselves, simple sign-in page for young pupils. | Badge up, playing in a few seconds, no reading. | M | No |
| **B4** | Cards a child can find, and teacher tools: avatar picture on each card, bigger first name; "Print this card" after Lost card; "Last used / not used yet" on the badge page; end-of-year line about new badges. | Non-readers pick their own card; teachers reprint one card and spot problems. | S | Small (return `used_at`) |
| **B5** | Shared iPads: depends on James's choice (section 8). Recommended: a "Not you? Scan your badge" button on the home page for badge pupils; keep sign-ins as they are. | The next child on a shared iPad doesn't play as the last one. | S | No |
| **B6** | New pupils without Google first: teacher adds a pupil by school email so the badge exists from day one; Google first sign-in still works (James chose both). | A new Year 1 pupil can play on day one. | L | Yes |

## 7. Live check for James (10 minutes, school iPad)

Print one badge for a test pupil (or your own class), then:

1. Safari → site → Scan my badge. Does the camera permission prompt appear, and does it read at arm's length? How close
   did you need to hold it?
2. Same in a dim corner, at an angle, and with the card bent in half and flattened.
3. Camera app → point at the card. Does it open Safari or the home-screen app, and are you signed in where the class plays?
4. Lost card on the teacher page, then scan the old card: "That card is old" message? And is the iPad that used the
   old card still signed in? (Today: yes.)
5. A laptop webcam: does it read, and which way does the picture mirror?
6. Note anything a child got stuck on.

## 8. Decisions for James

Asked on question cards in the review thread:

1. **Shared iPads, how long should a badge sign-in last?** (B5) **DECIDED by James 11 Nov 2026: keep sign-ins as now
   and add a big "Not you? Scan your badge" button.**
2. **New pupils who haven't signed in with Google** (B6): **DECIDED by James 11 Nov 2026: both.** Keep the Google first
   sign-in working, and build "teacher adds a pupil by school email" so a badge exists from day one.

## Cards done

| Card | PR | Status |
|---|---|---|
| B1 | | to do |
| B2 | | to do |
| B3 | | to do |
| B4 | | to do |
| B5 | | to do (decided: Not you? button) |
| B6 | | to do (decided: both ways) |
