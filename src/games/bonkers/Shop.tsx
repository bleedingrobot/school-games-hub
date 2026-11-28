/**
 * Smash Quest's sticker shop and Monster Book (docs/BONKERS-PLAN.md, stage B.2), and the hero as drawn everywhere: the
 * painting with the hat worn on top and the pet at their side. Looks only: nothing here changes a fight.
 */
import { useState } from 'react';
import { BOOK_MONSTERS, CLASS_INFO, SHOP, ZONES, shopItem, type HeroClass, type Look, type ShopKind } from '../../../shared/bonkers/content';
import type { Progress } from '../../../shared/bonkers/engine';
import { Pic, heroArt, homeArt, monsterArt, shopArt } from './art';
import { Screen } from './Screens';

/** The hero with their hat and pet. Sized by the font size around it, like `Pic`. */
export function HeroFigure({ cls, look, level, hat, pet }: { cls: HeroClass; look: Look; level: number; hat?: string | null; pet?: string | null }) {
  const h = shopItem(hat);
  const p = shopItem(pet);
  return (
    <span className="bq-figure">
      <Pic src={heroArt(cls, look, level)} emoji={CLASS_INFO[cls].emoji[look]} />
      {h && <span className={`bq-figure__hat bq-figure__hat--${cls}`} aria-hidden="true"><Pic src={shopArt(h.id)} emoji={h.emoji} /></span>}
      {p && <span className="bq-figure__pet" aria-hidden="true"><Pic src={shopArt(p.id)} emoji={p.emoji} /></span>}
    </span>
  );
}

export function Shop({ progress, busy, note, onBuy, onWear, onHome }: {
  progress: Progress; busy: boolean; note: string | null;
  onBuy: (id: string) => void; onWear: (kind: ShopKind, id: string | null) => void; onHome: () => void;
}) {
  const [kind, setKind] = useState<ShopKind>('hat');
  const [trying, setTrying] = useState<string | null>(null);
  const owned = progress.owned ?? [];
  const hero = progress.hero;
  const tryOn = shopItem(trying);
  const hat = tryOn?.kind === 'hat' ? tryOn.id : progress.hat;
  const pet = tryOn?.kind === 'pet' ? tryOn.id : progress.pet;
  return (
    <Screen label="Sticker shop" pic={homeArt()} className="bq-shop">
      <h1 className="bq-shout">Sticker Shop</h1>
      <div className="bq-shop__grid">
        <div className="bq-shop__me">
          {hero && <span className="bq-shop__figure" aria-hidden="true"><HeroFigure cls={hero.cls} look={hero.look} level={progress.level} hat={hat} pet={pet} /></span>}
          <p className="bq-shop__stickers" aria-live="polite">🏷️ <b>{progress.stickers}</b> sticker{progress.stickers === 1 ? '' : 's'}</p>
          {tryOn && !owned.includes(tryOn.id) && <p className="bq-shop__trying">Trying on the {tryOn.name}</p>}
        </div>
        <div className="bq-panel bq-shop__panel">
          <div className="bq-tabs" role="tablist" aria-label="Shop">
            {(['hat', 'pet'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} className={`bq-tab${kind === k ? ' bq-tab--on' : ''}`} onClick={() => { setKind(k); setTrying(null); }}>
                {k === 'hat' ? '🎩 Hats' : '🐾 Pets'}
              </button>
            ))}
          </div>
          <ul className="bq-shop__items">
            {SHOP.filter((x) => x.kind === kind).map((x) => {
              const mine = owned.includes(x.id);
              const wearing = (x.kind === 'hat' ? progress.hat : progress.pet) === x.id;
              const short = progress.stickers < x.price;
              return (
                <li key={x.id} className={`bq-item${trying === x.id ? ' bq-item--trying' : ''}${wearing ? ' bq-item--wearing' : ''}`}>
                  <button type="button" className="bq-item__look" onClick={() => setTrying(trying === x.id ? null : x.id)} aria-label={`Try on the ${x.name}`}>
                    <span className="bq-item__pic" aria-hidden="true"><Pic src={shopArt(x.id)} emoji={x.emoji} /></span>
                    <span className="bq-item__name">{x.name}</span>
                  </button>
                  {mine ? (
                    <button type="button" className={`bq-btn bq-btn--small${wearing ? ' bq-btn--picked' : ' bq-btn--soft'}`} disabled={busy}
                      onClick={() => { setTrying(null); onWear(x.kind, wearing ? null : x.id); }}>
                      {wearing ? '✔ Wearing' : 'Wear it'}
                    </button>
                  ) : (
                    <button type="button" className="bq-btn bq-btn--small" disabled={busy || short} onClick={() => { setTrying(null); onBuy(x.id); }}
                      title={short ? `You need ${x.price - progress.stickers} more stickers` : undefined}>
                      🏷️ {x.price}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="bq-hint">Tap one to try it on. Win fights to earn stickers!</p>
          {note && <p className="bq-note" role="alert">{note}</p>}
        </div>
      </div>
      <button type="button" className="bq-btn bq-btn--big bq-shop__home" onClick={onHome}>Back home</button>
    </Screen>
  );
}

export function MonsterBook({ progress, onHome }: { progress: Progress; onHome: () => void }) {
  const book = progress.book ?? {};
  const found = BOOK_MONSTERS.filter((m) => (book[m.id] ?? 0) > 0).length;
  return (
    <Screen label="Monster Book" pic={homeArt()} className="bq-book">
      <h1 className="bq-shout">Monster Book</h1>
      <p className="bq-book__count"><b>{found}</b> of {BOOK_MONSTERS.length} monsters smashed</p>
      {ZONES.map((z) => (
        <section key={z.id} className="bq-panel bq-book__zone" aria-label={z.name}>
          <h2 className="bq-book__title">{z.name}</h2>
          <ul className="bq-book__pages">
            {[...z.monsters, z.big].map((m) => {
              const n = book[m.id] ?? 0;
              return (
                <li key={m.id} className={`bq-page${n ? '' : ' bq-page--unknown'}${m === z.big ? ' bq-page--big' : ''}`}>
                  <span className="bq-page__pic" aria-hidden="true"><Pic src={monsterArt(m.id)} emoji={m.emoji} /></span>
                  <strong>{n ? m.name : '???'}</strong>
                  <span className="bq-page__n">{n ? `Smashed ×${n}` : m === z.big ? 'The big one' : 'Not met yet'}</span>
                  {n > 0 && <span className="bq-page__line">“{m.ouch}”</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <button type="button" className="bq-btn bq-btn--big bq-shop__home" onClick={onHome}>Back home</button>
    </Screen>
  );
}
