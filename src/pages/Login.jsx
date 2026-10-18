import { useState } from "react";
import { useNavigate, useSearchParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { signInAthlete, signUpAthlete } from "../lib/firestore.js";
import { SPORTS, SPORT_META } from "../lib/points.js";

export default function Login() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const prefilledCode = (params.get("code") || "").toUpperCase();

  const [mode, setMode] = useState(prefilledCode ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sports, setSports] = useState(["running"]);
  const [inviteCode, setInviteCode] = useState(prefilledCode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to="/" replace />;

  function toggleSport(s) {
    setSports((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && sports.length === 0) {
      setError("Pick at least one sport.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInAthlete(email.trim(), password);
      } else {
        await signUpAthlete({
          name,
          email: email.trim(),
          password,
          sports,
          inviteCode,
        });
      }
      navigate("/");
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ marginTop: 24 }}>
        <h1 style={{ marginTop: 0 }}>
          TRAINING<span style={{ color: "var(--accent)" }}>APP</span>
        </h1>
        <p className="muted small">
          Compete with friends. Your AI coach scores every session.
        </p>

        <div className="sport-pick" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={mode === "signin" ? "on" : ""}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "on" : ""}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
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
                <p className="small muted" style={{ marginTop: 6 }}>
                  Required — unless you're the very first athlete.
                </p>
              </div>
            </>
          )}

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button className="btn" type="submit" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create my athlete"}
          </button>
        </form>
      </div>

      {mode === "signup" && (
        <div className="notice">
          New here? After you join, open the{" "}
          <Link to="/ai-coach" style={{ color: "var(--accent)" }}>
            AI coach page
          </Link>{" "}
          and paste the contract into your AI — that's how it plugs in.
        </div>
      )}
    </div>
  );
}
