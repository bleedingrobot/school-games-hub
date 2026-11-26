/**
 * Admin → Question feedback (/teacher/admin/feedback; James, 26 Nov 2026): the tweak list. Every note a teacher saved with
 * "Feedback on this question" in a game (src/maths/FeedbackPanel.tsx), with the question, picture and Help me card exactly
 * as the pop-up showed them. Tick a note off as fixed, or not needed, once it's been looked at.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchFeedback, setFeedbackStatus, type FeedbackNote, type FeedbackStatus } from '../data/questionFeedback';
import { FriendlyError } from '../data/profile';
import { isFigure } from '../../shared/maths/figure';
import { FEEDBACK_TAGS } from '../maths/questionFeedback';
import { Figure } from '../maths/Figure';
import { QuestionPicture } from '../maths/QuestionPicture';
import '../pages/teacher-page.css';
import './admin.css';
import '../maths/maths.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const tagLabel = (tag: string) => FEEDBACK_TAGS.find((t) => t.tag === tag)?.label ?? tag;
const STATUS_WORDS: Record<FeedbackStatus, string> = { open: 'To look at', fixed: 'Fixed', skip: 'Not needed' };

/** The question as one line, with the answer box as "?" (or the answer, when the pop-up knew it). */
export function questionLine(note: FeedbackNote): string {
  return (note.question.parts ?? []).join(' ').replace(/\s+/g, ' ').trim();
}

function NoteCard({ note, onChange }: { note: FeedbackNote; onChange: () => void }) {
  const [reply, setReply] = useState(note.note);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState('');
  const q = note.question;
  const answer =
    q.answer === undefined ? null : q.choiceLabels?.[q.answer] ?? String(q.answer);
  const mark = async (status: FeedbackStatus) => {
    setBusy(true);
    setTrouble('');
    try {
      await setFeedbackStatus(note.id, status, status === 'open' ? '' : reply.trim());
      onChange();
    } catch (error) {
      setTrouble(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="panel admin-feedback__item" data-status={note.status}>
      <div className="admin-feedback__head">
        <span className="admin-feedback__where">{q.title || 'Question'}</span>
        <span className="admin-feedback__meta">
          {note.author || note.authorEmail.split('@')[0] || 'A teacher'}, {when(note.at)}
        </span>
      </div>
      <p className="admin-feedback__words">“{note.feedback}”</p>
      {note.tags.length > 0 && (
        <p className="admin-feedback__tags">
          {note.tags.map((t) => (
            <span key={t} className="admin-feedback__tag">
              {tagLabel(t)}
            </span>
          ))}
        </p>
      )}
      <div className="admin-feedback__shown">
        <div className="admin-feedback__question">
          {q.prompt && <p className="admin-feedback__prompt">{q.prompt}</p>}
          <p className="admin-feedback__fact">{questionLine(note)}</p>
          {q.choiceLabels && q.choiceLabels.length > 0 && (
            <p className="admin-feedback__choices">Choices: {q.choiceLabels.join(' · ')}</p>
          )}
          {answer !== null && <p className="admin-feedback__answer">Answer: {answer}</p>}
          {isFigure(q.figure) && <Figure figure={q.figure} />}
          {note.picture && <QuestionPicture picture={note.picture} />}
        </div>
        <div className="admin-feedback__help">
          {note.help ? (
            <div className="help-card">
              <p className="help-card__title">{note.help.title}</p>
              <ol className="help-card__steps">
                {note.help.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="admin-feedback__none">No Help me card on this question.</p>
          )}
          {q.helpBox && <p className="admin-feedback__none">Help box: {q.helpBox}</p>}
        </div>
      </div>
      <p className="admin-feedback__meta">
        {[q.skill, note.key, note.game].filter(Boolean).join(' · ')}
      </p>
      <div className="admin-feedback__actions">
        {note.status === 'open' ? (
          <>
            <label className="admin-feedback__reply">
              What was done (optional)
              <input value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} />
            </label>
            <button type="button" className="button button--light-outline admin__small" disabled={busy} onClick={() => mark('fixed')}>
              Fixed
            </button>
            <button type="button" className="button button--light-outline admin__small" disabled={busy} onClick={() => mark('skip')}>
              Not needed
            </button>
          </>
        ) : (
          <>
            <span className="admin-feedback__done">
              {STATUS_WORDS[note.status]}
              {note.doneAt ? ` ${when(note.doneAt)}` : ''}
              {note.note ? `: ${note.note}` : ''}
            </span>
            <button type="button" className="button button--light-outline admin__small" disabled={busy} onClick={() => mark('open')}>
              Back on the list
            </button>
          </>
        )}
      </div>
      {trouble && <p role="alert" className="teacher__status">{trouble}</p>}
    </li>
  );
}

export function AdminFeedback() {
  const [which, setWhich] = useState<'open' | 'done'>('open');
  const [notes, setNotes] = useState<FeedbackNote[] | null>(null);
  const [failed, setFailed] = useState('');
  const load = useCallback(() => {
    setFailed('');
    fetchFeedback(which).then(setNotes, (error) => setFailed(errorText(error)));
  }, [which]);
  useEffect(() => {
    setNotes(null);
    load();
  }, [load]);

  return (
    <>
      <section className="panel" aria-labelledby="feedback-title">
        <h2 id="feedback-title" className="panel__title">
          Question feedback
        </h2>
        <p className="admin-feedback__intro">
          Notes teachers saved with “Feedback on this question” in the games, with the question, picture and Help me as they
          were shown. Tick each one off once it’s been looked at.
        </p>
        <div className="admin__actions" role="group" aria-label="Which notes">
          <button type="button" className="button button--light-outline admin__small" aria-pressed={which === 'open'} onClick={() => setWhich('open')}>
            To look at
          </button>
          <button type="button" className="button button--light-outline admin__small" aria-pressed={which === 'done'} onClick={() => setWhich('done')}>
            Done
          </button>
        </div>
      </section>
      {failed ? (
        <p className="panel panel__empty">{failed}</p>
      ) : !notes ? (
        <p className="panel panel__empty">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="panel panel__empty">
          {which === 'open' ? 'Nothing to look at. Notes saved in the games show up here.' : 'Nothing ticked off yet.'}
        </p>
      ) : (
        <ul className="admin-feedback__list">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onChange={load} />
          ))}
        </ul>
      )}
    </>
  );
}
