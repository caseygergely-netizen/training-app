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

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * One lane of a race board (shared by Versus and the Dashboard boards).
 * Track position scales with points: the leader sits at 92% (at the flag),
 * everyone else proportionally behind. Zero points = at the gate (4%).
 * `row` is a standings row: { athlete, points, rank }.
 */
export default function RaceLane({ row, topPoints, color }) {
  const pct = topPoints > 0 ? 4 + (row.points / topPoints) * 88 : 4;
  const isLeader = row.rank === 1 && row.points > 0;
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
        </span>
      </div>
      <div className="race-track">
        <div className="race-fill" style={{ width: `${pct}%` }} />
        <div
          className="race-avatar"
          style={{ left: `${pct}%` }}
          title={`${row.athlete.name} — ${row.points} pts`}
        >
          {initials(row.athlete.name)}
        </div>
        <div className="race-finish" />
      </div>
    </div>
  );
}
