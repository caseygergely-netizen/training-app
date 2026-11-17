import { Link } from "react-router-dom";
import { useAthletes, useSessions, useReviewFlags, seedDemoData, clearDemoData } from "../lib/firestore.js";
import { useAuth } from "../App.jsx";
import Onboarding from "./Onboarding.jsx";
import {
  rolling14Day,
  rangeStandings,
  hypeBadges,
  weeklyWinners,
  quarterlyStandings,
  currentThrone,
  hallOfKings,
  hallOfCellar,
  currentSpoon,
  throneGrip,
  weeklyRecap,
  taxedWeeklyStandings,
  mondayOf,
  addDays,
  todayStr,
  prettyDate,
  SPORT_META,
} from "../lib/points.js";
import { achievementUnlocksInWeek } from "../lib/achievements.js";
import RaceLane, { LANE_COLORS } from "../components/RaceLane.jsx";
import Avatar from "../components/Avatar.jsx";
import Statue from "../components/Statue.jsx";
import WeeklyRecap from "../components/WeeklyRecap.jsx";
import {
  statueUrlFor,
  sadStatueUrlFor,
  statueMaterialFor,
} from "../lib/statues.js";
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
  // Layout (Casey, Nov 16, 2026): prestige first, live action second,
  // history last — Throne hero → this week's race → rolling 14-day
  // board → season race → Hall of Kings + Cellar → past winners →
  // hype chips.
  const weekStart = mondayOf(asOf);
  const throne = currentThrone(sessions, athletes, asOf, flags);
  const spoon = currentSpoon(sessions, athletes, asOf);
  const grip = throneGrip(sessions, athletes, asOf, flags);
  const bleeding = grip ? grip.find((g) => g.bleeding) : null;
  const hall = hallOfKings(sessions, athletes, asOf, flags);
  const cellar = hallOfCellar(sessions, athletes, asOf);
  const weekRows = taxedWeeklyStandings(sessions, athletes, weekStart, throne, spoon);
  const reignById = {};
  for (const h of throne?.holders || []) reignById[h.athlete.id] = h.reignWeeks;
  const spoonById = {};
  for (const h of spoon.holders) spoonById[h.athlete.id] = h;
  // On Fire: the rolling 7-day points leader wears the flame.
  const fireRows = rangeStandings(sessions, athletes, addDays(asOf, -6), asOf);
  const fireTop = fireRows.length > 0 ? fireRows[0].points : 0;
  const fireIds = new Set(
    fireTop > 0 ? fireRows.filter((r) => r.points === fireTop).map((r) => r.athlete.id) : []
  );
  const pastWinners = weeklyWinners(sessions, athletes, asOf, flags);
  // Monday-morning recap (Casey, Nov 16, 2026): the coronation for
  // the week just closed, shown once per week per browser — the key
  // is the recapped week's Monday, so a new week re-arms it.
  const recap = weeklyRecap(sessions, athletes, asOf, flags);
  const recapAchievements = recap
    ? achievementUnlocksInWeek(sessions, athletes, flags, recap.weekStart, asOf)
    : [];
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
      <h1>🏆 The Board</h1>
      <p className="sub">
        Points = load × handicap — the king is taxed, the spoon is
        boosted, and everyone is watching.
      </p>
      {athlete && mySessions.length === 0 && sessions.length > 0 && (
        <div className="card" style={{ borderColor: "#3a4a1f" }}>
          <h3>🏁 Start here</h3>
          <p className="small" style={{ lineHeight: 1.55 }}>
            You're on the board with zero sessions — the goose egg is
            temporary. Log a workout, or paste a coach block from your AI
            coach, and you're racing.
          </p>
          <Link to="/coaches-hub" className="btn" style={{ marginTop: 8 }}>
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
            <Link to="/coaches-hub" className="btn ghost">Log a session instead</Link>
          </div>
        </div>
      ) : (
        <>
          {/* ——— 1 · The Throne hero ——— */}
          <div className="card throne-card throne-hero">
            {throne ? (
              throne.holders.map((h) => (
                <Fragment key={h.athlete.id}>
                  {statueUrlFor(h.athlete) ? (
                    <Statue
                      athlete={h.athlete}
                      reign={h.reignWeeks}
                      variant="hero"
                      overlay={
                        <>
                          <div className="throne-name">{h.athlete.name}</div>
                          <div className="throne-title">
                            👑 {h.title} · reign of {h.reignWeeks} week
                            {h.reignWeeks === 1 ? "" : "s"} ·{" "}
                            {statueMaterialFor(h.reignWeeks)} statue
                          </div>
                          <div className="small" style={{ color: "#d8deea" }}>
                            Won the week of {prettyDate(throne.weekStart)} —
                            defends this week at{" "}
                            <strong>×{h.taxFactor.toFixed(2)}</strong> (dynasty
                            tax, weekly-race points only)
                          </div>
                        </>
                      }
                    />
                  ) : (
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
                  )}
                </Fragment>
              ))
            ) : (
              <p className="small muted" style={{ margin: 6 }}>
                The throne sits empty. Win a weekly race to take it — then
                defend it, if you can.
              </p>
            )}
            {grip &&
              grip.map((g) =>
                g.challenger ? (
                  <div className="grip" key={g.holder.athlete.id}>
                    <div className="grip-label">
                      {g.bleeding ? (
                        <>
                          🩸 <strong>{g.challenger.name}</strong> is ahead{" "}
                          {g.challengerPoints}–{g.kingPoints} — the king is
                          bleeding
                        </>
                      ) : (
                        <>
                          Grip — nearest challenger {g.challenger.name} at{" "}
                          {g.gripPct}% of the king ({g.challengerPoints} vs{" "}
                          {g.kingPoints})
                        </>
                      )}
                    </div>
                    <div className="grip-track">
                      <div
                        className={`grip-fill${g.bleeding ? " bleeding" : ""}`}
                        style={{ width: `${Math.min(g.gripPct, 100)}%` }}
                      />
                    </div>
                  </div>
                ) : null
              )}
            <p className="small muted" style={{ marginTop: 10 }}>
              Win the week, take the Throne: reigns earn titles (The New
              King → The Undisputed → The Dynasty → The Legend) and a
              dynasty tax up to ×0.80 — and two straight last-place
              finishes arm the Spoon's ×1.10 boost.
            </p>
          </div>

          {/* ——— 2 · This week's race ——— */}
          <h1 style={{ fontSize: 18, marginTop: 18 }}>🏁 This week's race</h1>
          <div className="card race-card" style={{ marginTop: 8 }}>
            {bleeding && (
              <div className="bleeding-banner">
                🩸 <strong>THE KING IS BLEEDING</strong> —{" "}
                {bleeding.challenger.name} leads {bleeding.holder.athlete.name}{" "}
                {bleeding.challengerPoints}–{bleeding.kingPoints} in this
                week's race.
              </div>
            )}
            {weekRows.map((row, i) => (
              <RaceLane
                key={row.athlete.id}
                row={row}
                topPoints={weekRows.length > 0 ? weekRows[0].points : 0}
                color={LANE_COLORS[i % LANE_COLORS.length]}
                reign={reignById[row.athlete.id] || 0}
                spoonStreak={spoonById[row.athlete.id]?.streak || 0}
                onFire={fireIds.has(row.athlete.id)}
                rankTitle={
                  row.rank === 2
                    ? "The Heir"
                    : row.rank === 3
                      ? "The Pretender"
                      : spoonById[row.athlete.id]?.title || ""
                }
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
                : ""}
              {spoon.holders.some((h) => h.boostActive)
                ? ` · ${spoon.holders
                    .filter((h) => h.boostActive)
                    .map((h) => h.athlete.name)
                    .join(" & ")} climb${
                    spoon.holders.filter((h) => h.boostActive).length === 1 ? "s" : ""
                  } with the spoon boost at ×1.10`
                : ""}{" "}
              — past winners below.
            </p>
          </div>

          {/* ——— 3 · Rolling 14-day board ——— */}
          <h1 style={{ fontSize: 18, marginTop: 18 }}>📊 Rolling 14 days</h1>
          <div className="card" style={{ padding: "6px 14px", marginTop: 8 }}>
            {board.map((row) => (
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
                </div>
                <div>
                  <div className="pts">{row.points}</div>
                </div>
                <TrendArrow delta={row.delta} prior={row.prior} />
              </Link>
            ))}
          </div>

          {/* ——— 4 · Season race ——— */}
          <h1 style={{ fontSize: 18, marginTop: 18 }}>📅 Season race — {quarter.label}</h1>
          <div className="card race-card" style={{ marginTop: 8 }}>
            {quarterRows.map((row, i) => (
              <RaceLane
                key={row.athlete.id}
                row={row}
                topPoints={quarterRows.length > 0 ? quarterRows[0].points : 0}
                color={LANE_COLORS[i % LANE_COLORS.length]}
                reign={reignById[row.athlete.id] || 0}
                onFire={fireIds.has(row.athlete.id)}
                boardId="quarterly"
              />
            ))}
            <p className="small muted" style={{ marginTop: 6 }}>
              {prettyDate(quarter.start)} → {prettyDate(quarter.end)} · the long
              game — totals reset when the quarter turns. All-time records
              live on each athlete's profile, unranked by design.
            </p>
          </div>

          {/* ——— 5 · Hall of Kings + the Cellar ——— */}
          {(hall.length > 0 || cellar.length > 0) && (
            <>
              <h1 style={{ fontSize: 18, marginTop: 18 }}>🏛️ Hall of Kings · 🥄 The Cellar</h1>
              <div className="card" style={{ marginTop: 8 }}>
                {hall.length > 0 && (
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
                )}
                {cellar.length > 0 && (
                  <>
                    <h3 style={{ marginTop: hall.length > 0 ? 10 : 0 }}>
                      🥄 The Cellar — spoon reigns of shame
                    </h3>
                    <div className="hall">
                      {cellar.map((r) => (
                        <div
                          className={`hall-king cellar${r.current ? " current" : ""}`}
                          key={`${r.athlete.id}-${r.fromWeek}`}
                        >
                          {sadStatueUrlFor(r.athlete) ? (
                            <Statue athlete={r.athlete} variant="hall" sad />
                          ) : (
                            <Avatar athlete={r.athlete} size={44} />
                          )}
                          <div className="hk-name">{r.athlete.name}</div>
                          <div className="hk-meta">
                            {r.weeks}-week streak
                            <br />
                            {r.title}
                            <br />
                            {r.current ? "🥄 serving now" : prettyDate(r.fromWeek)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ——— 6 · Past weekly winners ——— */}
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

          {/* ——— 7 · Hype chips ——— */}
          <div className="hype-chips">
            <span className="hype-chip">
              💥 Biggest session:{" "}
              {badges.biggestSession ? (
                <>
                  {SPORT_META[badges.biggestSession.sport]?.icon}{" "}
                  {athleteName(athletes, badges.biggestSession.athleteId)} ·{" "}
                  {badges.biggestSession.points} pts
                </>
              ) : (
                "—"
              )}
            </span>
            <span className="hype-chip">
              ⚡ Longest streak:{" "}
              {badges.longestStreak
                ? `${badges.longestStreak.athlete.name} · ${badges.longestStreak.days} days`
                : "—"}
            </span>
            <span className="hype-chip">
              🚀 Comeback:{" "}
              {badges.comeback
                ? `${badges.comeback.athlete.name} · +${badges.comeback.delta} pts`
                : "—"}
            </span>
          </div>
        </>
      )}
      {showRecap && (
        <WeeklyRecap
          recap={recap}
          achievements={recapAchievements}
          onClose={closeRecap}
        />
      )}
    </div>
  );
}
