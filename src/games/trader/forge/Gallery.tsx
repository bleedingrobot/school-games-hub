/**
 * The class gallery (docs/TRADER-SYSTEM-PLAN.md, section 7): every classmate's solar system with a built sun, own first,
 * each with its still picture. Tap one to visit it in full screen (look only). Visitors leave one of six stickers; the
 * owner sees the counts, never who. Classmates only (the server checks).
 */
import { useEffect, useState } from 'react';
import { STICKERS, type GalleryEntry, type StickerId } from '../../../../shared/trader/gallery';
import { describeSystem, pieceName } from '../../../../shared/trader/system';
import type { TraderApi } from '../../../data/trader';
import { FullscreenView } from './Fullscreen';
import { SUN_LOOK } from './looks';

export function Gallery({ api, lessMotion }: { api: TraderApi; lessMotion: boolean }) {
  const [systems, setSystems] = useState<GalleryEntry[] | null>(null);
  const [problem, setProblem] = useState('');
  const [said, setSaid] = useState('');
  const [visit, setVisit] = useState<{ entry: GalleryEntry; container: HTMLElement; from: HTMLButtonElement } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setProblem('');
    const r = await api.gallery();
    if (r.ok) setSystems(r.value.systems);
    else setProblem(r.message);
  }
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function give(entry: GalleryEntry, sticker: StickerId) {
    const next = entry.stickers === sticker ? null : sticker;
    const name = systemName(entry);
    setSaving(entry.id);
    const r = await api.sticker(entry.id, next);
    setSaving(null);
    if (!r.ok) return setSaid(r.message);
    setSystems((list) => list?.map((e) => (e.id === entry.id ? { ...e, stickers: next } : e)) ?? list);
    const s = STICKERS.find((x) => x.id === sticker)!;
    setSaid(next ? `You gave ${name} a ${s.name} sticker.` : `You took back your sticker on ${name}.`);
  }

  const mine = systems?.find((s) => s.mine);
  const others = systems?.filter((s) => !s.mine) ?? [];
  return (
    <section className="st-panel stg" aria-labelledby="stg-h">
      <h2 id="stg-h" className="st-h">🌌 Class gallery</h2>
      <p className="st-sub">Your classmates&apos; solar systems. Tap one to visit it, and leave a sticker on the ones you like.</p>
      {problem && (
        <div className="st-warn" role="alert">
          {problem} <button type="button" className="st-btn st-btn--small" onClick={() => void load()}>Try again</button>
        </div>
      )}
      {!systems && !problem && <p className="st-soft" role="status">Opening the gallery…</p>}
      {systems && !mine && <p className="st-card stg-hint">Build your sun in the Forge and your system will be here too.</p>}
      {systems && !others.length && <p className="st-soft">No classmates have built a sun yet. Check back soon!</p>}
      {systems && systems.length > 0 && (
        <ul className="stg-grid">
          {systems.map((entry) => (
            <GalleryCard
              key={entry.id}
              entry={entry}
              saving={saving === entry.id}
              onOpen={(from) => setVisit({ entry, from, container: from.closest<HTMLElement>('.st-root') ?? document.body })}
              onSticker={(s) => void give(entry, s)}
            />
          ))}
        </ul>
      )}
      <p className="st-sr" role="status">{said}</p>
      {said && <p className="stg-said" aria-hidden="true">{said}</p>}
      {visit && (
        <FullscreenView
          design={visit.entry.design}
          lessMotion={lessMotion}
          visiting={!visit.entry.mine}
          container={visit.container}
          onClose={() => {
            const from = visit.from;
            setVisit(null);
            window.setTimeout(() => from.focus(), 0);
          }}
        />
      )}
    </section>
  );
}

const systemName = (e: GalleryEntry): string => `the ${pieceName(e.design)} System`;

function GalleryCard({ entry, saving, onOpen, onSticker }: {
  entry: GalleryEntry;
  saving: boolean;
  onOpen: (from: HTMLButtonElement) => void;
  onSticker: (s: StickerId) => void;
}) {
  const [broken, setBroken] = useState(false);
  const name = `The ${pieceName(entry.design)} System`;
  const sun = entry.design.sun ? SUN_LOOK[entry.design.sun.kind] : null;
  const words = `stg-words-${entry.id}`;
  const counts = entry.mine && entry.stickers && typeof entry.stickers === 'object' ? entry.stickers : {};
  const given = !entry.mine && typeof entry.stickers === 'string' ? entry.stickers : null;
  const got = STICKERS.filter((s) => (counts[s.id] ?? 0) > 0);
  return (
    <li className={`stg-card ${entry.mine ? 'is-mine' : ''}`}>
      <button type="button" className="stg-open" aria-label={`Visit ${name}${entry.mine ? ', yours' : `, by ${entry.name}`}`} aria-describedby={words} onClick={(e) => onOpen(e.currentTarget)}>
        {entry.picture && !broken ? (
          <img className="stg-pic" src={entry.picture} alt="" width={512} height={288} loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <span className="stg-pic stg-pic--plain" aria-hidden="true">
            <span className="stg-pic__sun" style={{ background: sun?.colour }}>{sun?.emoji}</span>
            <span className="stg-pic__note">No picture yet</span>
          </span>
        )}
        <span className="stg-name">{name}</span>
        <span className="stg-by">{entry.mine ? <strong className="stg-yours">⭐ Yours</strong> : entry.name}</span>
      </button>
      <p id={words} className="st-sr">{describeSystem(entry.design)}</p>
      {entry.mine ? (
        got.length ? (
          <p className="stg-counts" aria-label={`Stickers on your system: ${got.map((s) => `${counts[s.id]} ${s.name}`).join(', ')}`}>
            {got.map((s) => <span key={s.id} className="stg-count" title={s.name}><span aria-hidden="true">{s.emoji}</span> {counts[s.id]}</span>)}
          </p>
        ) : (
          <p className="stg-counts st-soft">No stickers yet.</p>
        )
      ) : (
        <div className="stg-stickers" role="group" aria-label={`Leave a sticker on ${name}`}>
          {STICKERS.map((s) => (
            <button key={s.id} type="button" className={`stg-sticker ${given === s.id ? 'is-on' : ''}`} aria-pressed={given === s.id} aria-label={s.name} title={s.name} disabled={saving} onClick={() => onSticker(s.id)}>
              <span aria-hidden="true">{s.emoji}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
