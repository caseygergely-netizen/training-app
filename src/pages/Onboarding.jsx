import { useState } from "react";
import { Link } from "react-router-dom";
import { updateAthleteSettings, updateAthleteProfile } from "../lib/firestore.js";

/**
 * First-run setup wizard — shown on the Dashboard only to an athlete who
 * has no sessions yet and hasn't finished (or skipped) setup. Four short
 * steps: how it works → your numbers → meet your coach → go. Everything
 * is skippable; veterans with sessions never see it.
 */
export default function Onboarding({ athlete }) {
  const [step, setStep] = useState(0);
  const [weightKg, setWeightKg] = useState("");
  const [thresholdHr, setThresholdHr] = useState("");
  const [ftpW, setFtpW] = useState("");
  const [coachName, setCoachName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function finish() {
    setBusy(true);
    setErr("");
    try {
      await updateAthleteProfile(athlete.id, { onboarded: true });
    } catch (e) {
      setErr(e.message || "Could not save setup.");
      setBusy(false);
    }
    // On success the athlete doc snapshot flips `onboarded` and the
    // Dashboard swaps this wizard out on its own.
  }

  async function saveNumbers() {
    setErr("");
    const patch = {};
    for (const [key, v] of [["weightKg", weightKg], ["thresholdHr", thresholdHr], ["ftpW", ftpW]]) {
      if (v !== "" && !(Number(v) > 0)) {
        setErr("Numbers must be positive — or leave a field blank to skip it.");
        return;
      }
      patch[key] = v;
    }
    setBusy(true);
    try {
      await updateAthleteSettings(athlete.id, patch);
      setStep(2);
    } catch (e) {
      setErr(e.message || "Could not save your numbers.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCoach() {
    setErr("");
    setBusy(true);
    try {
      if (coachName.trim())
        await updateAthleteProfile(athlete.id, { coachName: coachName.trim() });
      setStep(3);
    } catch (e) {
      setErr(e.message || "Could not save your coach's name.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>👋 Welcome, {athlete.name.split(" ")[0]}</h1>
      <p className="sub">Four quick steps and you're racing. Everything is skippable.</p>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Step {step + 1} of 4
      </p>
      {err && <div className="error">{err}</div>}

      {step === 0 && (
        <div className="card">
          <h3>🏆 How this works</h3>
          <p style={{ lineHeight: 1.6, fontSize: 14 }}>
            1. You train. Your <strong>AI coach</strong> turns each workout
            into a session — minutes, difficulty, and any personal bests
            hiding inside it.
          </p>
          <p style={{ lineHeight: 1.6, fontSize: 14 }}>
            2. Sessions score <strong>points = training load × your
            handicap</strong>, so a hard hour in any sport pays what it
            actually cost — a bike minute and a run minute are no longer
            worth the same.
          </p>
          <p style={{ lineHeight: 1.6, fontSize: 14 }}>
            3. The board is a <strong>rolling 14 days</strong> — bad weeks
            age out. Every Monday starts a fresh weekly race on Versus;
            the winner takes a trophy.
          </p>
          <button className="btn" onClick={() => setStep(1)}>
            Next — your numbers →
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3>📏 Your numbers (optional, but they matter)</h3>
          <p className="small muted">
            Load and W/kg are computed from these. Leave any blank and the
            app estimates instead — you can change them later on your
            profile.
          </p>
          <div className="field">
            <label>Weight (kg)</label>
            <input type="number" min="0" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="e.g. 82" />
          </div>
          <div className="field">
            <label>Threshold heart rate (bpm)</label>
            <input type="number" min="0" value={thresholdHr} onChange={(e) => setThresholdHr(e.target.value)} placeholder="e.g. 172" />
          </div>
          <div className="field">
            <label>Cycling FTP (watts)</label>
            <input type="number" min="0" value={ftpW} onChange={(e) => setFtpW(e.target.value)} placeholder="e.g. 257" />
          </div>
          <button className="btn" onClick={saveNumbers} disabled={busy}>
            {busy ? "Saving…" : "Save & continue →"}
          </button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setStep(2)} disabled={busy}>
            Skip for now
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>🤖 Meet your coach</h3>
          <p style={{ lineHeight: 1.6, fontSize: 14 }}>
            Every athlete here is coached by an AI (Muse, ChatGPT,
            whatever you use). Your coach writes your workouts, scores your
            sessions honestly, extracts your bests, and argues your corner
            in the Coaches' Corner. Hand it the contract and it knows the
            whole game.
          </p>
          <div className="field">
            <label>Your coach's name (e.g. Nyx, Rocky)</label>
            <input
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder="What should the league call your coach?"
            />
          </div>
          <Link to="/ai-coach" className="btn ghost" style={{ marginBottom: 8 }}>
            📋 Open the AI coach contract
          </Link>
          <button className="btn" onClick={saveCoach} disabled={busy}>
            {busy ? "Saving…" : "Continue →"}
          </button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setStep(3)} disabled={busy}>
            Skip — I'll sort my coach later
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3>🏁 You're in</h3>
          <p style={{ lineHeight: 1.6, fontSize: 14 }}>
            Log your first session — or better, get your coach to send you
            a coach block and paste it in. First session sets the tone.
          </p>
          <Link to="/log" className="btn" style={{ marginBottom: 8 }}>
            ➕ Log your first session
          </Link>
          <button className="btn ghost" onClick={finish} disabled={busy}>
            {busy ? "Finishing…" : "Take me to the board"}
          </button>
        </div>
      )}

      <button
        className="chip"
        onClick={finish}
        disabled={busy}
        style={{ marginTop: 4 }}
      >
        I know my way around — skip setup
      </button>
    </div>
  );
}
