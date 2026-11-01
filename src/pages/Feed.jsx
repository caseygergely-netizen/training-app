import { useState } from "react";
import { Link } from "react-router-dom";
import { useAthletes, useSessions, setSessionDifficulty, deleteSession, updateSession, useReviewFlags, createReviewFlag, resolveReviewFlag } from "../lib/firestore.js";
import {
  SPORT_META,
  TEST_TYPES,
  prettyDate,
  clampDifficulty,
  displayLoad,
  formatKm,
  testHeadline,
  testDetailLines,
  bestsHeadline,
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

function EditControl({ session, athlete }) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(session.minutes));
  const [distanceKm, setDistanceKm] = useState(
    session.distanceKm != null ? String(session.distanceKm) : ""
  );
  const [difficulty, setDifficulty] = useState(String(session.difficulty));
  const [details, setDetails] = useState(session.details || "");
  const [notes, setNotes] = useState(session.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    const mins = Number(minutes);
    if (!(mins > 0)) {
      setErr("Minutes must be a number greater than 0.");
      return;
    }
    const diff = Number(difficulty);
    if (Number.isNaN(diff) || diff < 0.5 || diff > 2.0) {
      setErr("Difficulty must be between 0.5 and 2.0.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await updateSession(
        session,
        { minutes: mins, distanceKm, difficulty: diff, details, notes },
        athlete
      );
      setEditing(false);
    } catch (e) {
      setErr(e.message || "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost" onClick={() => setEditing(true)}>
          ✏️ Edit this session
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
      <div className="row">
        <div className="field grow">
          <label>Minutes</label>
          <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <div className="field grow">
          <label>Distance (km)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="field grow">
          <label>Difficulty (0.5–2.0)</label>
          <input
            type="number"
            min="0.5"
            max="2.0"
            step="0.1"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label>Workout details</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <p className="small muted">
        Saving recomputes this session's points and load with the handicap in
        effect on its date.
      </p>
      {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeleteControl({ session }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function doDelete() {
    setBusy(true);
    setErr("");
    try {
      await deleteSession(session);
    } catch (e) {
      setErr(e.message || "Could not delete session.");
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
      {!confirming ? (
        <button className="btn ghost" onClick={() => setConfirming(true)}>
          🗑 Delete this session
        </button>
      ) : (
        <div>
          <div className="small" style={{ marginBottom: 6 }}>
            Delete this session for good? Its points come off the board right away.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" disabled={busy} onClick={doDelete}>
              {busy ? "Deleting…" : "Yes, delete it"}
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function FlagControl({ session, athlete, ownerName, openFlags }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function doFlag() {
    if (!athlete) return;
    setBusy(true);
    setErr("");
    try {
      await createReviewFlag({
        session,
        sessionOwnerName: ownerName,
        flaggedBy: athlete,
        reason,
      });
      setReason("");
      setDone(true);
    } catch (e) {
      setErr(e.message || "Could not flag this session.");
    } finally {
      setBusy(false);
    }
  }

  async function doResolve(flag) {
    setBusy(true);
    setErr("");
    try {
      await resolveReviewFlag(flag.id, athlete?.name || "");
    } catch (e) {
      setErr(e.message || "Could not resolve the flag.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      {openFlags.map((f) => (
        <div key={f.id} style={{ marginBottom: 8 }}>
          <div className="small" style={{ color: "var(--warn)" }}>
            🚩 Flagged by {f.coachName || f.flaggedByName}
            {f.reason ? ` — “${f.reason}”` : ""} · argued in the Coaches'
            Corner; the owning coach re-rates, then resolve here.
          </div>
          <button className="chip" style={{ marginTop: 4 }} disabled={busy} onClick={() => doResolve(f)}>
            ✓ Resolve flag
          </button>
        </div>
      ))}
      {openFlags.length === 0 &&
        (done ? (
          <div className="small" style={{ color: "var(--warn)" }}>
            🚩 Flagged — it now shows in the Coaches' Corner as an open review.
          </div>
        ) : (
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>
              Scoring look off? Flag it for the coaches to argue in the Corner.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why does this look off? (optional)"
                style={{
                  flex: 1,
                  background: "var(--bg-soft)",
                  border: "1px solid var(--card-edge)",
                  borderRadius: 10,
                  color: "var(--text)",
                  padding: "9px 10px",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              />
              <button className="chip" disabled={busy} onClick={doFlag}>
                🚩 Flag scoring
              </button>
            </div>
          </div>
        ))}
      {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function SessionCard({ session, athleteName, isMine, athlete, ownerAthlete, openFlags = [] }) {
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
            {session.elevationGainM ? ` · ⛰ ${session.elevationGainM} m gain` : ""}
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
        {session.bests && <span className="tag">⚡ bests</span>}
        {session.postedByBotUid && (
          <span className="tag">🤖 posted by {session.postedByCoachName || "coach bot"} · athlete confirmed</span>
        )}
        {openFlags.length > 0 && (
          <span className="tag" style={{ color: "var(--warn)", borderColor: "#4a3d1c" }}>
            🚩 in review
          </span>
        )}
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
          {session.bests && (
            <>
              <strong style={{ color: "var(--text)" }}>Best efforts in this workout</strong>
              <br />
              {bestsHeadline(session)}
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
          {!session.details && !session.notes && !isTest && !session.bests && "No extra details logged."}
          {athlete && (
            <FlagControl
              session={session}
              athlete={athlete}
              ownerName={athleteName}
              openFlags={openFlags}
            />
          )}
          {isMine && athlete && <RerateControl session={session} athlete={athlete} />}
          {isMine && athlete && <EditControl session={session} athlete={athlete} />}
          {isMine && <DeleteControl session={session} />}
        </div>
      )}
    </div>
  );
}

export default function Feed() {
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const { flags } = useReviewFlags();
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
            openFlags={flags.filter((f) => f.sessionId === s.id && !f.resolved)}
          />
        ))
      )}
    </div>
  );
}
