import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { completeAthleteProfile, signOutAthlete } from "../lib/firestore.js";
import { SPORTS, SPORT_META } from "../lib/points.js";

/**
 * Shown when someone is signed in but has no athlete doc — their first
 * signup attempt created the login but died before writing the profile.
 * Completes the signup in place instead of bouncing them to the leaderboard.
 */
export default function FinishSetup() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [sports, setSports] = useState(["running"]);
  const [inviteCode, setInviteCode] = useState(
    (params.get("code") || "").toUpperCase()
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleSport(s) {
    setSports((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (sports.length === 0) {
      setError("Pick at least one sport.");
      return;
    }
    setBusy(true);
    try {
      await completeAthleteProfile(user.uid, { name, sports, inviteCode });
      // useMyAthlete's onSnapshot picks up the new doc automatically.
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontSize: 40 }}>🛠️</div>
        <h1>Finish setting up your athlete</h1>
        <p className="muted small">
          Your login worked, but your athlete profile didn't get created. Fill
          this in and you're on the board.
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Morgan"
              required
            />
          </div>
          <div className="field">
            <label>Sports you train</label>
            <div className="sport-pick">
              {SPORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={sports.includes(s) ? "on" : ""}
                  onClick={() => toggleSport(s)}
                >
                  {SPORT_META[s].icon} {SPORT_META[s].label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Invite code</label>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. XK7Q2M4P"
              style={{ textTransform: "uppercase", letterSpacing: 1 }}
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Working…" : "Create my athlete"}
          </button>
        </form>

        <p className="small muted center" style={{ marginTop: 12 }}>
          Rather start over with a different email?{" "}
          <button
            type="button"
            className="chip"
            onClick={() => signOutAthlete()}
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
