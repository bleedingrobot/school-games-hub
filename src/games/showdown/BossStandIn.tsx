/** An original drawn River Titan for the projector until the painted one lands: a giant of river boulders and moss with glowing water eyes. */
export function BossStandIn({ phase, flinch = false, weak = false, angry = false, look = 0 }: { phase: 1 | 2 | 3; flinch?: boolean; weak?: boolean; angry?: boolean; look?: -1 | 0 | 1 }) {
  const eye = phase === 1 ? '#7fe3ff' : phase === 2 ? '#ffb347' : '#ff6a5c';
  const cracks = phase >= 2;
  const broken = phase === 3;
  return (
    <svg className={`sd-p-standin sd-p-standin--${phase}${flinch ? ' sd-p-flinch' : ''}${angry ? ' sd-p-standin--angry' : ''}`} viewBox="0 0 400 440" role="img" aria-label="The River Titan">
      <defs>
        <radialGradient id="sdp-rock" cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#8a97a0" /><stop offset="0.6" stopColor="#5c6b73" /><stop offset="1" stopColor="#38444b" /></radialGradient>
        <radialGradient id="sdp-rock2" cx="35%" cy="25%" r="85%"><stop offset="0" stopColor="#9aa7ab" /><stop offset="1" stopColor="#46535a" /></radialGradient>
        <linearGradient id="sdp-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bdf0ff" stopOpacity="0.95" /><stop offset="1" stopColor="#3aa0d8" stopOpacity="0.55" /></linearGradient>
        <radialGradient id="sdp-core" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff7c2" /><stop offset="0.5" stopColor="#ffd23f" /><stop offset="1" stopColor="#ff8a1f" stopOpacity="0" /></radialGradient>
        <filter id="sdp-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <ellipse cx="200" cy="420" rx="150" ry="16" fill="#0a1a26" opacity="0.5" />
      {/* legs */}
      <g>
        <ellipse cx="140" cy="380" rx="52" ry="42" fill="url(#sdp-rock)" />
        <ellipse cx="262" cy="382" rx="54" ry="40" fill="url(#sdp-rock)" />
        <ellipse cx="120" cy="404" rx="34" ry="18" fill="url(#sdp-rock2)" />
        <ellipse cx="284" cy="404" rx="36" ry="18" fill="url(#sdp-rock2)" />
      </g>
      {/* arms */}
      <g className="sd-p-standin__arm sd-p-standin__arm--l">
        <ellipse cx="66" cy="210" rx="40" ry="60" fill="url(#sdp-rock2)" />
        {!broken && <ellipse cx="52" cy="290" rx="44" ry="40" fill="url(#sdp-rock)" />}
        {broken && <ellipse cx="60" cy="262" rx="26" ry="22" fill="url(#sdp-rock)" />}
        <ellipse cx="46" cy="276" rx="12" ry="8" fill="#6f9a5a" opacity="0.9" />
      </g>
      <g className="sd-p-standin__arm sd-p-standin__arm--r">
        <ellipse cx="336" cy="210" rx="40" ry="60" fill="url(#sdp-rock2)" />
        <ellipse cx="350" cy="292" rx="46" ry="42" fill="url(#sdp-rock)" />
        <ellipse cx="362" cy="278" rx="14" ry="8" fill="#6f9a5a" opacity="0.9" />
      </g>
      {/* waterfalls off the shoulders */}
      <g className="sd-p-standin__falls">
        <rect x="60" y="150" width="22" height="200" rx="11" fill="url(#sdp-water)" />
        <rect x="318" y="150" width="22" height="200" rx="11" fill="url(#sdp-water)" />
      </g>
      {/* belly and chest */}
      <g className="sd-p-standin__body">
        <ellipse cx="200" cy="290" rx="112" ry="110" fill="url(#sdp-rock)" />
        <ellipse cx="150" cy="260" rx="46" ry="38" fill="url(#sdp-rock2)" />
        <ellipse cx="250" cy="300" rx="50" ry="40" fill="url(#sdp-rock2)" />
        <ellipse cx="200" cy="350" rx="62" ry="34" fill="url(#sdp-rock2)" />
        <ellipse cx="170" cy="230" rx="30" ry="14" fill="#6f9a5a" opacity="0.85" />
        <ellipse cx="262" cy="338" rx="26" ry="11" fill="#5f8a4c" opacity="0.85" />
        <ellipse cx="146" cy="330" rx="22" ry="9" fill="#78a463" opacity="0.8" />
        {phase >= 3 && <circle cx="200" cy="290" r="38" fill="url(#sdp-core)" className="sd-p-standin__core" filter="url(#sdp-glow)" />}
        {cracks && (
          <g className="sd-p-standin__cracks" fill="none" stroke={phase === 3 ? '#ffd23f' : '#9be7ff'} strokeWidth="4" strokeLinecap="round" filter="url(#sdp-glow)">
            <path d="M160 215 L180 250 L164 280 L188 320" />
            <path d="M262 230 L240 262 L258 296 L236 336" />
            <path d="M120 300 L146 318 L140 348" />
          </g>
        )}
      </g>
      {/* head */}
      <g className="sd-p-standin__head">
        <ellipse cx="200" cy="130" rx="72" ry="66" fill="url(#sdp-rock2)" />
        {/* reed and driftwood crown */}
        <g stroke="#b79a5b" strokeWidth="7" strokeLinecap="round" fill="none">
          <path d="M146 88 L128 36" /><path d="M166 76 L158 20" /><path d="M200 70 L200 12" /><path d="M234 76 L244 22" /><path d="M254 88 L274 38" />
        </g>
        <g fill="#7fae5b"><ellipse cx="128" cy="34" rx="6" ry="12" /><ellipse cx="158" cy="18" rx="6" ry="12" /><ellipse cx="200" cy="10" rx="6" ry="12" /><ellipse cx="244" cy="20" rx="6" ry="12" /><ellipse cx="274" cy="36" rx="6" ry="12" /></g>
        <ellipse cx="170" cy="92" rx="26" ry="9" fill="#6f9a5a" opacity="0.85" />
        {/* brow */}
        <path d={angry || phase >= 2 ? 'M148 118 L190 134 M252 118 L210 134' : 'M148 124 L190 128 M252 124 L210 128'} stroke="#2c373d" strokeWidth="9" strokeLinecap="round" />
        {/* water eyes */}
        <g style={{ transform: `translateX(${look * 9}px)`, transition: 'transform 0.6s ease-out' }}>
        <g className="sd-p-standin__eyes" filter="url(#sdp-glow)">
          <ellipse cx="170" cy="144" rx="15" ry={phase >= 2 ? 10 : 13} fill={eye} />
          <ellipse cx="230" cy="144" rx="15" ry={phase >= 2 ? 10 : 13} fill={eye} />
        </g>
        <circle cx="170" cy="144" r="4" fill="#06202e" /><circle cx="230" cy="144" r="4" fill="#06202e" />
        </g>
        {/* mouth */}
        {phase === 1 && <path d="M170 176 Q200 190 230 176" stroke="#2c373d" strokeWidth="7" fill="none" strokeLinecap="round" />}
        {phase >= 2 && <path className="sd-p-standin__mouth" d="M166 172 Q200 206 234 172 Q200 184 166 172 Z" fill="#14232c" stroke="#2c373d" strokeWidth="4" />}
      </g>
      {/* weak spot: a glowing patch on the chest */}
      {weak && <g className="sd-p-standin__weak" filter="url(#sdp-glow)"><circle cx="200" cy="262" r="26" fill="none" stroke="#fff27a" strokeWidth="6" /><circle cx="200" cy="262" r="9" fill="#fff27a" /></g>}
    </svg>
  );
}
