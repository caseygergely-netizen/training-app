import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { logSession, useSessions } from "../lib/firestore.js";
import {
  SPORTS,
  SPORT_META,
  TEST_TYPES,
  TIME_TEST_TYPES,
  POWER_TEST_TYPES,
  parseCoachBlock,
  cleanTestResult,
  computeLoad,
  extractSourceId,
  findDuplicateSession,
  formatKm,
  prettyDate,
  todayStr,
  sessionPoints,
  handicapAt,
} from "../lib/points.js";

const LIFTS = ["squat", "bench", "deadlift"];

export default function LogSession() {
  const { athlete } = useAuth();
  const { sessions } = useSessions();
  const navigate = useNavigate();

  const [sport, setSport] = useState("running");
  const [date, setDate] = useState(todayStr());
  const [minutes, setMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [details, setDetails] = useState("");
  const [notes, setNotes] = useState("");
  // Optional performance data (feeds the Load metric).
  const [avgHr, setAvgHr] = useState("");
  const [avgPowerW, setAvgPowerW] = useState("");
  const [relativeEffort, setRelativeEffort] = useState("");
  // Optional standard test result.
  const [testType, setTestType] = useState("");
  const [testTime, setTestTime] = useState(""); // run5k / ski10k "MM:SS"
  const [skiConditions, setSkiConditions] = useState("");
  const [t400, setT400] = useState(""); // swimCss
  const [t200, setT200] = useState("");
  const [testPower, setTestPower] = useState(""); // power tests: avg / mean-max power
  const [bestSetLabel, setBestSetLabel] = useState(""); // strengthBestSet
  const [bestSetWeight, setBestSetWeight] = useState("");
  const [bestSetReps, setBestSetReps] = useState("");
  const [sourceId, setSourceId] = useState(""); // duplicate protection (Strava ID etc.)
  const [lifts, setLifts] = useState({
    squat: { weightKg: "", reps: "" },
    bench: { weightKg: "", reps: "" },
    deadlift: { weightKg: "", reps: "" },
  });
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
      setDetails(parsed.details || "");
      setNotes(parsed.notes || "");
      setAvgHr(parsed.avgHr != null ? String(parsed.avgHr) : "");
      setAvgPowerW(parsed.avgPowerW != null ? String(parsed.avgPowerW) : "");
      setRelativeEffort(parsed.relativeEffort != null ? String(parsed.relativeEffort) : "");
      setSourceId(parsed.sourceId || "");
      // Test result from the block, if any.
      setTestType(parsed.testType || "");
      if (TIME_TEST_TYPES.includes(parsed.testType)) {
        const sec = parsed.test?.timeSec || 0;
        setTestTime(sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "");
        if (parsed.testType === "ski10k" || parsed.testType === "ski1k")
          setSkiConditions(parsed.test?.conditions || "");
      }
      if (parsed.testType === "swimCss") {
        const f = (sec) =>
          sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "";
        setT400(f(parsed.test?.t400Sec));
        setT200(f(parsed.test?.t200Sec));
      }
      if (POWER_TEST_TYPES.includes(parsed.testType)) {
        setTestPower(parsed.test?.avgPowerW ? String(parsed.test.avgPowerW) : "");
        if (parsed.testType === "bikeFtp" && parsed.test?.avgPowerW)
          setAvgPowerW(String(parsed.test.avgPowerW));
      }
      if (parsed.testType === "strengthBestSet" && parsed.test) {
        setBestSetLabel(parsed.test.label || "");
        setBestSetWeight(parsed.test.weightKg ? String(parsed.test.weightKg) : "");
        setBestSetReps(parsed.test.reps ? String(parsed.test.reps) : "");
      }
      if (parsed.testType === "strength5rm" && parsed.test?.lifts) {
        setLifts((prev) => {
          const next = { ...prev };
          for (const lift of LIFTS) {
            const set = parsed.test.lifts[lift];
            next[lift] = set
              ? { weightKg: String(set.weightKg), reps: String(set.reps) }
              : { weightKg: "", reps: "" };
          }
          return next;
        });
      }
    } catch (e) {
      setCoachError(e.message);
    }
  }

  /** Build the raw test object from the form; cleanTestResult validates it. */
  function rawTestFromForm() {
    if (TIME_TEST_TYPES.includes(testType)) {
      return testType === "ski10k" || testType === "ski1k"
        ? { time: testTime, conditions: skiConditions }
        : { time: testTime };
    }
    if (POWER_TEST_TYPES.includes(testType)) {
      return { avgPowerW: Number(testPower) };
    }
    switch (testType) {
      case "swimCss":
        return { t400, t200 };
      case "strengthBestSet":
        return {
          label: bestSetLabel,
          weightKg: Number(bestSetWeight),
          reps: Number(bestSetReps),
        };
      case "strength5rm": {
        const out = {};
        for (const lift of LIFTS) {
          const { weightKg, reps } = lifts[lift];
          if (weightKg !== "" || reps !== "")
            out[lift] = { weightKg: Number(weightKg), reps: Number(reps) };
        }
        return { lifts: out };
      }
      default:
        return null;
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

    // Test section is optional; when a type is picked, it must be valid.
    let testFields = {};
    if (testType) {
      const cleaned = cleanTestResult(testType, rawTestFromForm());
      if (cleaned.problem) {
        setError(cleaned.problem);
        return;
      }
      testFields = { testType, test: cleaned.test };
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
        sourceId: extractSourceId(details, sourceId) || undefined,
        ...testFields,
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
  const previewPoints =
    minutes && Number(minutes) > 0
      ? sessionPoints({
          minutes: Number(minutes),
          difficulty: previewDifficulty,
          handicap: previewHandicap,
        })
      : null;
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
          },
          athlete
        )
      : null;

  const currentSourceId = extractSourceId(details, sourceId);
  const duplicate = athlete
    ? findDuplicateSession(sessions, athlete.id, currentSourceId)
    : null;

  const testOptions = Object.entries(TEST_TYPES).filter(
    ([, t]) => t.sport === sport
  );

  function pickSport(s) {
    setSport(s);
    // A test type only makes sense for its own sport — reset on switch.
    if (testType && TEST_TYPES[testType]?.sport !== s) setTestType("");
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

        <div className="card">
          <h3>🏁 Standard test (optional)</h3>
          <p className="small muted">
            Was this session a standard test? Record the result — it feeds the{" "}
            <Link to="/tests" style={{ color: "var(--accent)" }}>
              Tests &amp; PBs board
            </Link>
            .
          </p>
          <div className="field">
            <label>Test type</label>
            <div className="sport-pick">
              <button
                type="button"
                className={testType === "" ? "on" : ""}
                onClick={() => setTestType("")}
              >
                Not a test
              </button>
              {testOptions.map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  className={testType === key ? "on" : ""}
                  onClick={() => setTestType(key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {TIME_TEST_TYPES.includes(testType) && (
            <div className="field">
              <label>{TEST_TYPES[testType].label} — time (MM:SS)</label>
              <input
                value={testTime}
                onChange={(e) => setTestTime(e.target.value)}
                placeholder="19:42"
              />
            </div>
          )}
          {(testType === "ski10k" || testType === "ski1k") && (
            <div className="field">
              <label>Snow conditions</label>
              <input
                value={skiConditions}
                onChange={(e) => setSkiConditions(e.target.value)}
                placeholder="Cold, fast, fresh corduroy… (times are condition-dependent)"
              />
            </div>
          )}
          {testType === "swimCss" && (
            <div className="row">
              <div className="field grow">
                <label>400 m time (M:SS)</label>
                <input
                  value={t400}
                  onChange={(e) => setT400(e.target.value)}
                  placeholder="5:20"
                />
              </div>
              <div className="field grow">
                <label>200 m time (M:SS)</label>
                <input
                  value={t200}
                  onChange={(e) => setT200(e.target.value)}
                  placeholder="2:35"
                />
              </div>
            </div>
          )}
          {POWER_TEST_TYPES.includes(testType) && (
            <div className="field">
              <label>Average / mean-max power for the effort (W)</label>
              <input
                type="number"
                min="0"
                value={testPower}
                onChange={(e) => setTestPower(e.target.value)}
                placeholder="268"
              />
              {testType === "bikeFtp" && (
                <p className="small muted" style={{ marginTop: 6 }}>
                  FTP estimate = 0.95 × this number, shown on the Tests page.
                </p>
              )}
            </div>
          )}
          {testType === "strengthBestSet" && (
            <>
              <div className="field">
                <label>Movement (e.g. Weighted pull-up, Front squat)</label>
                <input
                  value={bestSetLabel}
                  onChange={(e) => setBestSetLabel(e.target.value)}
                  placeholder="Weighted pull-up"
                />
              </div>
              <div className="row">
                <div className="field grow">
                  <label>Weight (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={bestSetWeight}
                    onChange={(e) => setBestSetWeight(e.target.value)}
                    placeholder="20"
                  />
                </div>
                <div className="field grow">
                  <label>Reps</label>
                  <input
                    type="number"
                    min="0"
                    value={bestSetReps}
                    onChange={(e) => setBestSetReps(e.target.value)}
                    placeholder="5"
                  />
                </div>
              </div>
            </>
          )}
          {testType === "strength5rm" && (
            <>
              <p className="small muted">
                Top set per lift — estimated 1RM (Epley) is computed for you.
                Leave a lift blank if you didn't test it.
              </p>
              {LIFTS.map((lift) => (
                <div className="row" key={lift}>
                  <div className="field grow">
                    <label>{lift} weight (kg)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={lifts[lift].weightKg}
                      onChange={(e) =>
                        setLifts((p) => ({
                          ...p,
                          [lift]: { ...p[lift], weightKg: e.target.value },
                        }))
                      }
                      placeholder="—"
                    />
                  </div>
                  <div className="field grow">
                    <label>{lift} reps</label>
                    <input
                      type="number"
                      min="0"
                      value={lifts[lift].reps}
                      onChange={(e) =>
                        setLifts((p) => ({
                          ...p,
                          [lift]: { ...p[lift], reps: e.target.value },
                        }))
                      }
                      placeholder="5"
                    />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

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
