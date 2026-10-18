/**
 * Competition engine — pure functions, no Firebase, no React.
 *
 * Points formula:  session points = minutes × difficulty × handicap
 *   - difficulty: 0.5 (easy) → 2.0 (brutal), set by the AI coach per session,
 *     relative to the athlete's capacity in that sport.
 *   - handicap: per athlete, re-evaluated every 14 days by their AI coach.
 *     Fitter athlete < 1.0, less-fit athlete > 1.0 (capped ~0.7–1.5).
 * Points are computed at write time using the handicap in effect on the
 * session date; a re-evaluation only affects new sessions.
 */

export const SPORTS = ["skiing", "running", "strength", "cycling", "swimming"];

export const SPORT_META = {
  skiing: { label: "Skiing", icon: "⛷️", color: "#7cc4ff" },
  running: { label: "Running", icon: "🏃", color: "#8ce99a" },
  strength: { label: "Strength", icon: "🏋️", color: "#b197fc" },
  cycling: { label: "Cycling", icon: "🚴", color: "#ffb35c" },
  swimming: { label: "Swimming", icon: "🏊", color: "#66d9e8" },
};

export const MIN_DIFFICULTY = 0.5;
export const MAX_DIFFICULTY = 2.0;

/* ---------------- date helpers (local "YYYY-MM-DD" strings) ---------------- */

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(str) {
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

/** Monday (YYYY-MM-DD) of the week containing dateStr. Weeks run Mon–Sun. */
export function mondayOf(dateStr) {
  const d = parseDate(dateStr);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return todayStr(d);
}

export function prettyDate(dateStr) {
  return parseDate(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/* ---------------- points ---------------- */

export function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

export function clampDifficulty(d) {
  const n = Number(d);
  if (Number.isNaN(n)) return 1.0;
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, n));
}

/**
 * Handicap in effect on a given date: the latest handicapHistory entry with
 * effectiveFrom <= date. Falls back to athlete.handicap, then 1.0.
 */
export function handicapAt(athlete, dateStr) {
  const hist = (athlete?.handicapHistory || []).filter(
    (h) => h.effectiveFrom <= dateStr
  );
  if (hist.length > 0) {
    hist.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
    return Number(hist[0].value) || 1.0;
  }
  return Number(athlete?.handicap) || 1.0;
}

/** session points = minutes × difficulty × handicap */
export function sessionPoints({ minutes, difficulty = 1.0, handicap = 1.0 }) {
  return round1(Number(minutes) * clampDifficulty(difficulty) * Number(handicap));
}

function sumPoints(list) {
  return round1(list.reduce((t, s) => t + (Number(s.points) || 0), 0));
}

/* ---------------- rolling 14-day board ---------------- */

/**
 * Per-athlete totals over the trailing 14 days ending asOf (inclusive),
 * plus the prior 14-day totals for the trend arrow. Sorted by points desc.
 */
export function rolling14Day(sessions, athletes, asOf = todayStr()) {
  const cur0 = addDays(asOf, -13);
  const prev0 = addDays(asOf, -27);
  const prev1 = addDays(asOf, -14);

  const rows = athletes.map((a) => {
    const mine = sessions.filter((s) => s.athleteId === a.id);
    const points = sumPoints(
      mine.filter((s) => s.date >= cur0 && s.date <= asOf)
    );
    const prior = sumPoints(
      mine.filter((s) => s.date >= prev0 && s.date <= prev1)
    );
    return {
      athlete: a,
      points,
      prior,
      delta: round1(points - prior),
      sessionCount: mine.filter((s) => s.date >= cur0 && s.date <= asOf).length,
    };
  });
  rows.sort((x, y) => y.points - x.points);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Daily points series for one athlete over [startStr, endStr] (for charts). */
export function dailyPoints(sessions, athleteId, startStr, endStr) {
  const out = [];
  for (let d = startStr; d <= endStr; d = addDays(d, 1)) {
    const pts = sumPoints(
      sessions.filter((s) => s.athleteId === athleteId && s.date === d)
    );
    out.push({ date: d, label: d.slice(5), points: pts });
  }
  return out;
}

/* ---------------- weekly head-to-heads ---------------- */

/**
 * Every athlete pair's points within the Mon–Sun week starting weekStartStr.
 * projectedWinner = current leader ("based on points so far" — no model in v1).
 */
export function weeklyMatchups(sessions, athletes, weekStartStr) {
  const weekEnd = addDays(weekStartStr, 6);
  const inWeek = sessions.filter(
    (s) => s.date >= weekStartStr && s.date <= weekEnd
  );
  const totals = {};
  for (const a of athletes) {
    totals[a.id] = sumPoints(inWeek.filter((s) => s.athleteId === a.id));
  }
  const pairs = [];
  for (let i = 0; i < athletes.length; i++) {
    for (let j = i + 1; j < athletes.length; j++) {
      const a = athletes[i];
      const b = athletes[j];
      const aPts = totals[a.id] || 0;
      const bPts = totals[b.id] || 0;
      pairs.push({
        a,
        b,
        aPoints: aPts,
        bPoints: bPts,
        leader: aPts === bPts ? null : aPts > bPts ? a : b,
        margin: round1(Math.abs(aPts - bPts)),
      });
    }
  }
  pairs.sort((x, y) => y.aPoints + y.bPoints - (x.aPoints + x.bPoints));
  return pairs;
}

/* ---------------- streaks & hype badges ---------------- */

/** Consecutive training days per athlete, ending today or yesterday. */
export function streaks(sessions, athletes, asOf = todayStr()) {
  const out = {};
  for (const a of athletes) {
    const days = new Set(
      sessions.filter((s) => s.athleteId === a.id).map((s) => s.date)
    );
    let cursor = days.has(asOf) ? asOf : addDays(asOf, -1);
    let n = 0;
    while (days.has(cursor)) {
      n++;
      cursor = addDays(cursor, -1);
    }
    out[a.id] = n;
  }
  return out;
}

/**
 * Hype badges:
 *  - biggestSession: highest-point session in the current Mon–Sun week
 *  - longestStreak: athlete with the longest current training-day streak
 *  - comeback: largest positive week-over-week points delta (last 7d vs prior 7d)
 */
export function hypeBadges(sessions, athletes, asOf = todayStr()) {
  const weekStart = mondayOf(asOf);
  const thisWeek = sessions.filter((s) => s.date >= weekStart && s.date <= asOf);

  let biggestSession = null;
  for (const s of thisWeek) {
    if (!biggestSession || Number(s.points) > Number(biggestSession.points)) {
      biggestSession = s;
    }
  }

  const st = streaks(sessions, athletes, asOf);
  let longestStreak = null;
  for (const a of athletes) {
    if (st[a.id] > 0 && (!longestStreak || st[a.id] > longestStreak.days)) {
      longestStreak = { athlete: a, days: st[a.id] };
    }
  }

  const last7start = addDays(asOf, -6);
  const prev7start = addDays(asOf, -13);
  const prev7end = addDays(asOf, -7);
  let comeback = null;
  for (const a of athletes) {
    const recent = sumPoints(
      sessions.filter(
        (s) => s.athleteId === a.id && s.date >= last7start && s.date <= asOf
      )
    );
    const prior = sumPoints(
      sessions.filter(
        (s) => s.athleteId === a.id && s.date >= prev7start && s.date <= prev7end
      )
    );
    const delta = round1(recent - prior);
    if (recent > 0 && delta > 0 && (!comeback || delta > comeback.delta)) {
      comeback = { athlete: a, delta, recent };
    }
  }

  return { biggestSession, longestStreak, comeback };
}

/* ---------------- AI coach block (paste-into-/log JSON) ---------------- */

const COACH_SCHEMA = {
  sport: "one of: skiing | running | strength | cycling | swimming",
  date: "YYYY-MM-DD",
  minutes: "number > 0",
  distanceKm: "number, optional",
  details: "string, optional — sets / weights / swim set times",
  difficulty: "number 0.5–2.0, REQUIRED — set by the AI coach",
  notes: "string, optional — how it felt, what the coach noticed",
};

/**
 * Parse a coach JSON block pasted into the Log page. Returns a validated
 * session-fields object (without athleteId/points) or throws a human message.
 */
export function parseCoachBlock(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error(
      "That doesn't look like valid JSON. Copy the whole block your AI coach gave you, braces and all."
    );
  }
  const problems = [];
  if (!SPORTS.includes(obj.sport))
    problems.push(`sport must be one of: ${SPORTS.join(", ")}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(obj.date || ""))
    problems.push("date must be YYYY-MM-DD");
  if (!(Number(obj.minutes) > 0)) problems.push("minutes must be a number > 0");
  const diff = Number(obj.difficulty);
  if (Number.isNaN(diff) || diff < MIN_DIFFICULTY || diff > MAX_DIFFICULTY)
    problems.push(
      `difficulty must be a number ${MIN_DIFFICULTY}–${MAX_DIFFICULTY} (set by your AI coach)`
    );
  if (obj.distanceKm != null && !(Number(obj.distanceKm) >= 0))
    problems.push("distanceKm must be a number ≥ 0");
  if (problems.length > 0) {
    throw new Error("Coach block problem: " + problems.join("; "));
  }
  return {
    sport: obj.sport,
    date: obj.date,
    minutes: Number(obj.minutes),
    distanceKm: obj.distanceKm != null ? Number(obj.distanceKm) : null,
    details: String(obj.details || ""),
    difficulty: clampDifficulty(diff),
    difficultyBy: "ai",
    notes: String(obj.notes || ""),
  };
}

export { COACH_SCHEMA };
