import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { logSession } from "../lib/firestore.js";
import {
  SPORTS,
  SPORT_META,
  parseCoachBlock,
  todayStr,
  sessionPoints,
  handicapAt,
} from "../lib/points.js";

export default function LogSession() {
  const { athlete } = useAuth();
  const navigate = useNavigate();

  const [sport, setSport] = useState("running");
  const [date, setDate] = useState(todayStr());
  const [minutes, setMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [details, setDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [coachBlock, setCoachBlock] = useState("");
  const [coachParsed, setCoachParsed] = useState(null);
  const [coachError, setCoachError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function applyCoachBlock() {
    setCoachError("");
    setCoachParsed(null);
    try {
      const parsed = parseCoachBlock(coachBlock);
      setCoachParsed(parsed);
      // Fill the form from the block so the athlete can see/adjust it.
      setSport(parsed.sport);
      setDate(parsed.date);
      setMinutes(String(parsed.minutes));
      setDistanceKm(parsed.distanceKm != null ? String(parsed.distanceKm) : "");
      setDetails(parsed.details || "");
      setNotes(parsed.notes || "");
    } catch (e) {
      setCoachError(e.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!athlete) {
      setError("No athlete profile found for this account.");
      return;
    }
    const mins = Number(minutes);
    if (!(mins > 0)) {
      setError("Minutes must be a number greater than 0.");
      return;
    }
    setSaving(true);
    try {
      await logSession(athlete, {
        sport,
        date,
        minutes: mins,
        distanceKm: distanceKm === "" ? null : Number(distanceKm),
        details,
        notes,
        // Difficulty comes from the coach block when present; otherwise the
        // manual default (1.0, flagged for coach review).
        difficulty: coachParsed ? coachParsed.difficulty : 1.0,
        difficultyBy: coachParsed ? "ai" : "manual-default",
      });
      navigate("/feed");
    } catch (err) {
      setError(err.message || "Couldn't save the session.");
      setSaving(false);
    }
  }

  const previewHandicap = athlete ? handicapAt(athlete, date || todayStr()) : 1.0;
  const previewPoints =
    minutes && Number(minutes) > 0
      ? sessionPoints({
          minutes: Number(minutes),
          difficulty: coachParsed ? coachParsed.difficulty : 1.0,
          handicap: previewHandicap,
        })
      : null;

  return (
    <div className="page">
      <h1>➕ Log session</h1>
      <p className="sub">
        Difficulty is set by your AI coach — manual entries default to 1.0 and
        get flagged for coach review.
      </p>

      <div className="card">
        <h3>🤖 Coach entry</h3>
        <p className="small muted">
          Paste the JSON session block your AI coach gave you — it fills this
          form and sets the difficulty score. Schema is on the{" "}
          <Link to="/ai-coach" style={{ color: "var(--accent)" }}>
            AI coach page
          </Link>
          .
        </p>
        <div className="field">
          <textarea
            value={coachBlock}
            onChange={(e) => setCoachBlock(e.target.value)}
            placeholder='{"sport":"swimming","date":"2026-10-18","minutes":65,"difficulty":1.8,...}'
            rows={4}
          />
        </div>
        {coachError && <div className="error">{coachError}</div>}
        {coachParsed && (
          <div className="notice">
            ✅ Coach block accepted — difficulty{" "}
            <strong>{coachParsed.difficulty.toFixed(1)}</strong> will be applied.
          </div>
        )}
        <button className="btn ghost" onClick={applyCoachBlock} type="button">
          Apply coach block
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="error">{error}</div>}

        <div className="card">
          <div className="field">
            <label>Sport</label>
            <div className="sport-pick">
              {SPORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={sport === s ? "on" : ""}
                  onClick={() => setSport(s)}
                >
                  {SPORT_META[s].icon} {SPORT_META[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="row">
            <div className="field grow">
              <label>Minutes</label>
              <input
                type="number"
                min="1"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="65"
                required
              />
            </div>
            <div className="field grow">
              <label>Distance (km, optional)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <div className="field">
            <label>Workout details (sets / weights / swim sets)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                sport === "strength"
                  ? "DB bench 4x8 @ 2x50lb; goblet squat 3x10 @ 50lb; …"
                  : sport === "swimming"
                    ? "400 warmup, 8x50 fly @1:10, 4x100 IM, 400 cooldown"
                    : "Intervals, route, structure…"
              }
            />
          </div>

          <div className="field">
            <label>Notes (how it felt)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Felt strong through rep 6, died on 7–8…"
              rows={2}
            />
          </div>

          <div className="kv">
            <span className="k">Your handicap on this date</span>
            <span className="v">×{previewHandicap.toFixed(2)}</span>
          </div>
          <div className="kv">
            <span className="k">Difficulty</span>
            <span className="v">
              {coachParsed ? coachParsed.difficulty.toFixed(1) + " (coach)" : "1.0 (default — coach review pending)"}
            </span>
          </div>
          <div className="kv" style={{ marginBottom: 12 }}>
            <span className="k">Points this will score</span>
            <span className="v" style={{ color: "var(--accent)", fontSize: 18 }}>
              {previewPoints != null ? previewPoints : "—"}
            </span>
          </div>

          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Log session"}
          </button>
        </div>
      </form>
    </div>
  );
}
