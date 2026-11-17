import { prettyDate, SPORT_META } from "../lib/points.js";
import Statue from "./Statue.jsx";

/**
 * The Monday-morning week-in-review (Casey, Nov 16, 2026): shown once
 * per week on the first Dashboard open after the week rolls — the
 * coronation. The winner's statue (at the material their reign has
 * reached), the crown score, final standings, biggest session, PBs,
 * flags, the tax the king defends at this week — plus the week's
 * spoon result, any King's Bounty claimed, and any secret
 * achievements unlocked that week (the System AI segment; unlocks are
 * computed by the caller from lib/achievements.js and passed in).
 * Data comes from weeklyRecap() in points.js; dismissal is the
 * caller's business.
 */
export default function WeeklyRecap({ recap, onClose, achievements = [] }) {
  if (!recap) return null;
  const winner = recap.winners[0];
  return (
    <div className="recap-overlay" role="dialog" aria-modal="true">
      <div className="recap-modal">
        <div className="recap-kicker">👑 Week in review</div>
        <h2>
          Week of {prettyDate(recap.weekStart)} → {prettyDate(recap.weekEnd)}
        </h2>
        {winner && (
          <>
            <Statue
              athlete={winner.athlete}
              reign={winner.reignWeeks}
              variant="recap"
            />
            <div className="recap-winner">
              {recap.winners.map((w) => w.athlete.name).join(" & ")} take
              {recap.winners.length === 1 ? "s" : ""} the Throne —{" "}
              {winner.title}, reign of {winner.reignWeeks} week
              {winner.reignWeeks === 1 ? "" : "s"}
              {winner.asterisk ? " *" : ""}
            </div>
            <div className="small muted">
              Won with {recap.taxedPoints} pts
              {recap.rawPoints !== recap.taxedPoints
                ? ` (${recap.rawPoints} raw — the dynasty tax was already biting)`
                : ""}
              .
              {winner.asterisk
                ? " * A session counting toward the win was flagged — they won, but did they really win?"
                : " A clean win ✨ — no flags on the sessions that counted."}
            </div>
          </>
        )}

        <h3 style={{ marginTop: 14 }}>Final standings</h3>
        <div>
          {recap.standings.map((r) => (
            <div
              key={r.athlete.id}
              className={`recap-row${r.isWinner ? " winner" : ""}`}
            >
              <span>
                {r.isWinner ? "👑 " : ""}
                {r.athlete.name}
                <span className="muted"> · {r.sessions} sessions</span>
              </span>
              <span>{r.points} pts</span>
            </div>
          ))}
        </div>

        {recap.biggestSession && (
          <p className="small" style={{ marginTop: 12 }}>
            💥 <strong>Biggest session:</strong>{" "}
            {SPORT_META[recap.biggestSession.session.sport]?.icon}{" "}
            {recap.biggestSession.athlete?.name || "Unknown"} —{" "}
            {recap.biggestSession.session.points} pts
          </p>
        )}
        {recap.pbs.length > 0 && (
          <div className="small" style={{ marginTop: 6 }}>
            🏅 <strong>PBs set:</strong>
            {recap.pbs.map((p, i) => (
              <div key={i} style={{ marginTop: 2 }}>
                {p.athlete?.name || "Unknown"} — {p.headline}
              </div>
            ))}
          </div>
        )}
        <p className="small" style={{ marginTop: 6 }}>
          🚩 <strong>Flags:</strong>{" "}
          {recap.flagsRaised === 0
            ? "none raised all week — suspiciously honourable."
            : `${recap.flagsRaised} raised${
                recap.flaggedAthletes.length
                  ? ` on ${recap.flaggedAthletes.map((a) => a.name).join(", ")}`
                  : ""
              }.`}
        </p>
        {recap.spoon && recap.spoon.length > 0 && (
          <p className="small" style={{ marginTop: 6 }}>
            🥄 <strong>The Spoon:</strong>{" "}
            {recap.spoon
              .map(
                (s) =>
                  `${s.athlete.name} — ${s.title}, week ${s.streak} of the streak${
                    s.streak >= 2
                      ? " — the ×1.10 spoon boost is armed for this week"
                      : ""
                  }`
              )
              .join("; ")}
            .
          </p>
        )}
        {recap.bounty && recap.bounty.length > 0 && (
          <div className="small" style={{ marginTop: 6 }}>
            🎯 <strong>King's Bounty claimed:</strong>
            {recap.bounty.map((b, i) => (
              <div key={i} style={{ marginTop: 2 }}>
                {b.athlete?.name || "Unknown"} — a {b.points}-pt session,
                bigger than the sitting king's best ({b.kingBest} pts). The
                crown took that personally.
              </div>
            ))}
          </div>
        )}
        {achievements.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3>🎉 New achievements!</h3>
            {achievements.map(({ athlete, unlock }) => (
              <div key={`${athlete.id}-${unlock.id}`} className="ach-unlock">
                <div className="ach-unlock-head">
                  {unlock.icon} {athlete.name} — “{unlock.title}”
                </div>
                <div className="small">{unlock.desc}</div>
                <div className="small muted">Reward: {unlock.reward}</div>
              </div>
            ))}
          </div>
        )}
        {recap.defenders.length > 0 && (
          <p className="small" style={{ marginTop: 6 }}>
            🛡️ This week,{" "}
            {recap.defenders.map((d) => d.athlete.name).join(" & ")} defend
            {recap.defenders.length === 1 ? "s" : ""} the throne at{" "}
            <strong>
              ×{recap.defenders[0].taxFactor.toFixed(2)}
            </strong>{" "}
            — the crown gets heavier.
          </p>
        )}
        <button className="btn" onClick={onClose} style={{ marginTop: 14 }}>
          To the races 🏁
        </button>
      </div>
    </div>
  );
}
