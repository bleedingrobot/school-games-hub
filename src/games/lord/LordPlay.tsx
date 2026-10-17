/**
 * Dragon Maths, trial version (docs/LORD-PLAN.md, stage L.3): the screens, played in memory, with the
 * hero kept on this browser only. The server (stage L.4) will hand out and check fights; until then
 * nothing here counts for points, badges or the teacher.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MAX_LEVEL, SKILL_USES_PER_DAY, WEAPONS, expNeeded, masterFor } from '../../../shared/lord/data';
import {
  applyEvent, applyForestResult, applyMasterResult, canChallengeMaster, canFaceDragon, dragonBreather, finishDragon, forestTrip, loseToDragon,
  newHero, nzDate, rollDay, startDragonStage, startFight, startMasterFight, useForestTurn as takeForestTurn,
} from '../../../shared/lord/engine';
import { dragonStageOptions, addMasterTrialBonus, offersSizeItUp, sizeItUpBonus, type Result } from '../../../shared/lord/maths';
import type { FightAction, FightState, ForestEvent, Hero, HeroClass, Monster } from '../../../shared/lord/types';
import { useAuth } from '../../auth/AuthContext';
import { FightScreen } from './Fight';
import { Bank, ClassPick, Healer, HeroPage, Inn, NewsPage, Shop, Training, type PlaceProps } from './Places';
import { HeroSprite, Icon, MonsterSprite } from './Sprite';
import { Tools } from './Tools';
import { clearTrial, loadTrial, saveTrial, type TrialSave } from './storage';
import { withArticle } from './text';
import { useAsk } from './useAsk';
import './lord.css';

const seedNow = () => Math.floor(Math.random() * 4294967296);

type FightContext =
  | { kind: 'forest' }
  | { kind: 'master'; trial: Result[] }
  | { kind: 'dragon'; stage: 1 | 2 | 3; startHp: number };

type Screen =
  | { name: 'village' }
  | { name: 'shop' | 'healer' | 'bank' | 'inn' | 'training' | 'hero' | 'news' | 'tools' }
  | { name: 'event'; event: ForestEvent }
  | { name: 'encounter'; monster: Monster; seed: number }
  | { name: 'fight'; fight: FightState; ctx: FightContext }
  | { name: 'dragon' };

const PLACES: { key: string; name: Screen['name']; label: string; blurb: string }[] = [
  { key: 's', name: 'shop', label: 'Shop', blurb: 'Weapons and armour' },
  { key: 'h', name: 'healer', label: 'Healer', blurb: 'Mend your wounds' },
  { key: 'b', name: 'bank', label: 'Bank', blurb: 'Keep your gold safe' },
  { key: 'i', name: 'inn', label: 'Inn', blurb: 'Songs, riddles and a game' },
  { key: 't', name: 'training', label: 'Training grounds', blurb: 'Challenge your master' },
  { key: 'n', name: 'news', label: 'Daily news', blurb: 'What happened' },
  { key: 'y', name: 'hero', label: 'Your hero', blurb: 'Stats and gear' },
];

export function LordPlay() {
  const { profile } = useAuth();
  const player = profile?.id ?? '';
  const heroName = profile?.display_name ?? 'You';
  const [save, setSave] = useState<TrialSave>(() => loadTrial(player));
  const [screen, setScreen] = useState<Screen>({ name: 'village' });
  const [note, setNote] = useState('');
  const { hero } = save;
  const today = nzDate(new Date(Date.now() + save.dayOffset * 86_400_000));
  const { ask, modal } = useAsk(hero?.level ?? 1);

  const latest = useRef(save);
  latest.current = save;
  function update(change: Partial<TrialSave> | ((s: TrialSave) => Partial<TrialSave>)) {
    const next = { ...latest.current, ...(typeof change === 'function' ? change(latest.current) : change) };
    latest.current = next;
    setSave(next);
    saveTrial(player, next);
  }
  const setHero = (h: Hero) => update({ hero: h });
  const addNews = (line: string) => update((s) => ({ news: [line, ...s.news].slice(0, 12) }));
  const say = (text: string) => setNote(text);

  // A new day gives the turns and full health back, the first time you play (like LORD).
  useEffect(() => {
    if (hero && hero.day !== today) {
      update({ hero: rollDay(hero, today) });
      setNote('A new day dawns. Your health and your turns are back!');
    }
  }, [today, hero?.day]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape goes back to the village from any place.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !['village', 'fight'].includes(screen.name) && !document.querySelector('.question')) setScreen({ name: 'village' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen.name]);

  if (!hero) {
    return (
      <Frame>
        <ClassPick onPick={(c: HeroClass) => update({ hero: newHero(c, today), news: ['Your adventure begins!'] })} />
      </Frame>
    );
  }

  const toVillage = () => setScreen({ name: 'village' });
  const placeProps: PlaceProps = { hero, setHero, ask, say, addNews, back: toVillage, today };

  // ---------------------------------------------------------------- forest

  function goForest() {
    if (hero!.hp <= 0) return say('You are too hurt to go into the forest. See the healer.');
    if (hero!.forestLeft <= 0) return say('You have used all your forest fights today. Come back tomorrow, or visit the village.');
    const trip = forestTrip(hero!, seedNow());
    if (trip.kind === 'event') setScreen({ name: 'event', event: trip.event });
    else {
      setHero(takeForestTurn(hero!));
      setScreen({ name: 'encounter', monster: trip.monster, seed: trip.seed });
    }
  }

  async function beginFight(monster: Monster, seed: number, sizeUp: boolean) {
    let bonus = 1;
    if (sizeUp) {
      const asked = await ask('size-it-up', { title: `Size up the ${monster.name}`, note: 'A right answer finds its weak spot: your first hit is bigger.', closeLabel: 'Skip, just fight' });
      bonus = asked === 'skipped' ? 1 : sizeItUpBonus(asked);
    }
    setScreen({ name: 'fight', fight: startFight(latest.current.hero!, monster, seed, { firstHitBonus: bonus }), ctx: { kind: 'forest' } });
  }

  async function resolveEvent(event: ForestEvent) {
    let right = false;
    if (event.maths) {
      const asked = await ask('treasure', { title: event.title, note: event.text, pack: event.maths.topic, closeLabel: 'Walk on' });
      right = asked === 'right';
      say(asked === 'skipped' ? 'You walk on. Maybe next time!' : right ? 'You solved it!' : 'Not this time, but you know the answer now.');
    }
    const next = applyEvent(latest.current.hero!, event, right);
    setHero(next);
    addNews(`${event.title}: ${event.text.split('.')[0]}.`);
    if (!event.maths) say(eventSummary(event));
    toVillage();
  }

  // ---------------------------------------------------------------- masters and the dragon

  async function challengeMaster() {
    const check = canChallengeMaster(hero!);
    if (!check.ok) return say(check.reason ?? '');
    const master = masterFor(hero!.level)!;
    const trial: Result[] = [];
    for (let i = 1; i <= 3; i++) {
      const asked = await ask('master-trial', {
        title: `${master.name}’s trial`,
        note: `Question ${i} of 3. Each right answer adds a little strength if you win.`,
        closeLabel: 'Skip this one',
      });
      trial.push(asked === 'right' ? 'right' : 'wrong');
    }
    setScreen({ name: 'fight', fight: startMasterFight(latest.current.hero!, seedNow()), ctx: { kind: 'master', trial } });
  }

  async function beginDragonStage(stage: 1 | 2 | 3, startHp: number) {
    const asked = await ask('dragon-trial', {
      title: `The dragon’s riddle ${stage} of 3`,
      note: 'Right answers give you a shield and a heavy first hit. Wrong answers cost you nothing, and the fight still goes on.',
      closeLabel: 'Skip',
    });
    const options = dragonStageOptions(asked === 'right' || asked === 'wrong' ? asked : 'wrong');
    setScreen({ name: 'fight', fight: startDragonStage(latest.current.hero!, stage, seedNow(), { ...options, heroHp: startHp }), ctx: { kind: 'dragon', stage, startHp } });
  }

  function finishFight(fight: FightState, ctx: FightContext) {
    const h = latest.current.hero!;
    if (ctx.kind === 'forest') {
      setHero(applyForestResult(h, fight));
      if (fight.outcome === 'won') {
        addNews(`You beat the ${fight.monster.name}.`);
        const after = applyForestResult(h, fight);
        say(after.level < MAX_LEVEL && canChallengeMaster(after).ok ? `You beat the ${fight.monster.name}! You have enough experience to challenge your master.` : `You beat the ${fight.monster.name}!`);
      } else if (fight.outcome === 'lost') {
        addNews(`${withArticle(fight.monster.name).replace(/^a/, 'A')} flattened you.`);
        say('You wake up at the healer’s hut. You dropped the gold you were carrying, but your experience and your bank are safe.');
      } else say('You got away safely.');
      return toVillage();
    }
    if (ctx.kind === 'master') {
      const master = masterFor(h.level)!;
      let next = applyMasterResult(h, fight);
      if (fight.outcome === 'won') {
        next = addMasterTrialBonus(next, ctx.trial);
        addNews(`You beat ${master.name} and reached level ${next.level}!`);
        say(`You beat ${master.name}! You are level ${next.level} and you feel stronger.${ctx.trial.includes('right') ? ' Your right answers added extra strength.' : ''}`);
      } else say(`${master.name} won this time. Nothing is lost: you are healed and can try again tomorrow.`);
      setHero(next);
      return toVillage();
    }
    // The dragon
    const carried = { ...h, skillLeft: fight.skillLeft };
    if (fight.outcome !== 'won') {
      setHero(loseToDragon(carried));
      addNews('The Red Dragon sent you home.');
      say('The dragon was too strong today. You wake at the healer’s hut. Nothing is lost. Try again tomorrow!');
      return toVillage();
    }
    if (ctx.stage < 3) {
      setHero(carried);
      void beginDragonStage((ctx.stage + 1) as 2 | 3, dragonBreather(h, fight.heroHp));
      return;
    }
    setHero(finishDragon(carried, today));
    addNews(`You beat the Red Dragon! That is star number ${h.dragonKills + 1}.`);
    say('You beat the Red Dragon! The village treasure, food and light are back. Your hero starts again at level 1, with a gold star.');
    toVillage();
  }

  function onFightChange(next: FightState, ctx: FightContext) {
    setScreen({ name: 'fight', fight: next, ctx });
  }

  // ---------------------------------------------------------------- screens

  let body: ReactNode;
  switch (screen.name) {
    case 'shop': body = <Shop {...placeProps} />; break;
    case 'healer': body = <Healer {...placeProps} />; break;
    case 'bank': body = <Bank {...placeProps} interestDay={save.interestDay} setInterestDay={(d) => update({ interestDay: d })} />; break;
    case 'inn':
      body = <Inn {...placeProps} riddleDay={save.riddleDay} setRiddleDay={(d) => update({ riddleDay: d })} guessDay={save.guessDay} setGuessDay={(d) => update({ guessDay: d })} />;
      break;
    case 'training': body = <Training hero={hero} back={toVillage} onChallenge={() => void challengeMaster()} onDragon={() => setScreen({ name: 'dragon' })} />; break;
    case 'hero': body = <HeroPage hero={hero} back={toVillage} />; break;
    case 'news': body = <NewsPage news={save.news} today={today} back={toVillage} />; break;
    case 'tools':
      body = (
        <Tools
          hero={hero} setHero={setHero} close={toVillage} showEvent={(event) => setScreen({ name: 'event', event })}
          skipDay={() => { update((s) => ({ dayOffset: s.dayOffset + 1 })); setNote('Skipped to tomorrow.'); }}
          resetAll={() => { clearTrial(player); update({ hero: null, news: [], dayOffset: 0, riddleDay: '', guessDay: '', interestDay: '' }); toVillage(); }}
        />
      );
      break;
    case 'event':
      body = (
        <section className="lord-place" aria-label={screen.event.title}>
          <h2>{screen.event.title}</h2>
          <p className="lord-lead">{screen.event.text}</p>
          <p className="lord-soft">Events do not use up a forest fight.</p>
          <button type="button" className="lord-btn lord-btn--hot" autoFocus onClick={() => void resolveEvent(screen.event)}>
            {screen.event.maths ? 'Have a go' : 'Continue'}
          </button>
        </section>
      );
      break;
    case 'encounter': {
      const sizeUp = offersSizeItUp(screen.seed);
      body = (
        <section className="lord-place lord-encounter" aria-label="A monster appears">
          <MonsterSprite monster={screen.monster} scale={9} />
          <h2>{withArticle(screen.monster.name).replace(/^a/, 'A')} appears!</h2>
          <p className="lord-lead">{screen.monster.intro}</p>
          <div className="lord-actions">
            {sizeUp && <button type="button" className="lord-btn lord-btn--hot" onClick={() => void beginFight(screen.monster, screen.seed, true)}>Size it up (a maths question)</button>}
            <button type="button" className={`lord-btn${sizeUp ? '' : ' lord-btn--hot'}`} autoFocus={!sizeUp} onClick={() => void beginFight(screen.monster, screen.seed, false)}>Fight!</button>
          </div>
        </section>
      );
      break;
    }
    case 'fight': {
      const { fight, ctx } = screen;
      body = <FightScreen key={fight.monster.id + fight.kind + (ctx.kind === 'dragon' ? ctx.stage : '')} fight={fight} heroName={heroName}
        onChange={(next: FightState, _action: FightAction) => onFightChange(next, ctx)} onContinue={() => finishFight(fight, ctx)} />;
      break;
    }
    case 'dragon':
      body = (
        <section className="lord-place lord-encounter" aria-label="The Red Dragon">
          <MonsterSprite monster={{ id: 'dragon-1', name: 'Scorchtail, the Red Dragon', level: 13 }} scale={10} />
          <h2>The Red Dragon’s lair</h2>
          <p className="lord-lead">
            The dragon has the village’s treasure, food and light. There are three fights, with a riddle before each one and a short rest between. You can’t run. If it goes badly, you wake at the healer and lose nothing but today’s try.
          </p>
          <div className="lord-actions">
            <button type="button" className="lord-btn lord-btn--hot" onClick={() => void beginDragonStage(1, hero.hp)}>Go in</button>
            <button type="button" className="lord-btn" onClick={toVillage}>Not yet</button>
          </div>
        </section>
      );
      break;
    default:
      body = (
        <Village hero={hero} note={note} onPlace={(n) => { setNote(''); setScreen({ name: n } as Screen); }} onForest={goForest}
          onDragon={() => setScreen({ name: 'dragon' })} today={today} />
      );
  }

  const keysOn = screen.name === 'village';
  return (
    <Frame hero={hero} hideStatus={screen.name === 'fight'}>
      {keysOn && <VillageKeys onKey={(k) => {
        if (k === 'f') goForest();
        else if (k === 'd' && canFaceDragon(hero)) setScreen({ name: 'dragon' });
        else if (k === 'x') setScreen({ name: 'tools' });
        else { const p = PLACES.find((x) => x.key === k); if (p) { setNote(''); setScreen({ name: p.name } as Screen); } }
      }} />}
      {body}
      {modal}
    </Frame>
  );
}

function eventSummary(e: ForestEvent) {
  const bits = [e.gold && `${e.gold} gold`, e.exp && `${e.exp} experience`, e.gems && `${e.gems} gem`, e.heal === 'full' && 'full health', e.kindness && 'kindness'].filter(Boolean);
  return bits.length ? `You gained: ${bits.join(', ')}. (Rewards grow with your level.)` : '';
}

function VillageKeys({ onKey }: { onKey: (key: string) => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest('input,select,textarea')) return;
      if (document.querySelector('.question')) return;
      onKey(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  return null;
}

function Frame({ children, hero, hideStatus }: { children: ReactNode; hero?: Hero; hideStatus?: boolean }) {
  return (
    <div className="lord" data-testid="lord">
      <header className="lord-top">
        <h1>Dragon Maths</h1>
        <span className="lord-trial">Trial: saved on this browser only, no points yet</span>
      </header>
      {hero && !hideStatus && <StatusBar hero={hero} />}
      {children}
      <footer className="lord-credits">Based on the rules of Legend of the Red Dragon. Pictures: Kenney 1-Bit Pack (CC0).</footer>
    </div>
  );
}

function StatusBar({ hero }: { hero: Hero }) {
  const need = expNeeded(hero.level);
  return (
    <ul className="lord-status" aria-label="Your hero at a glance">
      <li>Level <strong>{hero.level}</strong></li>
      <li><Icon name="heart" scale={1} colour="#ff5555" /> <strong>{hero.hp}</strong> / {hero.maxHp}</li>
      <li><Icon name="gold" scale={1} /> <strong>{hero.gold}</strong> <span className="lord-soft">(bank {hero.bank})</span></li>
      <li>Exp <strong>{hero.exp}</strong>{Number.isFinite(need) ? ` / ${need}` : ''}</li>
      <li>Forest fights <strong>{hero.forestLeft}</strong></li>
      <li>Skills <strong>{hero.skillLeft}</strong> / {SKILL_USES_PER_DAY}</li>
      {hero.dragonKills > 0 && <li>{'★'.repeat(Math.min(hero.dragonKills, 5))}</li>}
    </ul>
  );
}

function Village({ hero, note, onPlace, onForest, onDragon, today }: {
  hero: Hero; note: string; onPlace: (n: Screen['name']) => void; onForest: () => void; onDragon: () => void; today: string;
}) {
  const check = canChallengeMaster(hero);
  const dragonReady = canFaceDragon(hero);
  return (
    <section className="lord-village" aria-label="The village">
      <div className="lord-village__intro">
        <HeroSprite heroClass={hero.heroClass} scale={6} />
        <div>
          <h2>The village of Hollowbrook</h2>
          <p className="lord-soft">{today}. {hero.forestLeft > 0 ? `You have ${hero.forestLeft} forest fights left today.` : 'No forest fights left today. The village is still open!'}</p>
          {note && <p className="lord-note" role="status">{note}</p>}
          {check.ok && <p className="lord-note">Your master is ready to fight you. Visit the Training grounds!</p>}
        </div>
      </div>
      <div className="lord-menu">
        <button type="button" className="lord-place-btn lord-place-btn--forest" onClick={onForest} disabled={hero.forestLeft <= 0}>
          <kbd>F</kbd> <strong>The Forest</strong> <span>Fight monsters, find gold</span>
        </button>
        {dragonReady && (
          <button type="button" className="lord-place-btn lord-place-btn--dragon" onClick={onDragon}>
            <kbd>D</kbd> <strong>The Red Dragon</strong> <span>You are ready</span>
          </button>
        )}
        {PLACES.map((p) => (
          <button key={p.name} type="button" className="lord-place-btn" onClick={() => onPlace(p.name)}>
            <kbd>{p.key.toUpperCase()}</kbd> <strong>{p.label}</strong> <span>{p.blurb}</span>
          </button>
        ))}
        <button type="button" className="lord-place-btn lord-place-btn--tools" onClick={() => onPlace('tools')}>
          <kbd>X</kbd> <strong>Test tools</strong> <span>For trying things out</span>
        </button>
      </div>
      <p className="lord-soft">Your weapon: {WEAPONS[hero.weapon].name}.</p>
    </section>
  );
}
