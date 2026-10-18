import { Link } from "react-router-dom";
import { useAthletes, useSessions, seedDemoData } from "../lib/firestore.js";
import {
  rolling14Day,
  dailyPoints,
  hypeBadges,
  addDays,
  todayStr,
  SPORT_META,
} from "../lib/points.js";
import Sparkline from "../components/Sparkline.jsx";
import { useState } from "react";

function TrendArrow({ delta, prior }) {
  if (prior === 0 && delta === 0) return <span className="trend flat">—</span>;
  if (delta > 0)
    return <span className="trend up">▲ {delta}</span>;
  if (delta < 0)
    return <span className="trend down">▼ {Math.abs(delta)}</span>;
  return <span className="trend flat">—</span>;
}

function athleteName(athletes, id) {
  return athletes.find((a) => a.id === id)?.name || "Unknown";
}

export default function Dashboard() {
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState("");

  const loading = aLoading || sLoading;
  const asOf = todayStr();
  const board = rolling14Day(sessions, athletes, asOf);
  const badges = hypeBadges(sessions, athletes, asOf);

  async function handleSeed() {
    setSeeding(true);
    setSeedError("");
    try {
      await seedDemoData();
    } catch (e) {
      setSeedError(e.message || "Seeding failed.");
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 200, marginBottom: 12 }} />
        <div className="skel" style={{ height: 120 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>🏆 Leaderboard</h1>
      <p className="sub">Rolling 14 days · points = minutes × difficulty × handicap</p>

      {sessions.length === 0 ? (
        <div className="empty">
          <div className="big">🌱</div>
          <p>No sessions yet. Load the demo data to see the app come alive, or log your first session.</p>
          {seedError && <div className="error">{seedError}</div>}
          <button className="btn" onClick={handleSeed} disabled={seeding}>
            {seeding ? "Loading demo data…" : "Load demo data"}
          </button>
          <div style={{ marginTop: 10 }}>
            <Link to="/log" className="btn ghost">Log a session instead</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: "6px 14px" }}>
            {board.map((row) => {
              const series = dailyPoints(
                sessions,
                row.athlete.id,
                addDays(asOf, -13),
                asOf
              ).map((d) => d.points);
              return (
                <Link
                  key={row.athlete.id}
                  to={`/athletes/${row.athlete.id}`}
                  className="board-row"
                >
                  <div className={`rank r${row.rank <= 3 ? row.rank : 0}`}>
                    {row.rank}
                  </div>
                  <div className="grow">
                    <div className="ath-name">{row.athlete.name}</div>
                    <div className="small muted">
                      {row.sessionCount} sessions · hcp {Number(row.athlete.handicap ?? 1).toFixed(2)}
                    </div>
                  </div>
                  <Sparkline data={series} />
                  <div>
                    <div className="pts">{row.points}</div>
                    <TrendArrow delta={row.delta} prior={row.prior} />
                  </div>
                </Link>
              );
            })}
          </div>

          <h1 style={{ fontSize: 18, marginTop: 18 }}>🔥 Hype</h1>
          <div className="badges">
            <div className="badge">
              <div className="emoji">💥</div>
              <div className="t">Biggest session this week</div>
              <div className="v">
                {badges.biggestSession ? (
                  <>
                    {SPORT_META[badges.biggestSession.sport]?.icon}{" "}
                    {athleteName(athletes, badges.biggestSession.athleteId)}
                    <br />
                    <span className="muted">{badges.biggestSession.points} pts</span>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
            </div>
            <div className="badge">
              <div className="emoji">⚡</div>
              <div className="t">Longest streak</div>
              <div className="v">
                {badges.longestStreak ? (
                  <>
                    {badges.longestStreak.athlete.name}
                    <br />
                    <span className="muted">{badges.longestStreak.days} days</span>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
            </div>
            <div className="badge">
              <div className="emoji">🚀</div>
              <div className="t">Comeback of the week</div>
              <div className="v">
                {badges.comeback ? (
                  <>
                    {badges.comeback.athlete.name}
                    <br />
                    <span className="muted">+{badges.comeback.delta} pts</span>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="notice" style={{ marginTop: 14 }}>
            Bad days age out on their own — the board only ever counts the last
            14 days. Every Monday is a fresh start on{" "}
            <Link to="/versus" style={{ color: "var(--accent)", fontWeight: 700 }}>
              Versus ⚔️
            </Link>
            .
          </div>
        </>
      )}
    </div>
  );
}
