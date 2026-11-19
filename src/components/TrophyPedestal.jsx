import { trophyCupUrlFor } from "../lib/statues.js";

/**
 * The Trophy pedestal (Casey, Nov 19, 2026) — the rolling title's
 * display in the Dashboard hero, beside the Throne statue.
 *
 * ISOLATED DISPLAY PIECE: this component, the `trophy-*` /
 * `hero-pedestals` CSS block in index.css, and its wiring in
 * Dashboard.jsx / AthleteProfile.jsx are the whole display. If the
 * layout ever gets reverted, removing those leaves the Trophy's
 * scoring (points.js: trophyState, best-12-of-14) fully intact.
 *
 * Two forms:
 *  - Default: the holder's cup at their current level, face and all.
 *  - Combined (`combinedUrl` set): one athlete holds BOTH titles,
 *    and their coach has published the combined statue-holding-
 *    trophy image to the slot (see useTrophySlot in firestore.js) —
 *    one figure instead of two pedestals.
 */
export default function TrophyPedestal({ holder, combinedUrl = null, throneHolder = null }) {
  if (!holder) return null;
  const { athlete, days, level } = holder;

  if (combinedUrl) {
    return (
      <figure className="trophy-figure trophy-combined">
        <img
          src={combinedUrl}
          alt={`Statue of ${athlete?.name || "the champion"} holding the Trophy`}
          draggable={false}
          loading="lazy"
        />
        <div className="statue-overlay">
          <div className="throne-name">{athlete.name}</div>
          <div className="throne-title">
            👑🏆 The Throne AND the Trophy
            {throneHolder ? ` · ${throneHolder.title}` : ""}
          </div>
          <div className="small" style={{ color: "#d8deea" }}>
            Holds both titles at once — Trophy day {days}, Level {level} cup.
          </div>
        </div>
      </figure>
    );
  }

  const cupUrl = trophyCupUrlFor(athlete, level);
  if (!cupUrl) return null;
  return (
    <figure className="trophy-figure">
      <img
        src={cupUrl}
        alt={`The Trophy, Level ${level}, held by ${athlete?.name || "the rolling leader"}`}
        draggable={false}
        loading="lazy"
      />
      <div className="statue-overlay">
        <div className="throne-name">{athlete.name}</div>
        <div className="throne-title">🏆 The Trophy · Level {level}</div>
        <div className="small" style={{ color: "#d8deea" }}>
          Leads the rolling 14-day board — held for {days} straight day
          {days === 1 ? "" : "s"}.
        </div>
      </div>
    </figure>
  );
}
