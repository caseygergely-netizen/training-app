import { Link } from "react-router-dom";
import { useAthletes, useSessions, seedDemoData, clearDemoData } from "../lib/firestore.js";
import { useAuth } from "../App.jsx";
import Onboarding from "./Onboarding.jsx";
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
  const { athlete } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [clearing, setClearing] = useState(false);

  const loading = aLoading || sLoading;
  const asOf = todayStr();
  const board = rolling14Day(sessions, athletes, asOf);
  const badges = hypeBadges(sessions, athletes, asOf);
  const hasDemo =
    athletes.some((a) => a.demo) || sessions.some((s) => s.demo);

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

  async function handleClearDemo() {
    if (
      !window.confirm(
        "Remove all demo athletes and sessions? Your real data stays untouched."
      )
    )
      return;
    setClearing(true);
    setSeedError("");
    try {
      await clearDemoData();
    } catch (e) {
      setSeedError(e.message || "Could not remove demo data.");
    } finally {
      setClearing(false);
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

  // First-run setup: a brand-new athlete (no sessions of their own, setup
  // not finished or skipped) gets the wizard instead of the board.
  const mySessions = athlete
    ? sessions.filter((s) => s.athleteId === athlete.id)
    : [];
  if (athlete && !athlete.onboarded && mySessions.length === 0) {
    return <Onboarding athlete={athlete} />;
  }

  return (
    <div className="page">
      <h1>🏆 Leaderboard</h1>
      <p className="sub">Rolling 14 days · points = load × handicap</p>
      {athlete && mySessions.length === 0 && sessions.length > 0 && (
        <div className="card" style={{ borderColor: "#3a4a1f" }}>
          <h3>🏁 Start here</h3>
          <p className="small" style={{ lineHeight: 1.55 }}>
            You're on the board with zero sessions — the goose egg is
            temporary. Log a workout, or paste a coach block from your AI
            coach, and you're racing.
          </p>
          <Link to="/log" className="btn" style={{ marginTop: 8 }}>
            ➕ Log your first session
          </Link>
        </div>
      )}
      {seedError && <div className="error">{seedError}</div>}
      {hasDemo && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn ghost" onClick={handleClearDemo} disabled={clearing}>
            {clearing ? "Removing demo data…" : "Remove demo data"}
          </button>
        </div>
      )}

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
