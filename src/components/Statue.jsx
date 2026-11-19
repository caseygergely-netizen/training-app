import { useEffect, useState } from "react";
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
 *
 * `goldenAsterisk` (Casey, Nov 18, 2026): the win that carried it
 * was won on the spoon boost — the statue wears a giant glowing
 * golden asterisk, with a purely ridiculous amount of shine.
 *
 * Tier unveilings (Casey, Nov 18, 2026): the last tier each browser
 * saw per athlete is remembered (localStorage); when the statue
 * next renders at a DIFFERENT tier, it gets a one-off unveil
 * treatment — a shine sweep and a NEW TIER ribbon — instead of
 * silently swapping. First sight just records the tier. Only
 * CURRENT-status statues watch (`unveilWatch`: the Dashboard hero
 * and the profile cards) — historical statues (Hall of Kings,
 * Cellar, Hall of Shame, recap) legitimately show older tiers for
 * the same athlete, and letting them write the remembered tier made
 * the ribbon fire every time two surfaces disagreed (Casey's
 * bug report, Nov 18, 2026).
 */
export default function Statue({
  athlete,
  reign = 1,
  spoonStreak = 0,
  variant = "card",
  className = "",
  overlay = null,
  sad = false,
  goldenAsterisk = false,
  unveilWatch = false,
}) {
  const loss = sad || Number(spoonStreak) > 0;
  const tier = loss
    ? Math.max(1, Math.min(4, Number(spoonStreak) || 1))
    : Math.max(1, Math.min(5, Number(reign) || 1));
  const url = statueTierUrlFor(athlete, loss ? "loss" : "win", tier);
  const athleteId = athlete?.id || null;
  const tierKey = athleteId ? `${loss ? "l" : "w"}${tier}` : null;
  const [unveil, setUnveil] = useState(false);
  useEffect(() => {
    if (!unveilWatch || !athleteId || !tierKey) return;
    const key = `fomo.statueTier.${athleteId}`;
    try {
      const seen = localStorage.getItem(key);
      if (seen && seen !== tierKey) setUnveil(true);
      localStorage.setItem(key, tierKey);
    } catch {
      /* storage unavailable — no unveil, statue still renders */
    }
  }, [unveilWatch, athleteId, tierKey]);
  if (!url) return null;
  return (
    <figure
      className={`statue statue-${variant} ${loss ? `statue-sad statue-l${tier}` : `statue-t${tier}`}${goldenAsterisk ? " statue-golden" : ""}${unveil ? " statue-unveil" : ""}${className ? ` ${className}` : ""}`}
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
      {goldenAsterisk ? (
        <div className="golden-asterisk" aria-hidden="true">
          *
        </div>
      ) : null}
      {unveil ? (
        <div className="statue-unveil-ribbon" aria-hidden="true">
          ✦ NEW TIER ✦
        </div>
      ) : null}
      {/* No material caption (Casey, Nov 17, 2026): nobody needs a
          label telling them it's a gold statue — the picture says it. */}
      {overlay ? <div className="statue-overlay">{overlay}</div> : null}
    </figure>
  );
}
