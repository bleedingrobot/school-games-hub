/**
 * The maths warm-up comes first (James, 22 Oct 2026). A card on the Training home and a screen in front of the games, both
 * sending the student to the warm-up and back to where they were.
 */
import { Link } from 'react-router';
import { PLACEMENT_QUESTIONS } from '../../shared/maths/config';
import './gate.css';

/** The warm-up's address, coming back to `back` when it's done. */
export const placementLink = (back: string) => `/placement?back=${encodeURIComponent(back)}`;

/** On the Training home, instead of Today's session until the warm-up is done. */
export function PlacementFirstCard({ back }: { back: string }) {
  return (
    <div className="train-first__placement">
      <p>
        First, find your starting place: about {PLACEMENT_QUESTIONS} quick questions, once only. Then Training starts with the
        right facts for you.
      </p>
      <Link className="button button--primary" to={placementLink(back)}>
        Find my starting place
      </Link>
    </div>
  );
}

/** In front of a game page until the warm-up is done. */
export function PlacementFirstScreen({ back }: { back: string }) {
  return (
    <section className="coming-soon train-first" aria-labelledby="placement-first-title">
      <div className="coming-soon__emoji" aria-hidden="true">
        🧭
      </div>
      <h1 id="placement-first-title">Find your starting place first!</h1>
      <div className="coming-soon__text">
        <p>Answer about {PLACEMENT_QUESTIONS} quick questions, once only. Then the games ask maths that’s just right for you.</p>
        <p>There are no marks and no one sees how you did.</p>
      </div>
      <div className="train-first__buttons">
        <Link className="button button--primary" to={placementLink(back)}>
          Find my starting place
        </Link>
      </div>
      <Link className="train-first__home" to="/">
        Back to home
      </Link>
    </section>
  );
}
