import { useAthletes, useSessions } from "../lib/firestore.js";
import {
  weeklyMatchups,
  mondayOf,
  addDays,
  todayStr,
  prettyDate,
} from "../lib/points.js";

function PairCard({ pair, daysLeft }) {
  const { a, b, aPoints, bPoints, leader, margin } = pair;
  const total = aPoints + bPoints;
  const aPct = total > 0 ? Math.round((aPoints / total) * 100) : 50;
  return (
    <div className="card vs-card">
      <div className="vs-names">
        <span>
          {a.name}{" "}
          {leader?.id === a.id && <span className="leader-tag">leading</span>}
        </span>
        <span className="muted small">vs</span>
        <span style={{ textAlign: "right" }}>
          {leader?.id === b.id && <span className="leader-tag">leading</span>}{" "}
          {b.name}
        </span>
      </div>
      <div className="vs-score">
        <span className="n">{aPoints}</span>
        <span className="muted small">
          {leader
            ? `${leader.name.split(" ")[0]} projected · +${margin}`
            : "tied — anyone's week"}
        </span>
        <span className="n">{bPoints}</span>
      </div>
      <div className="vs-bar">
        <div style={{ width: `${aPct}%`, background: "#c6ff4a" }} />
        <div style={{ width: `${100 - aPct}%`, background: "#4a5a7a" }} />
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        {daysLeft} day{daysLeft === 1 ? "" : "s"} left this week
      </div>
    </div>
  );
}

export default function Versus() {
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const loading = aLoading || sLoading;

  const asOf = todayStr();
  const weekStart = mondayOf(asOf);
  const weekEnd = addDays(weekStart, 6);
  const dayIndex = Math.min(6, Math.max(0, Math.round((new Date() - new Date(weekStart + "T00:00")) / 86400000)));
  const daysLeft = 6 - dayIndex;
  const pairs = weeklyMatchups(sessions, athletes, weekStart);

  if (loading) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 140, marginBottom: 12 }} />
        <div className="skel" style={{ height: 140 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>⚔️ Versus</h1>
      <p className="sub">
        Week of {prettyDate(weekStart)} → {prettyDate(weekEnd)} · every pair,
        head to head
      </p>

      {athletes.length < 2 ? (
        <div className="empty">
          <div className="big">⚔️</div>
          <p>Need at least two athletes for a showdown. Invite a friend to start the trash talk.</p>
        </div>
      ) : pairs.length === 0 ? (
        <div className="empty">
          <div className="big">🌱</div>
          <p>No sessions logged yet this week. The board is wide open.</p>
        </div>
      ) : (
        pairs.map((p, i) => (
          <PairCard key={`${p.a.id}-${p.b.id}-${i}`} pair={p} daysLeft={daysLeft} />
        ))
      )}

      <div className="notice">
        Projected winner = whoever leads the pair right now. No models, no
        predictions — just who's putting in the work this week.
      </div>
    </div>
  );
}
