import { useState } from "react";
import { Link } from "react-router-dom";
import { useAthletes, useSessions, setSessionDifficulty } from "../lib/firestore.js";
import {
  SPORT_META,
  TEST_TYPES,
  prettyDate,
  clampDifficulty,
  displayLoad,
  formatKm,
  testHeadline,
  testDetailLines,
} from "../lib/points.js";
import { useAuth } from "../App.jsx";

function RerateControl({ session, athlete }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const cur = Number(session.difficulty);

  async function nudge(delta) {
    const next = clampDifficulty(Math.round((cur + delta) * 10) / 10);
    if (next === cur) return;
    setSaving(true);
    setErr("");
    try {
      await setSessionDifficulty(session, next, athlete, "athlete");
    } catch (e) {
      setErr(e.message || "Could not update difficulty.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div className="small muted" style={{ marginBottom: 6 }}>
        Felt different than scored? Nudge it — your call shows as yours.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn ghost" disabled={saving} onClick={() => nudge(-0.1)} aria-label="Lower difficulty">
          −
        </button>
        <span className="diff-pill" style={{ minWidth: 36, textAlign: "center" }}>
          {saving ? "…" : cur.toFixed(1)}
        </span>
        <button className="btn ghost" disabled={saving} onClick={() => nudge(0.1)} aria-label="Raise difficulty">
          +
        </button>
      </div>
      {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function SessionCard({ session, athleteName, isMine, athlete, ownerAthlete }) {
  const [open, setOpen] = useState(false);
  const meta = SPORT_META[session.sport] || { label: session.sport, icon: "🏅" };
  const needsReview = session.difficultyBy === "manual-default";
  const load = displayLoad(session, ownerAthlete);
  const isTest = Boolean(session.testType && TEST_TYPES[session.testType]);

  return (
    <div className="card session" onClick={() => setOpen((o) => !o)}>
      <div className="session-head">
        <div className="sport-ico">{meta.icon}</div>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>
            {athleteName} · {meta.label}
          </div>
          <div className="small muted">
            {prettyDate(session.date)} · {session.minutes} min
            {session.distanceKm != null ? ` · ${formatKm(session.distanceKm)} km` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="pts">{session.points}</div>
          {load && (
            <div className="small muted">
              Load {load.value}
              {load.source === "est" ? " (est)" : ""}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <span className="tag">
          difficulty <span className="diff-pill">{Number(session.difficulty).toFixed(1)}</span>
        </span>
        {session.difficultyBy === "athlete" ? (
          <span className="tag">athlete adjusted</span>
        ) : needsReview ? (
          <span className="tag review">awaiting coach review</span>
        ) : (
          <span className="tag ai">coach scored</span>
        )}
        {isTest && <span className="tag">🏁 {TEST_TYPES[session.testType].short}</span>}
      </div>
      {open && (
        <div className="session-body">
          {isTest && (
            <>
              <strong style={{ color: "var(--text)" }}>Test result</strong>
              <br />
              {testHeadline(session)}
              {testDetailLines(session).map((line, i) => (
                <span key={i}>
                  <br />
                  {line}
                </span>
              ))}
              <br />
              <br />
            </>
          )}
          {session.details && (
            <>
              <strong style={{ color: "var(--text)" }}>Workout</strong>
              <br />
              {session.details}
              <br />
              <br />
            </>
          )}
          {session.notes && (
            <>
              <strong style={{ color: "var(--text)" }}>Notes</strong>
              <br />
              {session.notes}
            </>
          )}
          {!session.details && !session.notes && !isTest && "No extra details logged."}
          {isMine && athlete && <RerateControl session={session} athlete={athlete} />}
        </div>
      )}
    </div>
  );
}

export default function Feed() {
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const { athlete } = useAuth();
  const loading = aLoading || sLoading;
  const names = Object.fromEntries(athletes.map((a) => [a.id, a.name]));
  const byId = Object.fromEntries(athletes.map((a) => [a.id, a]));

  if (loading) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 110, marginBottom: 12 }} />
        <div className="skel" style={{ height: 110 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>📰 Feed</h1>
      <p className="sub">
        Summaries by default — tap any session for the full workout details
      </p>

      {sessions.length === 0 ? (
        <div className="empty">
          <div className="big">📰</div>
          <p>Nothing logged yet. First session sets the tone.</p>
          <Link to="/log" className="btn ghost" style={{ marginTop: 12 }}>
            Log a session
          </Link>
        </div>
      ) : (
        sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            athleteName={names[s.athleteId] || "Unknown"}
            isMine={athlete != null && s.athleteId === athlete.id}
            athlete={athlete}
            ownerAthlete={byId[s.athleteId]}
          />
        ))
      )}
    </div>
  );
}
