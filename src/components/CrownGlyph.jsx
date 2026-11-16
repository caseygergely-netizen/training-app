/**
 * The Throne's crown, drawn as inline SVG. The glyph itself escalates
 * with the holder's consecutive reign — more points, more jewels, more
 * regalia every week:
 *   tier 1 — The New King: plain 3-point crown, studded band
 *   tier 2 — The Undisputed: 5 points, first jewels (sapphire, ruby, emerald)
 *   tier 3 — The Dynasty: taller crown, full jewel row, finial orb
 *   tier 4 — The Legend: sunburst rays, sparkles, centre diamond
 *   tier 5 — reign week 5+ (dynasty-tax floor): radiant aura on top
 * `tier` clamps to 1..5. `width` is px; height follows the viewBox.
 */
export default function CrownGlyph({ tier = 1, width = 40 }) {
  const t = Math.max(1, Math.min(5, Number(tier) || 1));
  const sparkle = (cx, cy, s) =>
    `${cx},${cy - s} ${cx + s * 0.22},${cy - s * 0.22} ${cx + s},${cy} ` +
    `${cx + s * 0.22},${cy + s * 0.22} ${cx},${cy + s} ` +
    `${cx - s * 0.22},${cy + s * 0.22} ${cx - s},${cy} ${cx - s * 0.22},${cy - s * 0.22}`;
  return (
    <svg
      className={`crown-glyph tier-${t}`}
      width={width}
      viewBox="0 0 72 60"
      style={{ height: "auto" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffec8a" />
          <stop offset="55%" stopColor="#f2c14e" />
          <stop offset="100%" stopColor="#c8892a" />
        </linearGradient>
      </defs>

      {t >= 4 && (
        <g stroke="#ffd94d" strokeWidth="3" strokeLinecap="round" opacity="0.5">
          <line x1="36" y1="36" x2="36" y2="4" />
          <line x1="36" y1="36" x2="19" y2="8" />
          <line x1="36" y1="36" x2="53" y2="8" />
          <line x1="36" y1="36" x2="7" y2="17" />
          <line x1="36" y1="36" x2="65" y2="17" />
          {t >= 5 && (
            <>
              <line x1="36" y1="36" x2="12" y2="27" opacity="0.7" />
              <line x1="36" y1="36" x2="60" y2="27" opacity="0.7" />
            </>
          )}
        </g>
      )}
      {t >= 5 && (
        <circle
          className="crown-aura"
          cx="36"
          cy="30"
          r="27"
          fill="none"
          stroke="#ffd94d"
          strokeWidth="1.6"
          opacity="0.35"
        />
      )}

      {t === 1 && (
        <>
          <path
            d="M14 44 L12 24 L24 33 L36 16 L48 33 L60 24 L58 44 Z"
            fill="url(#crownGold)"
            stroke="#8a5a16"
            strokeWidth="1"
          />
          <rect x="14" y="44" width="44" height="7" rx="2" fill="#d9a441" stroke="#8a5a16" strokeWidth="1" />
          <circle cx="24" cy="47.5" r="1.7" fill="#fff0b3" opacity="0.85" />
          <circle cx="36" cy="47.5" r="1.7" fill="#fff0b3" opacity="0.85" />
          <circle cx="48" cy="47.5" r="1.7" fill="#fff0b3" opacity="0.85" />
        </>
      )}

      {t === 2 && (
        <>
          <path
            d="M11 45 L9 22 L17 30 L23 17 L30 28 L36 13 L42 28 L49 17 L55 30 L63 22 L61 45 Z"
            fill="url(#crownGold)"
            stroke="#8a5a16"
            strokeWidth="1"
          />
          {[
            [9, 21],
            [23, 16],
            [36, 12],
            [49, 16],
            [63, 21],
          ].map(([cx, cy]) => (
            <circle key={cx} cx={cx} cy={cy} r="1.8" fill="#ffe98a" stroke="#8a5a16" strokeWidth="0.5" />
          ))}
          <rect x="11" y="45" width="50" height="7" rx="2" fill="#d9a441" stroke="#8a5a16" strokeWidth="1" />
          <circle cx="24" cy="48.5" r="2.3" fill="#3a6fd8" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          <circle cx="36" cy="48.5" r="2.8" fill="#e0344c" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          <circle cx="48" cy="48.5" r="2.3" fill="#2fae5f" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
        </>
      )}

      {t >= 3 && (
        <>
          <path
            d="M11 47 L9 20 L17 29 L23 13 L30 26 L36 8 L42 26 L49 13 L55 29 L63 20 L61 47 Z"
            fill="url(#crownGold)"
            stroke="#8a5a16"
            strokeWidth="1"
          />
          {[
            [9, 19],
            [23, 12],
            [49, 12],
            [63, 19],
          ].map(([cx, cy]) => (
            <circle key={cx} cx={cx} cy={cy} r="2" fill="#ffe98a" stroke="#8a5a16" strokeWidth="0.5" />
          ))}
          <circle cx="36" cy="5.5" r="2.6" fill="url(#crownGold)" stroke="#8a5a16" strokeWidth="0.7" />
          <rect x="11" y="47" width="50" height="7" rx="2" fill="#d9a441" stroke="#8a5a16" strokeWidth="1" />
          <circle cx="18" cy="50.5" r="2" fill="#2fae5f" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          <circle cx="27" cy="50.5" r="2.3" fill="#3a6fd8" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          <circle cx="36" cy="50.5" r="3" fill="#e0344c" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          <circle cx="45" cy="50.5" r="2.3" fill="#3a6fd8" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          <circle cx="54" cy="50.5" r="2" fill="#2fae5f" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          {t >= 4 && (
            <polygon
              points="36,33 39.5,38 36,43 32.5,38"
              fill="#eaf6ff"
              stroke="rgba(90,140,190,0.6)"
              strokeWidth="0.6"
            />
          )}
        </>
      )}

      {t >= 4 && (
        <>
          <polygon className="crown-sparkle" points={sparkle(9, 11, 5)} fill="#fff3b0" />
          <polygon className="crown-sparkle s2" points={sparkle(63, 8, 4)} fill="#fff3b0" />
        </>
      )}
      {t >= 5 && (
        <>
          <polygon className="crown-sparkle s3" points={sparkle(13, 31, 3.5)} fill="#fff3b0" />
          <polygon className="crown-sparkle s2" points={sparkle(59, 29, 3.5)} fill="#fff3b0" />
        </>
      )}
    </svg>
  );
}
