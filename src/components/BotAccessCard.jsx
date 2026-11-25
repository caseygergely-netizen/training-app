import { useState } from "react";
import {
  useMyCoachBot,
  createCoachLinkCode,
  setCoachBotActive,
  updateAthleteProfile,
} from "../lib/firestore.js";

/**
 * Coach bot access (moved Nov 25, 2026): this card used to sit at the
 * top of the Coaches' Corner; Casey wanted the Corner decluttered, so
 * it now lives on the athlete's own profile page, below the fold.
 * Self-contained: link-code generation + revoke/restore for the
 * signed-in athlete's linked coach bot.
 */
export default function BotAccessCard({ athlete }) {
  const { bot } = useMyCoachBot(athlete?.id);
  const [coachName, setCoachName] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  const [err, setErr] = useState("");

  const effectiveCoachName = coachName || athlete?.coachName || "";

  async function handleLinkCode() {
    if (!athlete) return;
    const name = (effectiveCoachName || "").trim();
    if (!name) {
      setErr(
        "Set your coach's name first — the link code locks to that name and it can't be changed afterward."
      );
      return;
    }
    setBotBusy(true);
    setErr("");
    try {
      if (name !== (athlete.coachName || "")) {
        await updateAthleteProfile(athlete.id, { coachName: name });
      }
      const code = await createCoachLinkCode(athlete, name);
      setLinkCode(code);
    } catch (e) {
      setErr(e.message || "Could not create a link code.");
    } finally {
      setBotBusy(false);
    }
  }

  async function handleBotActive(active) {
    if (!bot) return;
    setBotBusy(true);
    setErr("");
    try {
      await setCoachBotActive(bot.id, active);
    } catch (e) {
      setErr(e.message || "Could not update the bot link.");
    } finally {
      setBotBusy(false);
    }
  }

  if (!athlete) return null;
  return (
    <div className="card">
      <h3>🤖 Coach bot access</h3>
      {err && <div className="error">{err}</div>}
      {bot ? (
        <>
          <p style={{ fontSize: 14, lineHeight: 1.55 }}>
            {bot.active ? "✅" : "⛔"} <strong>{bot.coachName}</strong> is
            linked to your account{bot.active ? "" : " — access revoked"}.
            A linked bot reads and posts in the Corner on its own schedule
            and stamps its 👀 reads, so your coach never needs you to relay
            messages. Its access is scoped to the Corner — it cannot touch
            sessions, scores or settings.
          </p>
          <button
            className="btn ghost"
            onClick={() => handleBotActive(!bot.active)}
            disabled={botBusy}
          >
            {botBusy ? "Working…" : bot.active ? "Revoke bot access" : "Restore bot access"}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, lineHeight: 1.55 }}>
            Give your coach its own way in. Generate a one-time link code
            and hand it to your coach — it connects the coach's bot account
            to you, and from then on the coach checks in here by itself:
            reading, stamping 👀, and replying when it has something to
            say. No more copy-paste relay.
          </p>
          {linkCode ? (
            <>
              <div
                style={{
                  fontSize: 26,
                  letterSpacing: 4,
                  fontWeight: 700,
                  margin: "8px 0",
                }}
              >
                {linkCode}
              </div>
              <p className="small muted">
                One-time code for {effectiveCoachName || "your coach"} — it
                dies the moment it's redeemed. If it leaks unused, just
                generate a fresh one later.
              </p>
            </>
          ) : (
            <>
              <div className="field" style={{ maxWidth: 340 }}>
                <label>Coach name</label>
                <input
                  value={effectiveCoachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  placeholder="e.g. Nyx"
                />
              </div>
              <p className="small muted" style={{ margin: "4px 0 10px" }}>
                ⚠️ The code locks to this exact name and it can't be changed
                afterward — check the spelling before you generate.
              </p>
              <button
                className="btn"
                onClick={handleLinkCode}
                disabled={botBusy || !effectiveCoachName.trim()}
              >
                {botBusy ? "Working…" : "Generate a link code"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
