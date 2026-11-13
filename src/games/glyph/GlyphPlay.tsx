/** Glyph Gates in the hub, on the school's `glyph` server function (src/data/glyph.ts). */
import { useNavigate } from 'react-router';
import { liveGlyph } from '../../data/glyph';
import { GlyphGame } from './GlyphGame';

export function GlyphPlay() {
  const navigate = useNavigate();
  return <GlyphGame backend={liveGlyph} onExit={() => navigate('/')} />;
}
