# Add new pupils by email (badge card B6)

James, 25 Nov 2026: "a teacher page where I enter their email, or update a Google doc with the emails, and then click a
button and their account are created and QR codes made; the page should also let me quickly find kids and display/print
their QR code." B6 in [REVIEW.md](REVIEW.md) (James chose 11 Nov: keep Google first sign-in working too).

**Status:** built 26 Nov 2026 NZ (migration `20261126000300_add_pupils.sql`, function `pupils`).

## How it works

1. Teacher → Students → **➕ Add new pupils** (`/#/teacher/<class>/add-pupils`), or the button on the badges page.
2. Paste school emails (any text: one per line, a Sheet column, a Doc). Or open "Or read them from a Google Doc or Sheet",
   paste the link of a file shared as *Anyone with the link can view*, tap **Read emails**: the `pupils` function fetches
   the Doc's `export?format=txt` or the Sheet's `export?format=csv` (docs.google.com only) and fills the box.
3. **Add N pupils**: the browser calls the `pupils` function with the emails. It checks the teacher's token, asks
   `pupils_may_create(teacher, emails)` (service role only: teacher at an active school, email on that school's domain, no
   account yet, at most 100), and makes each with `auth.admin.createUser({ email, email_confirm: true })`. The usual
   triggers give the profile (random player name, school).
4. The browser then calls `teacher_add_pupils_by_email(class, emails)` as the teacher: each pupil with no class (or only
   the school's starting class) goes into the class (`put_in_class`, how = teacher) and gets a badge. Outcomes per email:
   added, here, other-class (left there, class named), teacher, no-account, not-school.
5. The page lists the outcomes and shows the new badges with **Print these badges**, each with **Print this card** and
   **Show big** (fills the screen to scan straight off a laptop or iPad).

**Google sign-in later:** Supabase links a Google sign-in to an existing user with the same verified email (automatic
identity linking), and the email was marked checked when made, so the pupil keeps one account. Badge sign-in already
works this way in reverse (72 email identities live on 25 Nov, made by badge magic links).

**Find a pupil** (badges page and Add pupils page): `teacher_find_pupils(words)` searches `my_students()` (own classes; a
school admin the whole school) by email name or player name, 2+ letters, up to 30, making missing badges. Each result can
be printed alone or shown big.

**Printing one sheet or card:** `src/teacher/badgePrint.ts` marks the chosen sheet/card; `badges.css` print rules hide the rest.

## Not done / ideas

- The Doc/Sheet must be shared by link; a school-only shared file can't be read by the server. Copy-paste always works.
- No "remove pupil" here (deleting pupils needs James's OK; end-of-year admin page does leavers).
- Teacher can't set the new pupil's year yet; they're asked on first sign-in (pupil-years).
