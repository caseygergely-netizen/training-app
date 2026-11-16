import { avatarUrlFor } from "../lib/avatars.js";
import CrownGlyph from "./CrownGlyph.jsx";

export function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Athlete avatar: bundled photo when one exists, initials otherwise.
 * When the athlete currently holds the Throne, pass `reign` (their
 * reign length in weeks) — the avatar gains a crown overlay and a
 * frame that escalates with the title tier: bronze (The New King) →
 * gold (The Undisputed) → bright gold (The Dynasty) → radiant
 * (The Legend). The crown GLYPH escalates too (CrownGlyph tiers 1–5):
 * more points, more jewels, more regalia each consecutive week.
 * `crownScale` sizes the crown relative to the avatar (the Dashboard
 * Throne card passes a bigger scale so the regalia can show off).
 */
export default function Avatar({
  athlete,
  size = 36,
  reign = 0,
  crownScale = 0.62,
  className = "",
  title,
}) {
  const url = avatarUrlFor(athlete);
  const tier = reign > 0 ? Math.min(reign, 4) : 0;
  const crownTier = reign > 0 ? Math.min(reign, 5) : 0;
  return (
    <span
      className={`avatar frame-${tier}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      title={title || athlete?.name || ""}
    >
      <span className="avatar-face">
        {url ? (
          <img src={url} alt={athlete?.name || "Athlete"} draggable={false} />
        ) : (
          <span
            className="avatar-initials"
            style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
          >
            {initialsOf(athlete?.name)}
          </span>
        )}
      </span>
      {crownTier > 0 && (
        <span className="avatar-crown" aria-hidden="true">
          <CrownGlyph tier={crownTier} width={Math.round(size * crownScale)} />
        </span>
      )}
    </span>
  );
}
