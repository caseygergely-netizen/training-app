import { statueUrlFor, statueMaterialFor } from "../lib/statues.js";

/**
 * The Throne statue (Casey, Nov 16, 2026): the holder's generated
 * statue portrait, material escalating with the reign — week 1
 * bronze → week 2 silver → week 3 gold → week 4 radiant gold →
 * week 5+ eternal radiant (pulsing aura). Materials are CSS filters
 * over the one gold master portrait (see statues.js); the frame and
 * glow escalate alongside. Renders nothing for an athlete with no
 * statue asset, so callers can fall back to the plain Avatar.
 * Variants: "card" (Throne card / profile), "hall" (Hall of Kings
 * strip), "recap" (Monday recap modal).
 */
export default function Statue({
  athlete,
  reign = 1,
  variant = "card",
  className = "",
}) {
  const url = statueUrlFor(athlete);
  if (!url) return null;
  const tier = Math.max(1, Math.min(5, Number(reign) || 1));
  return (
    <figure
      className={`statue statue-${variant} statue-t${tier}${className ? ` ${className}` : ""}`}
    >
      <img
        src={url}
        alt={`Statue of ${athlete?.name || "the champion"}`}
        draggable={false}
        loading="lazy"
      />
      <figcaption>{statueMaterialFor(tier)} statue</figcaption>
    </figure>
  );
}
