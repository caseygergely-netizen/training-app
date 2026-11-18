import { statueTierUrlFor } from "../lib/statues.js";

/**
 * The tiered statue (Casey, Nov 16–17, 2026): each athlete has a
 * ladder of generated statue portraits (see lib/statues.js), and the
 * streak picks the portrait — no CSS material filters any more, the
 * image itself escalates:
 *   Win side — `reign` (consecutive weekly wins): T1 gold → T2
 *   bright gold → T3 platinum → T4 radiant gold → T5 diamond.
 *   Loss side — `spoonStreak` (consecutive last-place finishes):
 *   L1 sad gold → L2 tarnished bronze → L3 corroded → L4 cracked
 *   clay. The legacy `sad` prop renders L1.
 * The frame/glow classes still escalate alongside (statue-t1..t5,
 * statue-l1..l4). Renders nothing for an athlete with no statue
 * asset, so callers can fall back to the plain Avatar.
 * Variants: "card" (Throne card / profile), "hall" (Hall of Kings /
 * Cellar strip), "recap" (Monday recap modal), "hero" (the
 * Dashboard's Throne hero — full-width, with the holder's name /
 * title / tax as an overlay bar on the image; pass the bar as
 * `overlay`).
 */
export default function Statue({
  athlete,
  reign = 1,
  spoonStreak = 0,
  variant = "card",
  className = "",
  overlay = null,
  sad = false,
}) {
  const loss = sad || Number(spoonStreak) > 0;
  const tier = loss
    ? Math.max(1, Math.min(4, Number(spoonStreak) || 1))
    : Math.max(1, Math.min(5, Number(reign) || 1));
  const url = statueTierUrlFor(athlete, loss ? "loss" : "win", tier);
  if (!url) return null;
  return (
    <figure
      className={`statue statue-${variant} ${loss ? `statue-sad statue-l${tier}` : `statue-t${tier}`}${className ? ` ${className}` : ""}`}
    >
      <img
        src={url}
        alt={
          loss
            ? `Pathetic statue of ${athlete?.name || "the spoon holder"}`
            : `Statue of ${athlete?.name || "the champion"}`
        }
        draggable={false}
        loading="lazy"
      />
      {/* No material caption (Casey, Nov 17, 2026): nobody needs a
          label telling them it's a gold statue — the picture says it. */}
      {overlay ? <div className="statue-overlay">{overlay}</div> : null}
    </figure>
  );
}
