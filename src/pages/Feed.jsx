import { useState } from "react";
import { Link } from "react-router-dom";
import { useAthletes, useSessions } from "../lib/firestore.js";
import { SPORT_META, prettyDate } from "../lib/points.js";

function SessionCard({ session, athleteName }) {
  const [open, setOpen] = useState(false);
  const meta = SPORT_META[session.sport] || { label: session.sport, icon: "🏅" };
  const needsReview = session.difficultyBy === "manual-default";

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
            {session.distanceKm != null ? ` · ${session.distanceKm} km` : ""}
          </div>
        </div>
        <div className="pts">{session.points}</div>
      </div>
      <div style={{ marginTop: 8 }}>
        <span className="tag">
          difficulty <span className="diff-pill">{Number(session.difficulty).toFixed(1)}</span>
        </span>
        {needsReview ? (
          <span className="tag review">awaiting coach review</span>
        ) : (
          <span className="tag ai">coach scored</span>
        )}
      </div>
      {open && (
        <div className="session-body">
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
          {!session.details && !session.notes && "No extra details logged."}
        </div>
      )}
    </div>
  );
}

export default function Feed() {
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const loading = aLoading || sLoading;
  const names = Object.fromEntries(athletes.map((a) => [a.id, a.name]));

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
          />
        ))
      )}
    </div>
  );
}
