import { scoreReceipt } from "../lib/points.js";

/**
 * The Score Receipt (Casey, Nov 16, 2026): "How this scored" — the
 * full breakdown of one session's points, rebuilt from the fields
 * stored on the session by scoreReceipt() in points.js: the load
 * source, the inputs that fed it, any duration discount, the
 * handicap, and the final points. Display only — it explains the
 * stored number, it never re-prices it. Born from a flagged session
 * that took a whole Corner thread to settle; now it's one tap.
 */
export default function ScoreReceipt({ session, athlete }) {
  const r = scoreReceipt(session, athlete);
  if (!r) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ color: "var(--text)" }}>🧾 How this scored</strong>
      <div style={{ marginTop: 4 }}>
        <div className="kv">
          <span className="k">Load source</span>
          <span className="v">{r.sourceLabel}</span>
        </div>
        {r.lines.map((l) => (
          <div className="kv" key={l.label}>
            <span className="k">{l.label}</span>
            <span className="v">{l.value}</span>
          </div>
        ))}
        {r.discount && (
          <div className="kv">
            <span className="k">Duration discount</span>
            <span className="v">
              ×{r.discount.factor.toFixed(2)} (past {r.discount.kneeMin} min)
            </span>
          </div>
        )}
        <div className="kv">
          <span className="k">Handicap</span>
          <span className="v">×{Number(r.handicap).toFixed(2)}</span>
        </div>
        <div className="kv">
          <span className="k">Points</span>
          <span className="v" style={{ color: "var(--accent)" }}>
            {r.load != null ? `${r.load} × ${Number(r.handicap).toFixed(2)} = ` : ""}
            {r.points} pts
          </span>
        </div>
      </div>
      {r.formula && (
        <div className="small muted" style={{ marginTop: 4 }}>
          {r.formula}
          {r.recomputed
            ? " · Load recomputed for display from the stored inputs — this session predates stored Load."
            : ""}
        </div>
      )}
    </div>
  );
}
