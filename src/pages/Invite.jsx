import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../App.jsx";
import {
  useMyInvites,
  createInvite,
  getInvite,
  useAthletes,
} from "../lib/firestore.js";

export default function Invite() {
  const { user, athlete } = useAuth();
  const [params] = useSearchParams();
  const codeParam = (params.get("code") || "").toUpperCase();
  const invites = useMyInvites(user?.uid);
  const { athletes } = useAthletes();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [incoming, setIncoming] = useState(null);
  const [incomingChecked, setIncomingChecked] = useState(false);

  useEffect(() => {
    if (!codeParam) {
      setIncomingChecked(true);
      return;
    }
    getInvite(codeParam)
      .then((inv) => {
        setIncoming(inv);
        setIncomingChecked(true);
      })
      .catch(() => setIncomingChecked(true));
  }, [codeParam]);

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      await createInvite(user.uid);
    } catch (e) {
      setError(e.message || "Couldn't create an invite code.");
    } finally {
      setCreating(false);
    }
  }

  const inviterName =
    incoming && athletes.find((a) => a.id === incoming.createdBy)?.name;

  // Someone opened an invite link.
  if (codeParam && incomingChecked) {
    if (!incoming) {
      return (
        <div className="page">
          <div className="empty">
            <div className="big">✉️</div>
            <p>That invite code doesn't exist. Ask your friend for a fresh link.</p>
          </div>
        </div>
      );
    }
    if (incoming.usedBy) {
      return (
        <div className="page">
          <div className="empty">
            <div className="big">✉️</div>
            <p>This invite code has already been used.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="page">
        <div className="card center" style={{ marginTop: 24 }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <h1>You've been invited!</h1>
          <p className="muted">
            {inviterName || "A friend"} invited you to compete on the training
            leaderboard.
          </p>
          <p className="small muted">
            Invite code: <strong style={{ color: "var(--accent)" }}>{codeParam}</strong>
          </p>
          <Link className="btn" to={`/login?code=${codeParam}`} style={{ marginTop: 12 }}>
            Accept & create my athlete
          </Link>
        </div>
        <div className="notice">
          After you join, paste the <Link to="/ai-coach" style={{ color: "var(--accent)" }}>AI coach contract</Link> into
          your own AI (Muse, Claude, …) and it starts coaching you through the app.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>✉️ Invite friends</h1>
      <p className="sub">
        Share a code — your friend signs up, becomes an athlete, and plugs in
        their own AI coach.
      </p>

      {error && <div className="error">{error}</div>}

      <button className="btn" onClick={handleCreate} disabled={creating}>
        {creating ? "Creating…" : "➕ Generate invite code"}
      </button>

      <div style={{ marginTop: 16 }}>
        {invites.length === 0 ? (
          <p className="muted small center">No invite codes yet.</p>
        ) : (
          invites.map((inv) => {
            const link = `${window.location.origin}/invite?code=${inv.code}`;
            return (
              <div className="card" key={inv.code}>
                <div className="row">
                  <div className="grow">
                    <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>
                      {inv.code}
                    </div>
                    <div className="small muted">
                      {inv.usedBy ? "✅ Used" : "🟢 Unused"}
                    </div>
                  </div>
                  <button
                    className="chip accent"
                    onClick={() => {
                      navigator.clipboard?.writeText(link).catch(() => {});
                    }}
                  >
                    📋 Copy link
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="notice">
        Signed in as <strong>{athlete?.name || user?.email}</strong>. Codes are
        single-use — once your friend signs up with one, it's spent.
      </div>
    </div>
  );
}
