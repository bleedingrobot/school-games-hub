/**
 * "My maths focus" on a student's home page: what the games are asking right now and why, and (when their teacher allows it, and
 * no teacher focus is running) a way to pick their own skills or go back to auto. Loaded on its own so the maths code stays out of the
 * home page's first download. On the home page it takes its part of the page's one request (`homePage`, null while that is on its
 * way); anywhere else it asks for itself. Given the maths path (`path`), it becomes the home page's one "My maths" box, with the
 * path under the focus.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { clearMyFocus, fetchMyFocus, saveMyFocus } from '../data/focus';
import { partOf, type HomePage } from '../data/homePage';
import { FriendlyError } from '../data/profile';
import { AUTO_FOCUS, focusNote, hasFocus, isTeacherFocus, parseFocus, skillList, type MathsFocus } from '../../shared/maths/focus';
import { SkillPicker } from '../maths/SkillPicker';
import '../maths/focus.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export default function MathsFocusCard({ homePage, path }: { homePage?: Promise<HomePage> | null; path?: ReactNode }) {
  const [focus, setFocus] = useState<MathsFocus | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [onlyThese, setOnlyThese] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (homePage === null) return;
    let current = true;
    // Like fetchMyFocus: if it can't be read, the answer is auto.
    void partOf(homePage, 'focus', parseFocus, fetchMyFocus)
      .catch(() => AUTO_FOCUS)
      .then((f) => current && setFocus(f));
    return () => {
      current = false;
    };
  }, [homePage]);

  if (!focus) return null;
  const teacher = hasFocus(focus) && isTeacherFocus(focus);
  const note = focusNote(focus);
  // What they would get back to when the teacher's focus ends.
  const underneath = teacher && focus.canChoose && focus.own ? skillList(focus.own.skills) : null;

  function open() {
    // Start from what they have picked, if they have.
    const mine = focus?.own ?? (focus && focus.source === 'student' ? focus : null);
    setSkills(mine?.skills ?? []);
    setOnlyThese(mine?.onlyThese ?? false);
    setChoosing(true);
    setStatus(null);
  }

  async function run(job: () => Promise<MathsFocus>, message: string) {
    setStatus('Saving…');
    try {
      setFocus(await job());
      setChoosing(false);
      setStatus(message);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className={`panel focus-card${path ? ' my-maths' : ''}`} aria-labelledby="focus-card-title">
      <h2 id="focus-card-title" className="panel__title">
        <span aria-hidden="true">🎯</span> {path ? 'My maths' : 'My maths focus'}
      </h2>
      <p>
        {note ?? 'Auto: the games pick the next maths for you, starting with what you are ready for.'}
        {teacher && ' You can’t change it until it ends.'}
      </p>
      {underneath && <p className="focus-card__small">After that you go back to your own pick: {underneath}.</p>}
      {!teacher && !focus.canChoose && <p className="focus-card__small">Your teacher has set the games to pick for you.</p>}

      {!teacher && focus.canChoose && !choosing && (
        <button type="button" className="button button--light-outline" onClick={open}>
          {hasFocus(focus) ? 'Change my focus' : 'Pick my own focus'}
        </button>
      )}

      {choosing && (
        <form
          className="focus-card__form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => saveMyFocus(skills, onlyThese), 'Saved. The games use it from your next level or game.');
          }}
        >
          <SkillPicker value={skills} onChange={setSkills} legend="Which maths do you want to practise?" />
          <label className="focus-card__only">
            <input type="checkbox" checked={onlyThese} onChange={(e) => setOnlyThese(e.target.checked)} /> Only these (no questions from earlier skills)
          </label>
          <div className="focus-card__actions">
            <button type="submit" className="button button--primary" disabled={skills.length === 0}>
              Save my focus
            </button>
            {focus.own && (
              <button type="button" className="button button--light-outline" onClick={() => void run(clearMyFocus, 'Back to auto.')}>
                Back to auto
              </button>
            )}
            <button type="button" className="button button--light-outline" onClick={() => setChoosing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <p role="status" className="focus-card__status">
        {status}
      </p>
      {path}
    </section>
  );
}
