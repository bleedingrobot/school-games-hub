/**
 * The Monster Book (docs/DIAMOND-MONSTERS-PLAN.md): a page for each of the 75 Maths Monsters forms, grouped by tier,
 * with its shiny page beside it once one is caught. Kept for good. Pictures are Maths Monsters' own paintings.
 */
import { DIG_MONSTERS, DIG_PAGES, TIER_RULES, bookKinds, bookShinies, tierOf, type MonsterBook as Book } from '../../../shared/diamond/caverns';
import { DIG_TIERS, MONSTER_CUP_STEPS } from '../../../shared/diamond/config';
import { TIER_COLOUR, monsterUrl } from './art/monsters';

const prettyDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function MonsterBook({ book }: { book: Book }) {
  const kinds = bookKinds(book);
  const shinies = bookShinies(book);
  const nextCup = MONSTER_CUP_STEPS.find((n) => n > kinds);
  return (
    <section className="dd-mb" aria-labelledby="dd-mb-title">
      <div className="dd-mb__head">
        <span className="dd-mb__cover" aria-hidden="true">📗</span>
        <div>
          <h3 id="dd-mb-title" className="dd-rarebook__title">The Monster Book</h3>
          <p className="dd-rarebook__lede">Every monster you catch in the Monster Dig fills its page here, for good, even after a New Season.</p>
          <div className="dd-rarebook__count" role="img" aria-label={`${kinds} of ${DIG_PAGES} monsters found`}>
            <div className="dd-rarebook__bar"><div style={{ width: `${(kinds / DIG_PAGES) * 100}%` }} /></div>
            <span>{kinds} / {DIG_PAGES}</span>
          </div>
          <p className="dd-small">{shinies > 0 ? `✨ ${shinies} shiny ${shinies === 1 ? 'page' : 'pages'}` : 'No shiny monsters yet (1 in 64 is shiny!)'}{nextCup ? ` · ${nextCup - kinds} more for the next Monster Book trophy` : ' · Full book! 🏆'}</p>
        </div>
      </div>
      {DIG_TIERS.map((tier) => {
        const list = DIG_MONSTERS.filter((s) => tierOf(s) === tier);
        const have = list.filter((s) => book[s.id]).length;
        return (
          <div key={tier} className="dd-mb__tier" style={{ ['--tier' as string]: TIER_COLOUR[tier] }}>
            <h4 className="dd-mb__tiername">{TIER_RULES[tier].name} <span className="dd-soft">{have} / {list.length}</span></h4>
            <ul className="dd-mb__grid">
              {list.map((s) => {
                const page = book[s.id];
                const url = monsterUrl(s.id, false);
                return (
                  <li key={s.id} className={`dd-mb__page${page ? ' is-found' : ' is-locked'}`}>
                    {url ? <img className="dd-mb__pic" src={url} alt="" width={72} height={72} loading="lazy" /> : <span className="dd-mb__pic" />}
                    <span className="dd-mb__name">{page ? s.name : '???'}</span>
                    {page && <span className="dd-small">×{page.count} · {prettyDate(page.first)}</span>}
                    {page?.shiny ? (
                      <span className="dd-mb__shiny" title={`Shiny, first on ${prettyDate(page.shinyFirst!)}`}>
                        {monsterUrl(s.id, true) && <img src={monsterUrl(s.id, true)} alt="" width={36} height={36} />}✨ ×{page.shiny}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
