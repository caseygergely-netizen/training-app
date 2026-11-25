import { useEffect, useRef, useState } from "react";
import { avatarUrlFor } from "../lib/avatars.js";
import { initialsOf } from "./Avatar.jsx";
import CrownGlyph from "./CrownGlyph.jsx";
import SpoonGlyph from "./SpoonGlyph.jsx";

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
 * `spoonStreak` (optional) is their current Spoon streak — the avatar
 * wears the spoon glyph in the opposite corner from the crown, and a
 * weekly row may carry `boostFactor` (the spoon boost, shown openly
 * like the tax). `onFire` adds the 🔥 badge for the rolling 7-day
 * leader; `rankTitle` appends a court title ("The Heir" / "The
 * Pretender" / a spoon title) beside the name on weekly lanes.
 * `boardId` (optional) enables the entrance animation (Casey, Nov 16,
 * 2026): the lane remembers each athlete's points in localStorage and
 * starts the avatar at its last-seen position, gliding it to the
 * current one — you watch the ground gained since your last visit,
 * with a glow on lanes that moved. The glide waits until the lane
 * has actually scrolled into view (Nov 17, 2026: the boards sit
 * below the Throne hero, so a mount-time glide played unseen), and
 * the new position is only remembered once that glide has played —
 * an unseen visit never consumes the animation. Last-seen positions
 * are mapped through the CURRENT leader's points (an approximation
 * that's visually honest). First-ever visit starts everyone at the
 * gate. Reduced-motion users skip the glide entirely.
 */
export default function RaceLane({
  row,
  topPoints,
  color,
  reign = 0,
  boardId = "",
  spoonStreak = 0,
  onFire = false,
  rankTitle = "",
}) {
  const pct = topPoints > 0 ? 4 + (row.points / topPoints) * 88 : 4;
  const isLeader = row.rank === 1 && row.points > 0;
  const photo = avatarUrlFor(row.athlete);
  const frame = reign > 0 ? Math.min(reign, 4) : 0;
  const taxed = row.taxFactor != null && row.taxFactor < 1;
  const boosted = row.boostFactor != null && row.boostFactor > 1;
  const [shownPct, setShownPct] = useState(null);
  const [moved, setMoved] = useState(false);
  const startedRef = useRef(false);
  const laneRef = useRef(null);

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
    // Is there a glide worth watching? Anything without one (no
    // history worth animating, reduced motion, no movement) just
    // persists immediately, as before.
    let fromPct = null;
    let glow = false;
    if (prev == null) {
      // First-ever visit: start at the gate.
      if (!reduced && topPoints > 0 && row.points > 0) fromPct = 4;
    } else if (!reduced && topPoints > 0 && Number(prev) !== Number(row.points)) {
      const prevPct = Math.max(4, Math.min(92, 4 + (Number(prev) / topPoints) * 88));
      if (Math.abs(prevPct - pct) > 0.5) {
        fromPct = prevPct;
        glow = true;
      }
    }
    if (fromPct == null) {
      persist();
      return undefined;
    }
    // Hold the avatar at its last-seen position until the lane is
    // actually on screen, then glide — and only persist the new
    // position once that glide has played (Casey, Nov 17, 2026).
    setShownPct(fromPct);
    const timers = [];
    let observer = null;
    let begun = false;
    const begin = () => {
      if (begun) return;
      begun = true;
      if (glow) setMoved(true);
      timers.push(setTimeout(() => setShownPct(null), 80));
      if (glow) timers.push(setTimeout(() => setMoved(false), 4800));
      timers.push(setTimeout(persist, 4800));
    };
    const el = laneRef.current;
    if (el && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            begin();
            observer.disconnect();
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
    } else {
      begin();
    }
    return () => {
      observer?.disconnect();
      timers.forEach(clearTimeout);
    };
    // Mount-only by design: the glide replays the delta since the
    // last visit, it does not track live updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effPct = shownPct != null ? shownPct : pct;
  return (
    <div
      ref={laneRef}
      className={`race-lane${isLeader ? " leader" : ""}${moved ? " lane-moved" : ""}`}
      style={{ "--lane": color }}
    >
      <div className="race-meta">
        <span className="race-dot" />
        <span className="race-name">
          {isLeader ? "👑 " : ""}
          {row.athlete.name}
          {rankTitle && <span className="race-title"> · {rankTitle}</span>}
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
          {boosted && (
            <span className="small muted">
              {" "}
              ({row.rawPoints} × {row.boostFactor.toFixed(2)} 🥄 boost)
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
          {spoonStreak > 0 && (
            <span className="avatar-spoon" aria-hidden="true">
              <SpoonGlyph tier={Math.min(spoonStreak, 4)} width={24} />
            </span>
          )}
          {onFire && (
            <span className="avatar-fire" aria-hidden="true" title="On Fire — rolling 7-day leader">
              🔥
            </span>
          )}
        </div>
        <div className="race-finish" />
      </div>
    </div>
  );
}
