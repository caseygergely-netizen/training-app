import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { logSession, useSessions } from "../lib/firestore.js";
import {
  SPORTS,
  SPORT_META,
  parseCoachBlock,
  bestsHeadline,
  computeLoad,
  extractSourceId,
  findDuplicateSession,
  formatKm,
  prettyDate,
  todayStr,
  handicapAt,
} from "../lib/points.js";

export default function LogSession() {
  const { athlete } = useAuth();
  const { sessions } = useSessions();
  const navigate = useNavigate();

  const [sport, setSport] = useState("running");
  const [date, setDate] = useState(todayStr());
  const [minutes, setMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [elevationGainM, setElevationGainM] = useState("");
  const [details, setDetails] = useState("");
  const [notes, setNotes] = useState("");
  // Optional performance data (feeds the Load metric).
  const [avgHr, setAvgHr] = useState("");
  const [avgPowerW, setAvgPowerW] = useState("");
  const [relativeEffort, setRelativeEffort] = useState("");
  // Optional workout-derived best efforts (arrive via the coach block).
  const [bests, setBests] = useState(null);
  const [sourceId, setSourceId] = useState(""); // duplicate protection (Strava ID etc.)
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
      setDistanceKm(parsed.distanceKm != null ? formatKm(parsed.distanceKm) : "");
      setElevationGainM(parsed.elevationGainM != null ? String(parsed.elevationGainM) : "");
      setDetails(parsed.details || "");
      setNotes(parsed.notes || "");
      setAvgHr(parsed.avgHr != null ? String(parsed.avgHr) : "");
      setAvgPowerW(parsed.avgPowerW != null ? String(parsed.avgPowerW) : "");
      setRelativeEffort(parsed.relativeEffort != null ? String(parsed.relativeEffort) : "");
      setSourceId(parsed.sourceId || "");
      // Workout best efforts from the block, if any — they ride along on
      // submit and feed the Personal Bests board.
      setBests(parsed.bests || null);
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

    // Duplicate protection: one session per source activity ID per athlete.
    const sid = extractSourceId(details, sourceId);
    const dup = findDuplicateSession(sessions, athlete.id, sid);
    if (dup) {
      setError(
        `Duplicate blocked — source ID ${sid} is already logged (${SPORT_META[dup.sport]?.label || dup.sport}, ${prettyDate(dup.date)}). If this is a correction, edit or delete that entry in the Feed instead.`
      );
      return;
    }

    const num = (v) => (v === "" ? undefined : Number(v));
    setSaving(true);
    try {
      await logSession(athlete, {
        sport,
        date,
        minutes: mins,
        distanceKm: distanceKm === "" ? null : Number(distanceKm),
        details,
        notes,
        avgHr: num(avgHr),
        avgPowerW: num(avgPowerW),
        relativeEffort: num(relativeEffort),
        elevationGainM: num(elevationGainM),
        sourceId: extractSourceId(details, sourceId) || undefined,
        bests: bests || undefined,
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
  const previewDifficulty = coachParsed ? coachParsed.difficulty : 1.0;
  const previewLoad =
    minutes && Number(minutes) > 0
      ? computeLoad(
          {
            sport,
            minutes: Number(minutes),
            difficulty: previewDifficulty,
            avgHr: avgHr === "" ? undefined : Number(avgHr),
            avgPowerW: avgPowerW === "" ? undefined : Number(avgPowerW),
            relativeEffort: relativeEffort === "" ? undefined : Number(relativeEffort),
            elevationGainM: elevationGainM === "" ? undefined : Number(elevationGainM),
          },
          athlete
        )
      : null;
  // Points are scored from Load (Load × handicap); the estimated load is
  // minutes × difficulty, which is what the preview load already reflects.
  const previewPoints =
    previewLoad != null ? Math.round(previewLoad.value * previewHandicap * 10) / 10 : null;

  const currentSourceId = extractSourceId(details, sourceId);
  const duplicate = athlete
    ? findDuplicateSession(sessions, athlete.id, currentSourceId)
    : null;

  function pickSport(s) {
    setSport(s);
  }

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
                  onClick={() => pickSport(s)}
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
                step="0.01"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="33.66"
              />
            </div>
          </div>

          {sport === "hiking" && (
            <div className="field">
              <label>Elevation gain (m, optional)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={elevationGainM}
                onChange={(e) => setElevationGainM(e.target.value)}
                placeholder="600"
              />
              <p className="small muted" style={{ marginTop: 4 }}>
                Climbing counts toward the estimated Load (~10 min per
                100 m) when no measured load is logged.
              </p>
            </div>
          )}

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

          <div className="row">
            <div className="field grow">
              <label>Avg HR (optional)</label>
              <input
                type="number"
                min="0"
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="field grow">
              <label>Avg power W (optional)</label>
              <input
                type="number"
                min="0"
                value={avgPowerW}
                onChange={(e) => setAvgPowerW(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="field grow">
              <label>Strava Rel. Effort (optional)</label>
              <input
                type="number"
                min="0"
                value={relativeEffort}
                onChange={(e) => setRelativeEffort(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
          <p className="small muted" style={{ marginTop: -4 }}>
            HR / power / Relative Effort feed the <strong>Load</strong> number
            shown next to points. Leave blank and Load is estimated from
            duration × difficulty.
          </p>
        </div>

        {bests && (
          <div className="card">
            <h3>⚡ Best efforts in this workout</h3>
            <p style={{ fontWeight: 700 }}>{bestsHeadline({ bests })}</p>
            <p className="small muted">
              Extracted by your coach from the activity file — personal bests
              are pulled from ordinary workouts, and these feed the{" "}
              <Link to="/tests" style={{ color: "var(--accent)" }}>
                Personal Bests board
              </Link>
              .
            </p>
          </div>
        )}

        <div className="card">
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
          <div className="kv">
            <span className="k">Load{previewLoad?.source === "est" ? " (estimated)" : ""}</span>
            <span className="v">{previewLoad ? previewLoad.value : "—"}</span>
          </div>
          <div className="kv" style={{ marginBottom: 12 }}>
            <span className="k">Points this will score</span>
            <span className="v" style={{ color: "var(--accent)", fontSize: 18 }}>
              {previewPoints != null ? previewPoints : "—"}
            </span>
          </div>
          {currentSourceId && (
            <div className="kv" style={{ marginBottom: 12 }}>
              <span className="k">Source ID</span>
              <span className="v">{currentSourceId}</span>
            </div>
          )}
          {duplicate && (
            <div className="error" style={{ marginBottom: 12 }}>
              ⚠️ Source ID {currentSourceId} is already logged (
              {SPORT_META[duplicate.sport]?.label || duplicate.sport},{" "}
              {prettyDate(duplicate.date)}). Submitting will be blocked — edit
              or delete that entry in the Feed if this is a correction.
            </div>
          )}

          <button className="btn" type="submit" disabled={saving || Boolean(duplicate)}>
            {saving ? "Saving…" : "Log session"}
          </button>
        </div>
      </form>
    </div>
  );
}
