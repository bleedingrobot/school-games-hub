/**
 * "Feedback on this question" (questionFeedback.ts): the panel on the left of the question pop-up, the mirror of the
 * scribble pad on the right. A teacher writes what needs tweaking; Save keeps it with a copy of what the pop-up showed.
 * The parent gives it a new `key` for each question, so every question starts with an empty note.
 */
import { useEffect, useRef, useState } from 'react';
import { FEEDBACK_TAGS, type FeedbackItem, type FeedbackSink, type FeedbackTag } from './questionFeedback';

export function FeedbackPanel({
  sink,
  item,
  onCollapse,
}: {
  sink: FeedbackSink;
  /** What to save with the note: everything but the words and tags. */
  item: () => Omit<FeedbackItem, 'feedback' | 'tags'>;
  onCollapse: () => void;
}) {
  const [words, setWords] = useState('');
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const field = useRef<HTMLTextAreaElement>(null);

  // Keys typed here are for the note, not the game behind the pop-up (a space mustn't flap the bird).
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const stop = (e: KeyboardEvent) => e.stopPropagation();
    el.addEventListener('keydown', stop);
    el.addEventListener('keyup', stop);
    return () => {
      el.removeEventListener('keydown', stop);
      el.removeEventListener('keyup', stop);
    };
  }, []);

  const toggle = (tag: FeedbackTag) => setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  const save = async () => {
    const feedback = words.trim();
    if (!feedback || state === 'saving') return;
    setState('saving');
    try {
      await sink.send({ ...item(), feedback, tags });
      setState('saved');
      setWords('');
      setTags([]);
    } catch {
      setState('failed');
    }
  };

  return (
    <section className="qfeedback" aria-label="Feedback on this question">
      <div className="qfeedback__bar">
        <h3 className="qfeedback__title">Feedback on this question</h3>
        <button type="button" className="scribble__btn qfeedback__hide" onClick={onCollapse}>
          Hide
        </button>
      </div>
      <p className="qfeedback__hint">What needs tweaking? The question, its picture and its Help me are saved with your note.</p>
      <div className="qfeedback__tags" role="group" aria-label="What is it about?">
        {FEEDBACK_TAGS.map(({ tag, label }) => (
          <button
            key={tag}
            type="button"
            className="scribble__btn qfeedback__tag"
            aria-pressed={tags.includes(tag)}
            onClick={() => toggle(tag)}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        ref={field}
        className="qfeedback__field"
        aria-label="Your feedback"
        placeholder="e.g. The box should show 20 and 3"
        maxLength={2000}
        value={words}
        onChange={(e) => {
          setWords(e.target.value);
          if (state !== 'saving') setState('idle');
        }}
      />
      <div className="qfeedback__foot">
        <button type="button" className="qfeedback__save" disabled={!words.trim() || state === 'saving'} onClick={save}>
          {state === 'saving' ? 'Saving…' : 'Save feedback'}
        </button>
        <span className="qfeedback__status" role="status">
          {state === 'saved' ? 'Saved. Thank you!' : state === 'failed' ? 'That didn’t save. Try again?' : ''}
        </span>
      </div>
    </section>
  );
}
