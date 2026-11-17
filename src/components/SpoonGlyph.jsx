/**
 * The Spoon, drawn as inline SVG — the Throne crown's mirror at the
 * bottom of the table (Casey, Nov 16, 2026). The glyph escalates with
 * the holder's consecutive last-place streak, paralleling CrownGlyph:
 *   tier 1 — The Spoon: plain steel spoon
 *   tier 2 — The Anchor: the spoon gains a ball weight on the handle
 *   tier 3 — The Cellar Dweller: tarnished, cracked bowl
 *   tier 4 — The Golden Spoon: solid gold, sparkles — the most
 *            decorated spoon is the most shameful one
 * `tier` clamps to 1..4. `width` is px; height follows the viewBox.
 */
export default function SpoonGlyph({ tier = 1, width = 30 }) {
  const t = Math.max(1, Math.min(4, Number(tier) || 1));
  const gold = t >= 4;
  const sparkle = (cx, cy, s) =>
    `${cx},${cy - s} ${cx + s * 0.22},${cy - s * 0.22} ${cx + s},${cy} ` +
    `${cx + s * 0.22},${cy + s * 0.22} ${cx},${cy + s} ` +
    `${cx - s * 0.22},${cy + s * 0.22} ${cx - s},${cy} ${cx - s * 0.22},${cy - s * 0.22}`;
  return (
    <svg
      className={`spoon-glyph tier-${t}`}
      width={width}
      viewBox="0 0 72 60"
      style={{ height: "auto" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="spoonGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffec8a" />
          <stop offset="55%" stopColor="#f2c14e" />
          <stop offset="100%" stopColor="#c8892a" />
        </linearGradient>
        <linearGradient id="spoonSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8edf5" />
          <stop offset="55%" stopColor="#aeb8c8" />
          <stop offset="100%" stopColor="#78839a" />
        </linearGradient>
      </defs>

      {/* handle */}
      <rect
        x="33.4"
        y="26"
        width="5.2"
        height={t >= 2 ? 22 : 26}
        rx="2.6"
        fill={gold ? "url(#spoonGold)" : "url(#spoonSteel)"}
        stroke={gold ? "#8a5a16" : "#4c566b"}
        strokeWidth="0.8"
      />
      {/* bowl */}
      <ellipse
        cx="36"
        cy="16"
        rx="10.5"
        ry="13.5"
        fill={gold ? "url(#spoonGold)" : "url(#spoonSteel)"}
        stroke={gold ? "#8a5a16" : "#4c566b"}
        strokeWidth="1"
      />
      <ellipse
        cx="36"
        cy="16.5"
        rx="6.8"
        ry="9.6"
        fill="none"
        stroke={gold ? "rgba(138,90,22,0.5)" : "rgba(60,70,90,0.45)"}
        strokeWidth="1.1"
      />
      {/* tier 2+: the anchor weight on the handle's end */}
      {t >= 2 && (
        <circle
          cx="36"
          cy="52"
          r="5"
          fill={gold ? "url(#spoonGold)" : "#8b96ab"}
          stroke={gold ? "#8a5a16" : "#4c566b"}
          strokeWidth="0.9"
        />
      )}
      {/* tier 3+: cracks of shame across the bowl */}
      {t >= 3 && (
        <g stroke="rgba(30,34,46,0.65)" strokeWidth="1" fill="none" strokeLinecap="round">
          <path d="M30 8 L33.5 13 L31.5 17" />
          <path d="M42 9 L39.5 14 L41.5 18" />
        </g>
      )}
      {/* tier 4: golden sparkles, because of course it sparkles */}
      {gold && (
        <>
          <polygon className="crown-sparkle" points={sparkle(14, 12, 4.5)} fill="#fff3b0" />
          <polygon className="crown-sparkle s2" points={sparkle(58, 20, 3.6)} fill="#fff3b0" />
        </>
      )}
    </svg>
  );
}
