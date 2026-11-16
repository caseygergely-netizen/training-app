import { useEffect, useRef, useState } from "react";
import { avatarUrlFor } from "../lib/avatars.js";
import { initialsOf } from "./Avatar.jsx";
import CrownGlyph from "./CrownGlyph.jsx";

export const LANE_COLORS = [
  "#c6ff4a",
  "#7cc4ff",
  "#ffb35c",
  "#b197fc",
  "#66d9e8",
  "#ff8fa3",
  "#8ce99a",
  "#ffd43b",
];

/**
 * One lane of a race board (used by the Dashboard's weekly + quarterly races).
 * Track position scales with points: the leader sits at 92% (at the flag),
 * everyone else proportionally behind. Zero points = at the gate (4%).
 * `row` is a standings row: { athlete, points, rank } — on the weekly
 * race it may also carry `rawPoints` / `taxFactor` (the Throne's dynasty
 * tax), in which case `points` is the taxed score the race runs on.
 * `reign` (optional) is the athlete's current Throne reign in weeks:
 * their lane avatar wears the crown + reign frame while they hold it.
 * `boardId` (optional) enables the entrance animation (Casey, Nov 16,
 * 2026): the lane remembers each athlete's points in localStorage and,
 * on mount, starts the avatar at its last-seen position and glides it
 * to the current one — you watch the ground gained since your last
 * visit, with a glow on lanes that moved. Last-seen positions are
 * mapped through the CURRENT leader's points (an approximation that's
 * visually honest). First-ever visit starts everyone at the gate.
 * Reduced-motion users skip the glide entirely.
 */
export default function RaceLane({ row, topPoints, color, reign = 0, boardId = "" }) {
  const pct = topPoints > 0 ? 4 + (row.points / topPoints) * 88 : 4;
  const isLeader = row.rank === 1 && row.points > 0;
  const photo = avatarUrlFor(row.athlete);
  const frame = reign > 0 ? Math.min(reign, 4) : 0;
  const taxed = row.taxFactor != null && row.taxFactor < 1;
  const [shownPct, setShownPct] = useState(null);
  const [moved, setMoved] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!boardId) return undefined;
    const key = `fomo.laneSeen.${boardId}`;
    const persist = () => {
      try {
        const cur = JSON.parse(localStorage.getItem(key) || "{}");
        cur[row.athlete.id] = row.points;
        localStorage.setItem(key, JSON.stringify(cur));
      } catch {
        /* storage unavailable — animation just won't persist */
      }
    };
    let seen = {};
    try {
      seen = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      seen = {};
    }
    const prev = seen[row.athlete.id];
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (
      prev == null ||
      reduced ||
      topPoints <= 0 ||
      Number(prev) === Number(row.points)
    ) {
      // No history: start at the gate for the very first visit, then
      // remember where everyone stood.
      if (prev == null && !reduced && topPoints > 0 && row.points > 0) {
        setShownPct(4);
        const t = setTimeout(() => setShownPct(null), 80);
        const p = setTimeout(persist, 1600);
        return () => {
          clearTimeout(t);
          clearTimeout(p);
        };
      }
      persist();
      return undefined;
    }
    const prevPct = Math.max(4, Math.min(92, 4 + (Number(prev) / topPoints) * 88));
    if (Math.abs(prevPct - pct) <= 0.5) {
      persist();
      return undefined;
    }
    setShownPct(prevPct);
    setMoved(true);
    const t1 = setTimeout(() => setShownPct(null), 80);
    const t2 = setTimeout(() => setMoved(false), 2600);
    const t3 = setTimeout(persist, 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // Mount-only by design: the glide replays the delta since the
    // last visit, it does not track live updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effPct = shownPct != null ? shownPct : pct;
  return (
    <div
      className={`race-lane${isLeader ? " leader" : ""}${moved ? " lane-moved" : ""}`}
      style={{ "--lane": color }}
    >
      <div className="race-meta">
        <span className="race-dot" />
        <span className="race-name">
          {isLeader ? "👑 " : ""}
          {row.athlete.name}
        </span>
        <span className="race-pts">
          {row.points}
          <span className="small muted"> pts</span>
          {taxed && (
            <span className="small muted">
              {" "}
              ({row.rawPoints} × {row.taxFactor.toFixed(2)} 👑 tax)
            </span>
          )}
        </span>
      </div>
      <div className="race-track">
        <div className="race-fill" style={{ width: `${effPct}%` }} />
        <div
          className={`race-avatar${frame ? ` frame-${frame}` : ""}`}
          style={{ left: `${effPct}%` }}
          title={`${row.athlete.name} — ${row.points} pts`}
        >
          {photo ? (
            <img src={photo} alt={row.athlete.name} draggable={false} />
          ) : (
            initialsOf(row.athlete.name)
          )}
          {frame > 0 && (
            <span className="avatar-crown" aria-hidden="true">
              <CrownGlyph tier={Math.min(reign, 5)} width={30} />
            </span>
          )}
        </div>
        <div className="race-finish" />
      </div>
    </div>
  );
}
