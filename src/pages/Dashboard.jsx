import { Link } from "react-router-dom";
import { useAthletes, useSessions, useReviewFlags, seedDemoData, clearDemoData } from "../lib/firestore.js";
import { useAuth } from "../App.jsx";
import Onboarding from "./Onboarding.jsx";
import {
  rolling14Day,
  dailyPoints,
  hypeBadges,
  weeklyWinners,
  quarterlyStandings,
  currentThrone,
  hallOfKings,
  weeklyRecap,
  taxedWeeklyStandings,
  mondayOf,
  addDays,
  todayStr,
  prettyDate,
  SPORT_META,
} from "../lib/points.js";
import Sparkline from "../components/Sparkline.jsx";
import RaceLane, { LANE_COLORS } from "../components/RaceLane.jsx";
import Avatar from "../components/Avatar.jsx";
import Statue from "../components/Statue.jsx";
import WeeklyRecap from "../components/WeeklyRecap.jsx";
import { statueUrlFor } from "../lib/statues.js";
import { Fragment, useState } from "react";

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
  const { flags } = useReviewFlags();
  const { athlete } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [clearing, setClearing] = useState(false);
  const [recapClosed, setRecapClosed] = useState(false);

  const loading = aLoading || sLoading;
  const asOf = todayStr();
  const board = rolling14Day(sessions, athletes, asOf);
  // The other two races (Casey's boards direction, Nov 3, 2026): the
  // weekly 7-day race (past winners listed below the races) and the
  // quarterly season race. All-time totals stay on athlete profiles as
  // unranked records — never a ranked board.
  const weekStart = mondayOf(asOf);
  const throne = currentThrone(sessions, athletes, asOf, flags);
  const hall = hallOfKings(sessions, athletes, asOf, flags);
  const weekRows = taxedWeeklyStandings(sessions, athletes, weekStart, throne);
  const reignById = {};
  for (const h of throne?.holders || []) reignById[h.athlete.id] = h.reignWeeks;
  const pastWinners = weeklyWinners(sessions, athletes, asOf, flags);
  // Monday-morning recap (Casey, Nov 16, 2026): the coronation for
  // the week just closed, shown once per week per browser — the key
  // is the recapped week's Monday, so a new week re-arms it.
  const recap = weeklyRecap(sessions, athletes, asOf, flags);
  const recapSeen = (() => {
    if (!recap) return true;
    try {
      return localStorage.getItem(`fomo.recapSeen.${recap.weekStart}`) === "1";
    } catch {
      return false;
    }
  })();
  const showRecap = !!recap && !recapSeen && !recapClosed;
  function closeRecap() {
    try {
      if (recap) localStorage.setItem(`fomo.recapSeen.${recap.weekStart}`, "1");
    } catch {
      /* private mode — the in-state close still applies */
    }
    setRecapClosed(true);
  }
  const { quarter, rows: quarterRows } = quarterlyStandings(sessions, athletes, asOf);
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
      <p className="sub">
        Three races at once: rolling 14 days · this week's sprint · the{" "}
        {quarter.label} season race — points = load × handicap in all three
      </p>
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
                  <Avatar
                    athlete={row.athlete}
                    size={34}
                    reign={reignById[row.athlete.id] || 0}
                  />
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

          <h1 style={{ fontSize: 18, marginTop: 18 }}>👑 The Throne</h1>
          <div className="card throne-card" style={{ marginTop: 8 }}>
            {throne ? (
              <>
                {throne.holders.map((h) => (
                  <Fragment key={h.athlete.id}>
                    <div className="throne-holder">
                      <Avatar athlete={h.athlete} size={84} reign={h.reignWeeks} crownScale={1.05} />
                      <div>
                        <div className="throne-name">{h.athlete.name}</div>
                        <div className="throne-title">
                          {h.title} · reign of {h.reignWeeks} week
                          {h.reignWeeks === 1 ? "" : "s"}
                        </div>
                        <div className="small muted" style={{ marginTop: 4 }}>
                          Won the week of {prettyDate(throne.weekStart)} — and
                          defends the throne this week at{" "}
                          <strong>×{h.taxFactor.toFixed(2)}</strong> (dynasty
                          tax on weekly-race points only).
                        </div>
                      </div>
                    </div>
                    <Statue athlete={h.athlete} reign={h.reignWeeks} variant="card" />
                  </Fragment>
                ))}
              </>
            ) : (
              <p className="small muted" style={{ margin: 6 }}>
                The throne sits empty. Win a weekly race to take it — then
                defend it, if you can.
              </p>
            )}
            <p className="small muted" style={{ marginTop: 10 }}>
              Consecutive weekly wins build a reign — and a dynasty tax:
              reign week 2 ×0.95 · week 3 ×0.90 · week 4 ×0.85 · week 5+
              ×0.80, charged on the holder's weekly-race points only.
              Session points are never taxed. Titles: The New King → The
              Undisputed → The Dynasty → The Legend. The holder's crown
              itself grows with the reign — more points, more jewels, more
              regalia every week it survives. And the holder's statue
              below escalates with it: bronze in week 1, silver in week
              2, gold in week 3 — radiant beyond.
            </p>
            {hall.length > 0 && (
              <>
                <h3 style={{ marginTop: 12 }}>🏛️ Hall of Kings</h3>
                <div className="hall">
                  {hall.map((r) => (
                    <div
                      className={`hall-king${r.current ? " current" : ""}`}
                      key={`${r.athlete.id}-${r.fromWeek}`}
                    >
                      {statueUrlFor(r.athlete) ? (
                        <Statue athlete={r.athlete} reign={r.weeks} variant="hall" />
                      ) : (
                        <Avatar
                          athlete={r.athlete}
                          size={44}
                          reign={r.weeks}
                        />
                      )}
                      <div className="hk-name">{r.athlete.name}</div>
                      <div className="hk-meta">
                        {r.weeks}-week reign
                        <br />
                        {r.title}
                        <br />
                        {r.current ? "👑 reigning" : prettyDate(r.fromWeek)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <h1 style={{ fontSize: 18, marginTop: 18 }}>🏁 This week's race</h1>
          <div className="card race-card" style={{ marginTop: 8 }}>
            {weekRows.map((row, i) => (
              <RaceLane
                key={row.athlete.id}
                row={row}
                topPoints={weekRows.length > 0 ? weekRows[0].points : 0}
                color={LANE_COLORS[i % LANE_COLORS.length]}
                reign={reignById[row.athlete.id] || 0}
                boardId="weekly"
              />
            ))}
            <p className="small muted" style={{ marginTop: 6 }}>
              Week of {prettyDate(mondayOf(asOf))} → {prettyDate(addDays(mondayOf(asOf), 6))} ·
              winner takes the trophy 🏆 — and the Throne 👑
              {throne
                ? ` — ${throne.holders.map((h) => h.athlete.name).join(" & ")} defend${
                    throne.holders.length === 1 ? "s" : ""
                  } it at ×${throne.holders[0].taxFactor.toFixed(2)}`
                : ""}{" "}
              — past winners below.
            </p>
          </div>

          <h1 style={{ fontSize: 18, marginTop: 18 }}>📅 Season race — {quarter.label}</h1>
          <div className="card race-card" style={{ marginTop: 8 }}>
            {quarterRows.map((row, i) => (
              <RaceLane
                key={row.athlete.id}
                row={row}
                topPoints={quarterRows.length > 0 ? quarterRows[0].points : 0}
                color={LANE_COLORS[i % LANE_COLORS.length]}
                reign={reignById[row.athlete.id] || 0}
                boardId="quarterly"
              />
            ))}
            <p className="small muted" style={{ marginTop: 6 }}>
              {prettyDate(quarter.start)} → {prettyDate(quarter.end)} · the long
              game — totals reset when the quarter turns. All-time records
              live on each athlete's profile, unranked by design.
            </p>
          </div>

          <h1 style={{ fontSize: 18, marginTop: 18 }}>🏆 Past weekly winners</h1>
          <div className="card" style={{ marginTop: 8 }}>
            {pastWinners.length === 0 ? (
              <p className="small muted">
                No completed weeks yet — the first trophy lands when this
                week closes Sunday night.
              </p>
            ) : (
              pastWinners.slice(0, 8).map((w) => {
                const anyAsterisk = w.winners.some(
                  (a) => w.asteriskByWinner?.[a.id]
                );
                return (
                  <div className="hist-row" key={w.weekStart}>
                    <div>
                      🏆 Week of {prettyDate(w.weekStart)}
                      <div className="small muted">
                        {w.winners
                          .map(
                            (a) =>
                              a.name + (w.asteriskByWinner?.[a.id] ? " *" : "")
                          )
                          .join(" & ")}{" "}
                        won with {w.points} pts
                        {!anyAsterisk ? " · clean win ✨" : ""}
                      </div>
                      {anyAsterisk && (
                        <div className="small muted">
                          * a session counting toward that win was flagged —
                          they won, but did they really win?
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 18 }}>🏆</div>
                  </div>
                );
              })
            )}
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
            Bad days age out on their own — the rolling board only ever counts
            the last 14 days, the weekly race resets every Monday, and the
            season race turns over with the quarter. There is no all-time
            ranked board: career totals sit on each athlete's profile as
            records, not a race nobody new could ever win.
          </div>
        </>
      )}
      {showRecap && <WeeklyRecap recap={recap} onClose={closeRecap} />}
    </div>
  );
}
