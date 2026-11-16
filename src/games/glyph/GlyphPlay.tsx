/** Glyph Gates in the hub, on the school's `glyph` server function (src/data/glyph.ts). Back goes to the Activities page. */
import { useNavigate } from 'react-router';
import { liveGlyph } from '../../data/glyph';
import { GlyphGame } from './GlyphGame';

export function GlyphPlay() {
  const navigate = useNavigate();
  return <GlyphGame backend={liveGlyph} onExit={() => navigate('/activities')} />;
}
