/**
 * /teacher/:classId/add-pupils: add pupils who have never played, by school email (docs/plans/badge-review/ADD-PUPILS.md).
 * Paste emails (typed, or copied from a Doc or Sheet), or give a shared Google Doc/Sheet link, and tap Add: each pupil gets an
 * account, joins this class and gets a badge to print. They can sign in with the badge straight away, or with Google as
 * before (the same account either way).
 */
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { addPupils, emailsFromGoogle, emailsIn, type AddedPupil, type Outcome } from '../data/addPupils';
import { FriendlyError } from '../data/profile';
import { BadgeCard, BigBadge, type CardPupil } from './BadgeCard';
import { FindPupil } from './BadgeSheet';
import { printBadges } from './badgePrint';
import { useTeacherClass } from './TeacherClass';
import './badges.css';

const errorText = (e: unknown) => (e instanceof FriendlyError ? e.message : 'Something went wrong. Please try again.');

const MAX = 100;

const SAY: Record<Outcome, string> = {
  added: 'Added',
  here: 'Already in this class',
  'other-class': 'In another class',
  teacher: 'A teacher’s account: left alone',
  'no-account': 'Couldn’t make the account: try again',
  'not-school': 'Not a school email',
};

export function AddPupils() {
  const { classId, current, classes } = useTeacherClass();
  const [chosen, setChosen] = useState<string | null>(null);
  const open = classes.filter((c) => !c.archived);
  const target = open.find((c) => c.id === chosen) ?? current;
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'link' | 'add' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [results, setResults] = useState<AddedPupil[] | null>(null);
  const [big, setBig] = useState<CardPupil | null>(null);
  const [addedTo, setAddedTo] = useState('');
  const sheet = useRef<HTMLUListElement>(null);
  const emails = useMemo(() => emailsIn(text), [text]);

  const readLink = async () => {
    setBusy('link');
    setProblem(null);
    try {
      const found = await emailsFromGoogle(link);
      if (!found.length) setProblem('No emails found in that file.');
      else setText((t) => [...new Set([...emailsIn(t), ...found])].join('\n'));
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    if (!target || !emails.length || emails.length > MAX) return;
    setBusy('add');
    setProblem(null);
    try {
      const done = await addPupils(target.id, emails);
      setResults(done);
      setAddedTo(target.name);
      // Keep only the emails that still need something, so Add can be tapped again for them.
      setText(done.filter((r) => r.outcome === 'no-account').map((r) => r.email).join('\n'));
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!classId || !current || !target) return null;
  const cards = (results ?? []).filter((r): r is AddedPupil & { player: string; code: string } => !!r.player && !!r.code);
  const added = (results ?? []).filter((r) => r.outcome === 'added').length;

  return (
    <section className="panel badges add-pupils" aria-labelledby="add-pupils-title">
      <div className="badges__head">
        <h2 id="add-pupils-title" className="panel__title">
          Add new pupils
        </h2>
        <Link className="button button--light" to={`/teacher/${classId}/badges`}>
          📷 Class badges
        </Link>
      </div>
      <p className="badges__note">
        For pupils who have never played. Put in their <strong>school emails</strong>, one per line, or paste a column copied
        from a Google Sheet or Doc. Tap Add: each pupil gets an account in the class you pick and a sign-in badge to print. They can
        play with the badge straight away, and signing in with Google later still works: it’s the same account.
      </p>

      <label className="add-pupils__label">
        Add them to
        <select className="add-pupils__class" value={target.id} onChange={(e) => setChosen(e.target.value)}>
          {open.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="add-pupils__label">
        School emails
        <textarea
          className="add-pupils__emails"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'ava.kingi@school.nz\nben.smith@school.nz'}
          spellCheck={false}
        />
      </label>

      <details className="add-pupils__google">
        <summary>Or read them from a Google Doc or Sheet</summary>
        <p className="badges__note">
          Share the file as <strong>Anyone with the link can view</strong> first, then paste its link here. (Or just copy the
          emails out of it and paste them above.)
        </p>
        <div className="add-pupils__row">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            aria-label="Google Doc or Sheet link"
          />
          <button type="button" className="button button--light" onClick={() => void readLink()} disabled={!link.trim() || busy !== null}>
            {busy === 'link' ? 'Reading…' : 'Read emails'}
          </button>
        </div>
      </details>

      <div className="add-pupils__row">
        <button
          type="button"
          className="button button--primary"
          onClick={() => void add()}
          disabled={!emails.length || emails.length > MAX || busy !== null}
        >
          {busy === 'add' ? 'Adding…' : emails.length ? `Add ${emails.length} pupil${emails.length === 1 ? '' : 's'} to ${target.name}` : 'Add pupils'}
        </button>
        {emails.length > MAX && <span role="alert">Add up to {MAX} at a time.</span>}
      </div>
      {problem && <p role="alert">{problem}</p>}

      {results && (
        <div className="add-pupils__results" role="status">
          <h3>
            {added} added to {addedTo}
          </h3>
          <ul className="add-pupils__list">
            {results.map((r) => (
              <li key={r.email} className={`add-pupils__result add-pupils__result--${r.outcome}`}>
                <span className="add-pupils__email">{r.email}</span>
                <span>
                  {SAY[r.outcome]}
                  {r.outcome === 'other-class' && r.className ? ` (${r.className}): their teacher can move them` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cards.length > 0 && (
        <>
          <div className="badges__head">
            <h3>Their badges</h3>
            <button type="button" className="button button--primary" onClick={() => printBadges(sheet.current)}>
              Print these badges
            </button>
          </div>
          <ul ref={sheet} className="badges__sheet" aria-label="Badges for the pupils just added">
            {cards.map((r) => (
              <BadgeCard
                key={r.player}
                pupil={{ player: r.player, displayName: r.displayName ?? '', realName: r.realName, code: r.code }}
                className={addedTo}
                onShow={() => setBig({ player: r.player, displayName: r.displayName ?? '', realName: r.realName, code: r.code })}
              />
            ))}
          </ul>
        </>
      )}

      <h3 className="add-pupils__find-title">Find any pupil’s badge</h3>
      <FindPupil onShow={setBig} />
      {big && <BigBadge pupil={big} onClose={() => setBig(null)} />}
    </section>
  );
}
