/**
 * Goblin Storm between runs (docs/GOBLINSTORM-PLAN.md, "Between runs", stage 5): the gold shop and the Weapon Codex.
 *
 * The shop only shows prices; the server does the buying (`buy_goblinstorm()`, one locked update on the pupil's own
 * save) and the next run is played with the shop the server keeps when it starts. The Codex is read from the save:
 * each weapon once picked up, each evolution once made, and the passive that evolves it.
 */
import { useState } from 'react';
import { HEROES, PASSIVES, SHOP, SHOP_IDS, WEAPON_IDS, WEAPONS, type HeroDef, type ShopId } from '../../../shared/goblinstorm/config';
import { CODEX_SIZE, allBought, codexCount, nextCost, shopLevelOf, shopTop } from '../../../shared/goblinstorm/shop';
import { GoblinStormError, type GoblinStormBackend, type MySave } from './backend';
import { heroOpen } from '../../../shared/goblinstorm/server';
import { powerPic, powerWords } from './heroPowers';
import { HERO_ICON, PASSIVE_ICON, WEAPON_ICON } from './look';
import { Pic } from './Pic';

const SHOP_ICON: Record<ShopId, string> = { might: '💪', armour: '🛡️', speed: '👟', health: '❤️', magnet: '🧲', gold: '🪙' };

/** "🪙 120 gold", or once everything is bought, only the best haul from one run. */
export function GoldLine({ save }: { save: MySave }) {
  return allBought(save.shop)
    ? <span className="gs-gold">🏆 Best haul {save.bestGold} gold</span>
    : <span className="gs-gold">🪙 {save.gold} gold</span>;
}

export const codexOf = (save: MySave) => codexCount(save.weapons, save.codex);

export function ShopScreen({ backend, save, onSave }: { backend: GoblinStormBackend; save: MySave; onSave: (s: MySave) => void }) {
  const [busy, setBusy] = useState<ShopId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const done = allBought(save.shop);

  const buy = async (id: ShopId) => {
    setBusy(id);
    setNote(null);
    try {
      const r = await backend.buy(id);
      onSave({ ...save, gold: r.gold, shop: r.shop });
      if (r.bought) setNote(`${SHOP[id].name} is now level ${shopLevelOf(r.shop, id)}!`);
      else setNote(r.reason === 'top' ? `${SHOP[id].name} is already at the top.` : r.reason === 'none' ? 'Finish a run to start saving gold.' : 'Not enough gold yet. Play another run!');
    } catch (e) {
      setNote(e instanceof GoblinStormError ? e.message : 'That couldn’t be bought. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <p className="gs-menu__sub gs-progress"><GoldLine save={save} /></p>
      <p className="gs-menu__sub">
        {done ? 'You have bought everything! Every run now starts at full power.' : 'Spend gold from your runs. Upgrades last for every run, on every hero.'}
      </p>
      <div className="gs-grid">
        {SHOP_IDS.map((id) => {
          const level = shopLevelOf(save.shop, id);
          const cost = nextCost(save.shop, id);
          const top = shopTop(id);
          return (
            <div key={id} className="gs-pick gs-shop">
              <span className="gs-pick__icon" aria-hidden="true">{SHOP_ICON[id]}</span>
              <span className="gs-pick__name">{SHOP[id].name}</span>
              <span className="gs-pick__blurb">{SHOP[id].blurb} each level</span>
              <span className="gs-dots" aria-label={`Level ${level} of ${top}`}>
                {Array.from({ length: top }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
              </span>
              {cost === null
                ? <span className="gs-pick__weapon">✔ All bought</span>
                : (
                  <button type="button" className="gs-btn" disabled={busy !== null || save.gold < cost} onClick={() => void buy(id)}>
                    Buy level {level + 1} · 🪙 {cost}
                  </button>
                )}
            </div>
          );
        })}
      </div>
      {note && <p className="gs-menu__sub gs-progress" role="status">{note}</p>}
    </>
  );
}

export function CodexScreen({ save, hero, onHero }: { save: MySave; hero: HeroDef; onHero: (h: HeroDef) => void }) {
  return (
    <>
      <p className="gs-menu__sub gs-progress">📖 Codex {codexOf(save)}/{CODEX_SIZE}</p>
      <p className="gs-menu__sub">Pick up a weapon to add it. Get it to level 5 with its partner to evolve it!</p>
      <div className="gs-codex__heroes" role="group" aria-label="Whose weapons to show">
        {HEROES.filter((h) => heroOpen(save, h.id)).map((h) => (
          <button key={h.id} type="button" className={`gs-btn gs-btn--ghost${h.id === hero.id ? ' gs-codex__hero--on' : ''}`} aria-pressed={h.id === hero.id} onClick={() => onHero(h)}>
            <Pic path={`portraits/${h.id}`} small fallback={HERO_ICON[h.id]} className="gs-pic--inline" /> {h.name}
          </button>
        ))}
      </div>
      <div className="gs-grid gs-codex">
        {WEAPON_IDS.map((id) => {
          const w = WEAPONS[id];
          const own = powerWords(hero.id, id);
          const seen = save.weapons.includes(id);
          const evolved = save.codex.includes(id);
          const partner = PASSIVES[w.evolvesWith];
          return (
            <div key={id} className="gs-pick gs-codex__pair">
              <div className={`gs-codex__page${seen ? '' : ' gs-codex__page--unseen'}`}>
                <span className="gs-pick__icon" aria-hidden="true">{seen ? <Pic path={powerPic(hero.id, id)} small fallback={WEAPON_ICON[id]} className="gs-pic--inline" /> : '❔'}</span>
                <span className="gs-pick__name">{seen ? own.name : 'Not found yet'}</span>
                {seen && <span className="gs-pick__blurb">{own.blurb}</span>}
              </div>
              <span className="gs-codex__plus">
                + <Pic path={`passives/${partner.id}`} small fallback={PASSIVE_ICON[partner.id]} className="gs-pic--inline" /> {partner.name} =
              </span>
              <div className={`gs-codex__page gs-codex__page--evolved${evolved ? '' : ' gs-codex__page--unseen'}`}>
                <span className="gs-pick__icon" aria-hidden="true">{evolved ? <Pic path={powerPic(hero.id, id, true)} small fallback="✨" className="gs-pic--inline" /> : '❔'}</span>
                <span className="gs-pick__name">{evolved ? own.evolved : 'Evolution not made yet'}</span>
                {evolved && <span className="gs-pick__blurb">{own.evolvedBlurb}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
