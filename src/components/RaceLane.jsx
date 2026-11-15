import { avatarUrlFor } from "../lib/avatars.js";
import { initialsOf } from "./Avatar.jsx";

export const LANE_COLORS = [
  "#c6ff4a",
  "#7cc4ff",
  "#ffb35c",
  "#b197fc",
  "#66d9e8",
  "#ff8fa3",
  "#8ce99a",
  "#ffd43b",
];

/**
 * One lane of a race board (used by the Dashboard's weekly + quarterly races).
 * Track position scales with points: the leader sits at 92% (at the flag),
 * everyone else proportionally behind. Zero points = at the gate (4%).
 * `row` is a standings row: { athlete, points, rank } — on the weekly
 * race it may also carry `rawPoints` / `taxFactor` (the Throne's dynasty
 * tax), in which case `points` is the taxed score the race runs on.
 * `reign` (optional) is the athlete's current Throne reign in weeks:
 * their lane avatar wears the crown + reign frame while they hold it.
 */
export default function RaceLane({ row, topPoints, color, reign = 0 }) {
  const pct = topPoints > 0 ? 4 + (row.points / topPoints) * 88 : 4;
  const isLeader = row.rank === 1 && row.points > 0;
  const photo = avatarUrlFor(row.athlete);
  const frame = reign > 0 ? Math.min(reign, 4) : 0;
  const taxed = row.taxFactor != null && row.taxFactor < 1;
  return (
    <div className={`race-lane${isLeader ? " leader" : ""}`} style={{ "--lane": color }}>
      <div className="race-meta">
        <span className="race-dot" />
        <span className="race-name">
          {isLeader ? "👑 " : ""}
          {row.athlete.name}
        </span>
        <span className="race-pts">
          {row.points}
          <span className="small muted"> pts</span>
          {taxed && (
            <span className="small muted">
              {" "}
              ({row.rawPoints} × {row.taxFactor.toFixed(2)} 👑 tax)
            </span>
          )}
        </span>
      </div>
      <div className="race-track">
        <div className="race-fill" style={{ width: `${pct}%` }} />
        <div
          className={`race-avatar${frame ? ` frame-${frame}` : ""}`}
          style={{ left: `${pct}%` }}
          title={`${row.athlete.name} — ${row.points} pts`}
        >
          {photo ? (
            <img src={photo} alt={row.athlete.name} draggable={false} />
          ) : (
            initialsOf(row.athlete.name)
          )}
          {frame > 0 && (
            <span className="avatar-crown" style={{ fontSize: 21 }} aria-hidden="true">
              👑
            </span>
          )}
        </div>
        <div className="race-finish" />
      </div>
    </div>
  );
}
