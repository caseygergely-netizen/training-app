import { useState } from "react";
import { Link } from "react-router-dom";
import { useAthletes, useSessions } from "../lib/firestore.js";
import {
  weeklyStandings,
  mondayOf,
  addDays,
  todayStr,
  prettyDate,
} from "../lib/points.js";

const LANE_COLORS = ["#c6ff4a", "#7cc4ff", "#ffb35c", "#b197fc", "#66d9e8", "#ff8fa3", "#8ce99a", "#ffd43b"];

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RaceLane({ row, topPoints, color }) {
  // Track position scales with points: the leader sits at 92% (at the flag),
  // everyone else proportionally behind. Zero points = at the gate (4%).
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

export default function Versus() {
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const loading = aLoading || sLoading;

  const currentMonday = mondayOf(todayStr());
  const [weekStart, setWeekStart] = useState(currentMonday);
  const isCurrentWeek = weekStart === currentMonday;
  const weekEnd = addDays(weekStart, 6);

  const rows = weeklyStandings(sessions, athletes, weekStart);
  const topPoints = rows.length > 0 ? rows[0].points : 0;
  const winner = !isCurrentWeek && topPoints > 0 ? rows.filter((r) => r.points === topPoints) : [];

  const dayIndex = Math.min(
    6,
    Math.max(0, Math.round((new Date() - new Date(weekStart + "T00:00")) / 86400000))
  );
  const daysLeft = isCurrentWeek ? 6 - dayIndex : 0;

  if (loading) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 200, marginBottom: 12 }} />
        <div className="skel" style={{ height: 140 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>🏁 The Race</h1>
      <p className="sub">
        Week of {prettyDate(weekStart)} → {prettyDate(weekEnd)} · a fresh race
        every Monday — winner takes the trophy 🏆
      </p>

      <div className="week-nav">
        <button className="btn ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ‹ Prev week
        </button>
        {!isCurrentWeek ? (
          <button className="btn ghost" onClick={() => setWeekStart(currentMonday)}>
            This week
          </button>
        ) : (
          <span className="small muted">{daysLeft} day{daysLeft === 1 ? "" : "s"} of racing left</span>
        )}
        <button
          className="btn ghost"
          disabled={isCurrentWeek}
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          Next week ›
        </button>
      </div>

      {athletes.length < 2 ? (
        <div className="empty">
          <div className="big">🏁</div>
          <p>Need at least two athletes for a race. Invite a friend to line up at the gate.</p>
        </div>
      ) : (
        <>
          <div className="card race-card">
            {rows.map((row, i) => (
              <RaceLane
                key={row.athlete.id}
                row={row}
                topPoints={topPoints}
                color={LANE_COLORS[i % LANE_COLORS.length]}
              />
            ))}
            {topPoints === 0 && (
              <p className="small muted" style={{ marginTop: 10 }}>
                {isCurrentWeek
                  ? "The horses are at the gate — no points yet this week. First session takes the lead."
                  : "Nobody scored this week. The trophy went unclaimed."}
              </p>
            )}
            {winner.length > 0 && (
              <p style={{ marginTop: 10 }}>
                🏆 <strong>{winner.map((w) => w.athlete.name).join(" & ")}</strong>{" "}
                {winner.length > 1 ? "shared the win" : "won this week"} with {topPoints} pts —
                trophy on {winner.length > 1 ? "their profiles" : "their profile"}.
              </p>
            )}
          </div>

          <div className="card">
            <h3>{isCurrentWeek ? "Standings so far" : "Final standings"}</h3>
            {rows.map((row) => (
              <div className="hist-row" key={row.athlete.id}>
                <div>
                  <strong>
                    {row.rank}.{" "}
                    <Link
                      to={`/athlete/${row.athlete.id}`}
                      style={{ color: "var(--text)", textDecoration: "none" }}
                    >
                      {row.athlete.name}
                    </Link>
                    {!isCurrentWeek && row.points === topPoints && topPoints > 0 ? " 🏆" : ""}
                  </strong>
                  <div className="small muted">
                    {row.sessions} session{row.sessions === 1 ? "" : "s"} · {row.minutes} min
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{row.points} pts</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="notice">
        Positions scale with points — the leader rides at the flag and everyone
        else is exactly as far behind as the score says. Races reset every
        Monday; trophies for finished weeks live on each athlete's profile.
      </div>
    </div>
  );
}
