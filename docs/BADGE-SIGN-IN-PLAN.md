# QR sign-in badges for Years 1–4

**Status:** LIVE 4 Nov 2026 (PR #199: migration applied, `badge` function deployed, site published). James picked "QR badges" from three options. Tried on the school Macs 4-5 Nov: sign-in fix (PR #215) confirmed working by James.

**Review 11 Nov 2026:** `docs/plans/badge-review/REVIEW.md` (findings and fix cards B1-B6). Start any follow-up there.

## Why

Young pupils can't type `name@douglaspark.school.nz` and a password with capitals and symbols. A printed card with a QR code
signs them in with no typing, to the same account they already have.

## How it works

1. **Teacher:** Teacher page → Students → **📷 Sign-in badges** (`/#/teacher/<class>/badges`). The first visit makes a code
   for every pupil in the class. **Print badges** prints 8 cards to an A4 page (name from the school email, player name,
   class, QR code). **Lost card** makes that pupil a new code; the old card stops working at once.
2. **Pupil:** on the sign-in page, the big **📷 Scan my badge** button opens the front camera; they hold the card up. Or
   they point the iPad's Camera app at the card, which opens the site. Either way they land on `/#/badge/<code>`.
3. **Site → server:** `/#/badge/<code>` sends the code to the `badge` server function. It asks the database
   (`badge_sign_in`, server key only) whose code it is, then makes a one-time magic-link key on the server
   (`auth.admin.generateLink`, no email is sent) and hands back its hash. The page signs in with
   `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`. Whoever was signed in on that device before is replaced.
   It waits for Supabase's sign-in code to finish starting up first, checks the new sign-in was kept, then loads the
   home page afresh (a full page load, like coming back from Google), so every part of the site starts signed in as
   the pupil. 4 Nov: without this, pupils on the school Macs reached the home page but games and the basic facts map
   went out without the sign-in a few seconds later.

## Safety decisions

- The code is 32 hex characters (122 random bits) and lives in the address's `#` part, which browsers never send to a server.
- `pupil_badges` has RLS on and no grants. Teachers read codes only through `teacher_class_badges(class)` for a class they
  teach; renewing goes through `require_teacher_of`. Codes are kept readable (not hashed) so a card can be reprinted;
  the server key could sign anyone in anyway, so hashing would add little.
- Badges only sign in `role = 'student'` profiles at an active school. A teacher's account can never be reached by a card.
- The function is rate-limited per internet address (60 a minute, generous for a class on one school address).
- A card is a password on paper: teachers keep them in the classroom.

## Files

- `supabase/migrations/20261104001300_pupil_badges.sql`, `supabase/tests/database/pupil_badges.test.sql`
- `supabase/functions/badge/` (handler, entry, built `index.ts`, tests)
- `src/data/badge.ts`, `src/pages/BadgeSignIn.tsx`, `src/pages/BadgeScanner.tsx`, `src/pages/badges.css`,
  `src/teacher/BadgeSheet.tsx`, `src/teacher/badges.css`; one link in `src/teacher/Students.tsx`, two routes in `src/App.tsx`.
- New libraries (pinned): `qrcode-generator@2.0.4` (MIT, draws the QR codes) and `jsqr@1.4.0` (Apache-2.0, reads them
  from the camera; loaded only when a pupil taps Scan my badge).

## Depends on

Supabase's magic-link sign-in (`generateLink` + `verifyOtp`). If the live project has the Email sign-in provider switched
off, the function answers "Sign-in is busy" and the logs say `badge: sign-in key failed`. The fix is Supabase dashboard →
Authentication → Sign In / Providers → Email: **on**, with "Allow new users to sign up" **off** (the sign-up hook already
refuses unknown schools).
