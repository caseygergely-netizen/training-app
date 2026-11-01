/**
 * Competition engine — pure functions, no Firebase, no React.
 *
 * Points formula:  session points = Load × handicap  (see pointsForSession;
 * before Oct 31, 2026 it was minutes × difficulty × handicap — old stored
 * points are never rewritten).
 *   - difficulty: 0.5 (easy) → 2.0 (brutal), set by the AI coach per session,
 *     relative to the athlete's capacity in that sport. Drives the estimated
 *     Load wherever no measured load (power / HR / Strava RE) exists.
 *   - handicap: per athlete, re-evaluated every 14 days by their AI coach.
 *     Fitter athlete < 1.0, less-fit athlete > 1.0 (capped ~0.7–1.5).
 * Points are computed at write time using the handicap in effect on the
 * session date; a re-evaluation only affects new sessions.
 */

export const SPORTS = [
  "skiing", "running", "strength", "cycling", "swimming",
  "hiking", "pilates", "yoga",
];

export const SPORT_META = {
  skiing: { label: "Skiing", icon: "⛷️", color: "#7cc4ff" },
  running: { label: "Running", icon: "🏃", color: "#8ce99a" },
  strength: { label: "Strength", icon: "🏋️", color: "#b197fc" },
  cycling: { label: "Cycling", icon: "🚴", color: "#ffb35c" },
  swimming: { label: "Swimming", icon: "🏊", color: "#66d9e8" },
  hiking: { label: "Hiking", icon: "🥾", color: "#a9d18e" },
  pilates: { label: "Pilates", icon: "🧘", color: "#f4a7c3" },
  yoga: { label: "Yoga", icon: "🕉️", color: "#c3a6e8" },
};

/**
 * Sports whose Load is ALWAYS the coach's estimate (minutes × difficulty):
 * heart rate cannot see muscular / isometric load, so an HR-derived number
 * (hrTSS, or a Strava Relative Effort, which is HR-based for these sports)
 * must never re-price them. Ratified in the Coaches' Corner, Nov 1, 2026
 * (strength), extended to pilates/yoga when those sports were added.
 * These sports also carry no Personal Bests records.
 */
export const ESTIMATED_LOAD_SPORTS = ["strength", "pilates", "yoga"];

/** Sports with no Personal Bests board (workouts count; records don't). */
export const NO_RECORD_SPORTS = ["hiking", "pilates", "yoga"];

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

export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Display a distance in km as entered — up to 2 decimals, no trailing zeros. */
export function formatKm(km) {
  const n = Number(km);
  if (Number.isNaN(n)) return "";
  return String(round2(n));
}

/** "19:42" or "1:02:33" from a total number of seconds. */
export function formatDuration(totalSec) {
  const s = Math.round(Number(totalSec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Signed delta for a duration: "-0:23" / "+0:23". */
export function formatDurationDelta(deltaSec) {
  const d = Math.round(Number(deltaSec) || 0);
  const sign = d < 0 ? "−" : "+";
  return sign + formatDuration(Math.abs(d));
}

/** Parse "MM:SS" / "H:MM:SS" / raw seconds into seconds, or null. */
export function parseClock(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number")
    return Number.isFinite(value) && value > 0 ? value : null;
  const str = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = Number(str);
    return n > 0 ? n : null;
  }
  const parts = str.split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;
  let total = null;
  if (parts.length === 2) total = parts[0] * 60 + parts[1];
  if (parts.length === 3) total = parts[0] * 3600 + parts[1] * 60 + parts[2];
  return total != null && total > 0 ? total : null;
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

/** One week's Mon–Sun totals per athlete: points, sessions, minutes. Ranked. */
export function weeklyStandings(sessions, athletes, weekStartStr) {
  const weekEnd = addDays(weekStartStr, 6);
  const rows = athletes.map((a) => {
    const mine = sessions.filter(
      (s) => s.athleteId === a.id && s.date >= weekStartStr && s.date <= weekEnd
    );
    return {
      athlete: a,
      points: sumPoints(mine),
      sessions: mine.length,
      minutes: mine.reduce((t, s) => t + (Number(s.minutes) || 0), 0),
    };
  });
  rows.sort((x, y) => y.points - x.points);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Trophy winners for every COMPLETED Mon–Sun week (newest first).
 * A week counts when its Monday is before the current week's Monday and the
 * top score is > 0. Ties share the trophy.
 * Returns [{ weekStart, weekEnd, points, winners: [athlete, ...] }].
 */
export function weeklyWinners(sessions, athletes, asOf = todayStr()) {
  if (!sessions || sessions.length === 0) return [];
  const currentMonday = mondayOf(asOf);
  let firstMonday = null;
  for (const s of sessions) {
    const m = mondayOf(s.date);
    if (firstMonday === null || m < firstMonday) firstMonday = m;
  }
  const out = [];
  for (let wk = firstMonday; wk < currentMonday; wk = addDays(wk, 7)) {
    const rows = weeklyStandings(sessions, athletes, wk);
    const top = rows[0];
    if (top && top.points > 0) {
      out.push({
        weekStart: wk,
        weekEnd: addDays(wk, 6),
        points: top.points,
        winners: rows.filter((r) => r.points === top.points).map((r) => r.athlete),
      });
    }
  }
  return out.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

/** All-time per-sport totals for one athlete: { sport: {points, sessions, minutes} }. */
export function pointsBySport(sessions, athleteId) {
  const out = {};
  for (const s of sessions) {
    if (s.athleteId !== athleteId) continue;
    const cur = out[s.sport] || { points: 0, sessions: 0, minutes: 0 };
    cur.points = round1(cur.points + (Number(s.points) || 0));
    cur.sessions += 1;
    cur.minutes += Number(s.minutes) || 0;
    out[s.sport] = cur;
  }
  return out;
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

/* ---------------- training load ---------------- */

/**
 * Training load for a session (TSS-style, ~ comparable to Strava's
 * Relative Effort scale). Priority:
 *  0. Estimated-load sports (strength / pilates / yoga): ALWAYS the
 *     estimate — HR-derived numbers can't see muscular load and must
 *     never re-price these sessions (Corner decision, Nov 1, 2026).
 *  1. Strava Relative Effort (suffer score) when present on the session.
 *  2. Cycling with power: TSS = hours × (NP or avg power / FTP)² × 100.
 *     FTP from the session (ftpW) or the athlete profile (ftpW).
 *  3. Run/swim (or any other sport) with HR: hrTSS = hours × (avg HR / threshold HR)² × 100.
 *     Threshold HR from the session (thresholdHr) or the athlete profile.
 *  4. Fallback estimate: minutes × difficulty (labelled "est"). For
 *     hiking, elevation gain adds equivalent minutes first (Naismith:
 *     ~10 min per 100 m climbed) — only on this estimated path, since a
 *     measured load already reflects the climbing.
 * Returns { value, source } where source is
 * "strava" | "tss" | "hrtss" | "est", or null when nothing is computable.
 */
export function computeLoad(session, athlete) {
  const minutes = Number(session?.minutes) || 0;
  if (!(minutes > 0)) return null;
  const hours = minutes / 60;
  const difficulty = clampDifficulty(session.difficulty ?? 1.0);

  if (ESTIMATED_LOAD_SPORTS.includes(session?.sport)) {
    return { value: Math.round(minutes * difficulty), source: "est" };
  }

  const rel = Number(session.relativeEffort);
  if (session.relativeEffort != null && rel > 0)
    return { value: Math.round(rel), source: "strava" };

  const ftp = Number(session.ftpW ?? athlete?.ftpW) || 0;
  const power = Number(session.npW ?? session.avgPowerW) || 0;
  if (session.sport === "cycling" && power > 0 && ftp > 0) {
    const ratio = power / ftp;
    return { value: Math.round(hours * ratio * ratio * 100), source: "tss" };
  }

  const avgHr = Number(session.avgHr) || 0;
  const thrHr = Number(session.thresholdHr ?? athlete?.thresholdHr) || 0;
  if (avgHr > 0 && thrHr > 0) {
    const ratio = avgHr / thrHr;
    return { value: Math.round(hours * ratio * ratio * 100), source: "hrtss" };
  }

  const elevationBonusMin =
    session.sport === "hiking" ? (Number(session.elevationGainM) || 0) / 10 : 0;
  return {
    value: Math.round((minutes + elevationBonusMin) * difficulty),
    source: "est",
  };
}

/** Load to display: the value stored at write time, else computed on the fly. */
export function displayLoad(session, athlete) {
  if (session?.load != null && Number(session.load) > 0)
    return { value: Math.round(Number(session.load)), source: session.loadSource || "est" };
  return computeLoad(session || {}, athlete);
}

/**
 * THE points rule (changed Oct 31, 2026, Casey-approved): points are scored
 * from LOAD, not raw minutes — points = Load × handicap. A bike minute and
 * a run minute no longer pay the same; each pays what it physiologically
 * cost. Where no measured load exists (most swim/strength), the estimated
 * load IS minutes × difficulty, so those sports score exactly as before
 * and the coach's difficulty still carries them. Stored points never
 * rewrite: sessions logged before the change keep their original points.
 * Returns { points, load } (load may be null when minutes are missing).
 */
export function pointsForSession(sessionFields, athlete, handicap) {
  const load = computeLoad(sessionFields, athlete);
  if (load)
    return { points: round1(load.value * Number(handicap)), load };
  return {
    points: sessionPoints({
      minutes: sessionFields?.minutes,
      difficulty: sessionFields?.difficulty ?? 1.0,
      handicap,
    }),
    load: null,
  };
}

/* ---------------- standard test sets (LEGACY — display/parsing only) ---------------- */

/**
 * Legacy formal tests. Older sessions may carry a testType and a structured
 * `test` result object; these helpers render them in the Feed and feed them
 * into the PB board via sessionMarks. NEW sessions no longer use testType —
 * personal bests now ride on ordinary workouts via the `bests` object
 * (see cleanBests / sessionMarks below).
 *  - run5k / run10k / run1k / run400m:  test = { timeSec }
 *  - swimCss:   test = { t400Sec, t200Sec }       (CSS pace derived)
 *  - swim1500 / swim100 / swim50:       test = { timeSec }
 *  - bikeFtp / bike60min / bike5min / bike1min / bike5s:
 *                                       test = { avgPowerW } (ftpEstimateW on bikeFtp)
 *  - ski10k / ski1k:                    test = { timeSec, conditions }
 *  - strength5rm: test = { lifts: { squat|bench|deadlift: {weightKg, reps} },
 *                          oneRm: { squat, bench, deadlift, totalKg } }
 *  - strengthBestSet: test = { label, weightKg, reps }  (est. 1RM derived)
 */
export const TEST_TYPES = {
  run5k: { sport: "running", kind: "aerobic", label: "5 km time trial", short: "5K TT" },
  run10k: { sport: "running", kind: "aerobic", label: "10 km time trial", short: "10K TT" },
  run1k: { sport: "running", kind: "anaerobic", label: "1 km time trial", short: "1K TT" },
  run400m: { sport: "running", kind: "anaerobic", label: "400 m sprint", short: "400 m" },
  swimCss: { sport: "swimming", kind: "aerobic", label: "CSS test — 400 m + 200 m", short: "CSS test" },
  swim1500: { sport: "swimming", kind: "aerobic", label: "1500 m time trial", short: "1500 m TT" },
  swim100: { sport: "swimming", kind: "anaerobic", label: "100 m sprint", short: "100 m" },
  swim50: { sport: "swimming", kind: "anaerobic", label: "50 m sprint", short: "50 m" },
  bikeFtp: { sport: "cycling", kind: "aerobic", label: "20-min FTP test", short: "20-min FTP" },
  bike60min: { sport: "cycling", kind: "aerobic", label: "60-min power test", short: "60-min power" },
  bike5min: { sport: "cycling", kind: "anaerobic", label: "5-min power test", short: "5-min power" },
  bike1min: { sport: "cycling", kind: "anaerobic", label: "1-min power test", short: "1-min power" },
  bike5s: { sport: "cycling", kind: "anaerobic", label: "5-s power test", short: "5-s power" },
  ski10k: { sport: "skiing", kind: "aerobic", label: "10 km time trial", short: "10K TT" },
  ski1k: { sport: "skiing", kind: "anaerobic", label: "1 km time trial", short: "1K TT" },
  strength5rm: { sport: "strength", kind: "anaerobic", label: "5RM test day", short: "5RM day" },
  strengthBestSet: { sport: "strength", kind: "anaerobic", label: "Best single set", short: "Best set" },
};

/** Test types whose result is a single clock time { timeSec } (ski types add conditions). */
export const TIME_TEST_TYPES = ["run5k", "run10k", "run1k", "run400m", "swim1500", "swim100", "swim50", "ski10k", "ski1k"];
/** Test types whose result is a power number { avgPowerW }. */
export const POWER_TEST_TYPES = ["bikeFtp", "bike60min", "bike5min", "bike1min", "bike5s"];

export function testTypesForSport(sport) {
  return Object.entries(TEST_TYPES)
    .filter(([, t]) => t.sport === sport)
    .map(([key, t]) => ({ key, ...t }));
}

/** Epley estimated 1RM from a top set. */
export function epley1RM(weightKg, reps) {
  const w = Number(weightKg) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return round1(w * (1 + r / 30));
}

/** CSS pace (seconds per 100 m) from a swimCss test result. */
export function cssPacePer100(test) {
  const t400 = Number(test?.t400Sec) || 0;
  const t200 = Number(test?.t200Sec) || 0;
  if (!(t400 > t200 && t200 > 0)) return null;
  // CSS speed = 200 m / (T400 − T200); pace per 100 m = (T400 − T200) / 2.
  return round1((t400 - t200) / 2);
}

const LIFT_LABELS = { squat: "Squat", bench: "Bench", deadlift: "Deadlift" };

/** Human headline for a test session, e.g. "5K TT — 19:42". */
export function testHeadline(session) {
  const t = session?.test || {};
  const type = session?.testType;
  const meta = TEST_TYPES[type];
  if (TIME_TEST_TYPES.includes(type)) {
    return t.timeSec
      ? `${meta.short} — ${formatDuration(t.timeSec)}`
      : meta.label;
  }
  switch (type) {
    case "swimCss": {
      const pace = cssPacePer100(t);
      return pace != null
        ? `CSS ${formatDuration(pace)}/100 m (400 ${formatDuration(t.t400Sec)} · 200 ${formatDuration(t.t200Sec)})`
        : "CSS test";
    }
    case "bikeFtp":
      return t.avgPowerW
        ? `20-min power ${Math.round(t.avgPowerW)} W${t.ftpEstimateW ? ` · FTP ≈ ${Math.round(t.ftpEstimateW)} W` : ""}`
        : "20-min FTP test";
    case "strength5rm":
      return t.oneRm?.totalKg
        ? `Est. 1RM total ${Math.round(t.oneRm.totalKg)} kg`
        : "5RM test day";
    case "strengthBestSet":
      return t.weightKg
        ? `${t.label || "Best set"}: ${t.weightKg} kg × ${t.reps} (est. 1RM ${Math.round(epley1RM(t.weightKg, t.reps))} kg)`
        : "Best single set";
    default:
      if (POWER_TEST_TYPES.includes(type)) {
        return t.avgPowerW ? `${meta.short} ${Math.round(t.avgPowerW)} W` : meta.label;
      }
      return meta?.label || "Test";
  }
}

/** Detail lines for a test result (used under the headline). */
export function testDetailLines(session) {
  const t = session?.test || {};
  const lines = [];
  if ((session?.testType === "ski10k" || session?.testType === "ski1k") && t.conditions)
    lines.push(`Snow: ${t.conditions} (times are condition-dependent)`);
  if (session?.testType === "strength5rm" && t.lifts) {
    for (const lift of Object.keys(LIFT_LABELS)) {
      const set = t.lifts[lift];
      if (set)
        lines.push(
          `${LIFT_LABELS[lift]}: ${set.weightKg} kg × ${set.reps} → est. 1RM ${Math.round(
            t.oneRm?.[lift] || epley1RM(set.weightKg, set.reps)
          )} kg`
        );
    }
  }
  return lines;
}

/**
 * Primary comparable number for a test type (lower = better for times/CSS,
 * higher = better for power/strength). Used for PB deltas.
 */
export function testMetric(session) {
  const t = session?.test || {};
  const type = session?.testType;
  if (TIME_TEST_TYPES.includes(type)) {
    return t.timeSec ? { value: Number(t.timeSec), kind: "time" } : null;
  }
  if (POWER_TEST_TYPES.includes(type)) {
    return t.avgPowerW ? { value: Number(t.avgPowerW), kind: "power" } : null;
  }
  switch (type) {
    case "swimCss": {
      const pace = cssPacePer100(t);
      return pace != null ? { value: pace, kind: "time" } : null;
    }
    case "strength5rm":
      return t.oneRm?.totalKg ? { value: Number(t.oneRm.totalKg), kind: "weight" } : null;
    case "strengthBestSet":
      return t.weightKg
        ? { value: epley1RM(t.weightKg, t.reps), kind: "weight" }
        : null;
    default:
      return null;
  }
}

/** "−0:23 vs previous test" style delta between two tests of the same type. */
export function testDelta(latest, previous) {
  const a = testMetric(latest);
  const b = testMetric(previous);
  if (!a || !b) return null;
  const diff = a.value - b.value;
  if (a.kind === "time")
    return { text: `${formatDurationDelta(diff)} vs previous test`, improved: diff < 0 };
  const unit = a.kind === "power" ? " W" : " kg";
  return {
    text: `${diff > 0 ? "+" : "−"}${Math.abs(round1(diff))}${unit} vs previous test`,
    improved: diff > 0,
  };
}

/** All test sessions of one type for one athlete, newest first. */
export function testsOfType(sessions, athleteId, testType) {
  return sessions
    .filter((s) => s.athleteId === athleteId && s.testType === testType)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* ---------------- personal-best benchmark board ---------------- */

/**
 * Personal bests are derived from WORKOUTS, not formal test entries.
 * A session can carry a `bests` object — the best efforts CONTAINED IN
 * that workout, extracted by the coach from the activity file (Strava
 * power curve, Garmin splits, pool splits):
 *   bests = {
 *     power60minW, power20minW, power5minW, power1minW, power5sW,  // watts
 *     run10kSec, run5kSec, run1kSec, run400mSec,                    // seconds
 *     swim1500Sec, swim400Sec, swim200Sec, swim100Sec, swim50Sec,  // seconds
 *     ski10kSec, ski1kSec,                                         // seconds
 *     skiConditions: "free text",           // for ski bests in this session
 *     lifts: { squat|bench|deadlift: { weightKg, reps } },  // best set per lift
 *     bestSet: { label, weightKg, reps },   // best set of any other movement
 *   }
 * A swim CSS pace derives from any session whose bests hold BOTH a 400 m
 * and a 200 m time. Legacy sessions logged as formal tests (testType +
 * test) feed the same board via sessionMarks — no historical mark is lost.
 */

const BEST_TIME_KEYS = [
  ["run10k", "run10kSec"],
  ["run5k", "run5kSec"],
  ["run1k", "run1kSec"],
  ["run400m", "run400mSec"],
  ["swim1500", "swim1500Sec"],
  ["swim400", "swim400Sec"],
  ["swim200", "swim200Sec"],
  ["swim100", "swim100Sec"],
  ["swim50", "swim50Sec"],
  ["ski10k", "ski10kSec"],
  ["ski1k", "ski1kSec"],
];
const BEST_POWER_KEYS = ["power60minW", "power20minW", "power5minW", "power1minW", "power5sW"];
const BEST_LIFTS = ["squat", "bench", "deadlift"];
const TIME_MARK_KEYS = ["run10k", "run5k", "run1k", "run400m", "swim1500", "swim400", "swim100", "swim50", "ski10k", "ski1k"];
const POWER_MARK_BY_BEST = { power60minW: "bike60min", power20minW: "bike20min", power5minW: "bike5min", power1minW: "bike1min", power5sW: "bike5s" };
const POWER_MARK_BY_TEST = { bikeFtp: "bike20min", bike60min: "bike60min", bike5min: "bike5min", bike1min: "bike1min", bike5s: "bike5s" };

/** Validate + normalize a raw coach-block `bests` object. Returns { bests } or { problem }. */
export function cleanBests(raw) {
  if (raw == null || typeof raw !== "object")
    return { problem: '"bests" must be an object of best efforts' };
  const bests = {};
  for (const [short, secKey] of BEST_TIME_KEYS) {
    const v = raw[secKey] ?? raw[short];
    if (v == null) continue;
    const sec = parseClock(v);
    if (!sec) return { problem: `bests.${short} must be seconds or "MM:SS"` };
    bests[secKey] = Math.round(sec);
  }
  for (const key of BEST_POWER_KEYS) {
    const v = raw[key];
    if (v == null) continue;
    if (!(Number(v) > 0)) return { problem: `bests.${key} must be watts > 0` };
    bests[key] = Math.round(Number(v));
  }
  if (raw.skiConditions != null) bests.skiConditions = String(raw.skiConditions);
  if (raw.lifts != null) {
    if (typeof raw.lifts !== "object") return { problem: '"bests.lifts" must be an object' };
    const lifts = {};
    for (const lift of BEST_LIFTS) {
      const set = raw.lifts[lift];
      if (set == null) continue;
      const weightKg = Number(set.weightKg);
      const reps = Number(set.reps);
      if (!(weightKg > 0) || !(reps > 0))
        return { problem: `bests.lifts.${lift} needs weightKg and reps > 0` };
      lifts[lift] = { weightKg, reps };
    }
    if (Object.keys(lifts).length > 0) bests.lifts = lifts;
  }
  if (raw.bestSet != null) {
    const label = String(raw.bestSet.label || "").trim();
    const weightKg = Number(raw.bestSet.weightKg);
    const reps = Number(raw.bestSet.reps);
    if (!label) return { problem: "bests.bestSet needs a label (which movement)" };
    if (!(weightKg > 0) || !(reps > 0))
      return { problem: "bests.bestSet needs weightKg and reps > 0" };
    bests.bestSet = { label, weightKg, reps };
  }
  if (Object.keys(bests).length === 0)
    return { problem: '"bests" had no recognized best efforts in it' };
  return { bests };
}

/**
 * Every comparable mark a session contributes to the PB board, from its
 * workout bests and (for older entries) its formal-test result.
 * Mark: { metric, value, kind: "time"|"power"|"weight", date, estimated, label?, conditions?, parts? }.
 */
export function sessionMarks(session) {
  const marks = [];
  const date = session?.date;
  const b = session?.bests;
  if (b && typeof b === "object") {
    for (const key of TIME_MARK_KEYS) {
      const sec = Number(b[`${key}Sec`]) || 0;
      if (sec > 0)
        marks.push({
          metric: key, value: sec, kind: "time", date, estimated: false,
          conditions: key.startsWith("ski") ? b.skiConditions || "" : "",
        });
    }
    for (const [key, metric] of Object.entries(POWER_MARK_BY_BEST)) {
      const w = Number(b[key]) || 0;
      if (w > 0) marks.push({ metric, value: w, kind: "power", date, estimated: false });
    }
    // CSS pace derives from a session containing both a 400 and a 200 best.
    const t400 = Number(b.swim400Sec) || 0;
    const t200 = Number(b.swim200Sec) || 0;
    if (t400 > t200 && t200 > 0)
      marks.push({ metric: "swimCssPace", value: round1((t400 - t200) / 2), kind: "time", date, estimated: false });
    if (b.lifts) {
      let total = 0;
      let all = true;
      const parts = {};
      for (const lift of BEST_LIFTS) {
        const set = b.lifts[lift];
        if (!set) { all = false; continue; }
        const v = epley1RM(set.weightKg, set.reps);
        if (v > 0) {
          marks.push({ metric: `lift_${lift}`, value: v, kind: "weight", date, estimated: false });
          parts[lift] = v;
          total += v;
        }
      }
      if (all && total > 0)
        marks.push({ metric: "strengthTotal", value: round1(total), kind: "weight", date, estimated: false, parts });
    }
    if (b.bestSet) {
      const v = epley1RM(b.bestSet.weightKg, b.bestSet.reps);
      if (v > 0)
        marks.push({ metric: "strengthBestSet", value: v, kind: "weight", date, estimated: false, label: b.bestSet.label || "" });
    }
  }
  // Legacy formal-test sessions feed the same board.
  const type = session?.testType;
  if (type && TEST_TYPES[type]) {
    const t = session.test || {};
    if (TIME_TEST_TYPES.includes(type)) {
      if (t.timeSec)
        marks.push({ metric: type, value: Number(t.timeSec), kind: "time", date, estimated: false, conditions: t.conditions || "" });
    } else if (POWER_MARK_BY_TEST[type]) {
      if (t.avgPowerW)
        marks.push({ metric: POWER_MARK_BY_TEST[type], value: Number(t.avgPowerW), kind: "power", date, estimated: false });
    } else if (type === "swimCss") {
      const pace = cssPacePer100(t);
      if (pace != null)
        marks.push({ metric: "swimCssPace", value: pace, kind: "time", date, estimated: false });
      if (t.t400Sec)
        marks.push({ metric: "swim400", value: Number(t.t400Sec), kind: "time", date, estimated: false });
    } else if (type === "strength5rm") {
      for (const lift of BEST_LIFTS) {
        const v = Number(t.oneRm?.[lift]) || 0;
        if (v > 0) marks.push({ metric: `lift_${lift}`, value: round1(v), kind: "weight", date, estimated: false });
      }
      if (t.oneRm?.totalKg)
        marks.push({
          metric: "strengthTotal", value: Number(t.oneRm.totalKg), kind: "weight", date, estimated: false,
          parts: { squat: t.oneRm.squat || 0, bench: t.oneRm.bench || 0, deadlift: t.oneRm.deadlift || 0 },
        });
    } else if (type === "strengthBestSet") {
      const v = epley1RM(t.weightKg, t.reps);
      if (v > 0)
        marks.push({ metric: "strengthBestSet", value: v, kind: "weight", date, estimated: false, label: t.label || "" });
    }
  }
  return marks;
}

const MARK_LABELS = {
  run10k: "10K", run5k: "5K", run1k: "1K", run400m: "400 m",
  swim1500: "1500 m", swim400: "400 m", swim100: "100 m", swim50: "50 m",
  ski10k: "10K ski", ski1k: "1K ski",
  bike60min: "60-min power", bike20min: "20-min power", bike5min: "5-min power",
  bike1min: "1-min power", bike5s: "5-s power",
};

/** Short human summary of a session's workout bests, e.g. "20-min power 305 W · 400 m 5:13". */
export function bestsHeadline(session) {
  const b = session?.bests;
  if (!b || typeof b !== "object") return "";
  const parts = [];
  for (const key of TIME_MARK_KEYS) {
    const sec = Number(b[`${key}Sec`]) || 0;
    if (sec > 0) parts.push(`${MARK_LABELS[key]} ${formatDuration(sec)}`);
  }
  const t400 = Number(b.swim400Sec) || 0;
  const t200 = Number(b.swim200Sec) || 0;
  if (t200 > 0) parts.push(`200 m ${formatDuration(t200)}`);
  if (t400 > t200 && t200 > 0)
    parts.push(`CSS ${formatDuration(round1((t400 - t200) / 2))}/100 m`);
  for (const [key, metric] of Object.entries(POWER_MARK_BY_BEST)) {
    const w = Number(b[key]) || 0;
    if (w > 0) parts.push(`${MARK_LABELS[metric]} ${Math.round(w)} W`);
  }
  if (b.lifts)
    for (const lift of BEST_LIFTS) {
      const set = b.lifts[lift];
      if (set) parts.push(`${lift} ${set.weightKg} kg × ${set.reps}`);
    }
  if (b.bestSet) parts.push(`${b.bestSet.label} ${b.bestSet.weightKg} kg × ${b.bestSet.reps}`);
  return parts.join(" · ");
}

/**
 * PBs per athlete, derived from their sessions (see sessionMarks):
 *  - Classic five keep their output shapes: run5k {seconds}, swim400
 *    {seconds}, bike20min {watts, wPerKg}, ski10k {seconds, conditions},
 *    strengthTotal {totalKg, squat, bench, deadlift}.
 *  - Extended marks: { value, kind, date, label } keyed by metric.
 * Real marks (workout bests / legacy tests) always win; the classic time
 * PBs fall back to a pace-scaled estimate from training, labelled as such.
 */
export function computePBs(sessions, athlete) {
  const mine = sessions.filter((s) => s.athleteId === athlete?.id);
  const out = { run5k: null, swim400: null, bike20min: null, ski10k: null, strengthTotal: null };

  const marks = [];
  for (const s of mine) marks.push(...sessionMarks(s));
  const bestMark = (metric) => {
    let best = null;
    for (const m of marks) {
      if (m.metric !== metric) continue;
      const better = !best || (m.kind === "time" ? m.value < best.value : m.value > best.value);
      if (better) best = m;
    }
    return best;
  };

  // Pace-scaled estimate for a classic distance when no real mark exists.
  const paceEstimate = (sport, targetKm) => {
    let best = null;
    for (const s of mine) {
      if (s.sport !== sport || !(Number(s.distanceKm) >= targetKm) || !(Number(s.minutes) > 0)) continue;
      const sec = (Number(s.minutes) * 60 * targetKm) / Number(s.distanceKm);
      if (!best || sec < best.seconds) best = { seconds: round1(sec), date: s.date, estimated: true };
    }
    return best;
  };

  // --- running 5K ---
  const run5kMark = bestMark("run5k");
  out.run5k = run5kMark
    ? { seconds: run5kMark.value, date: run5kMark.date, estimated: false }
    : paceEstimate("running", 5);

  // --- swimming 400 m ---
  const swim400Mark = bestMark("swim400");
  out.swim400 = swim400Mark
    ? { seconds: swim400Mark.value, date: swim400Mark.date, estimated: false }
    : paceEstimate("swimming", 0.4);

  // --- skiing 10K ---
  const ski10kMark = bestMark("ski10k");
  if (ski10kMark) {
    out.ski10k = { seconds: ski10kMark.value, date: ski10kMark.date, estimated: false, conditions: ski10kMark.conditions || "" };
  } else {
    const est = paceEstimate("skiing", 10);
    out.ski10k = est ? { ...est, conditions: "" } : null;
  }

  // --- cycling 20-min power: real marks first, then plain session fields ---
  const bike20Mark = bestMark("bike20min");
  let bestPower = bike20Mark
    ? { watts: Math.round(bike20Mark.value), date: bike20Mark.date, estimated: false }
    : null;
  if (!bestPower) {
    for (const s of mine) {
      if (s.sport !== "cycling") continue;
      const candidates = [];
      if (s.maxPower20W) candidates.push(Number(s.maxPower20W));
      // A ride of ≥20 min: average power is a floor for 20-min mean-max.
      if (Number(s.minutes) >= 20 && s.avgPowerW) candidates.push(Number(s.avgPowerW));
      for (const w of candidates) {
        if (w > 0 && (!bestPower || w > bestPower.watts))
          bestPower = { watts: Math.round(w), date: s.date, estimated: true };
      }
    }
  }
  if (bestPower) {
    const weightKg = Number(athlete?.weightKg) || 0;
    out.bike20min = { ...bestPower, wPerKg: weightKg > 0 ? round2(bestPower.watts / weightKg) : null };
  }

  // --- strength 1RM total (from a single session carrying all three lifts) ---
  const totalMark = bestMark("strengthTotal");
  if (totalMark) {
    out.strengthTotal = {
      totalKg: round1(totalMark.value),
      squat: totalMark.parts?.squat || 0,
      bench: totalMark.parts?.bench || 0,
      deadlift: totalMark.parts?.deadlift || 0,
      date: totalMark.date,
      estimated: false,
    };
  }

  // --- extended marks ---
  for (const metric of [
    "run10k", "run1k", "run400m",
    "swim1500", "swim100", "swim50", "swimCssPace",
    "bike60min", "bike5min", "bike1min", "bike5s",
    "ski1k", "strengthBestSet",
    "lift_squat", "lift_bench", "lift_deadlift",
  ]) {
    const m = bestMark(metric);
    out[metric] = m
      ? { value: m.kind === "weight" ? round1(m.value) : m.value, kind: m.kind, date: m.date, label: m.label || "" }
      : null;
  }

  return out;
}

/* ---------------- AI coach block (paste-into-/log JSON) ---------------- */

const COACH_SCHEMA = {
  sport: "one of: skiing | running | strength | cycling | swimming | hiking | pilates | yoga",
  date: "YYYY-MM-DD",
  minutes: "number > 0",
  distanceKm: "number, optional — decimals welcome, e.g. 33.66",
  elevationGainM: "number, optional — total climbing in metres (hiking; feeds the estimated Load when no measured load exists)",
  details: "string, optional — sets / weights / swim set times",
  difficulty: "number 0.5–2.0, REQUIRED — set by the AI coach",
  notes: "string, optional — how it felt, what the coach noticed",
  avgHr: "number, optional — average heart rate (feeds the Load metric)",
  avgPowerW: "number, optional — average power in watts (cycling)",
  npW: "number, optional — normalized power in watts (cycling)",
  relativeEffort: "number, optional — Strava Relative Effort / suffer score (used as Load)",
  maxPower20W: "number, optional — best 20-min mean-max power in watts (feeds the PB board)",
  sourceId:
    "string, optional — the source activity ID (e.g. Strava activity number). Strongly recommended: the app blocks a second session with the same sourceId for the same athlete (duplicate protection)",
  bests:
    "object, optional — the best efforts CONTAINED IN this workout, extracted from the activity file (Strava power curve, Garmin/pool splits). They feed the Personal Bests board; there are no separate test entries (see 'bests shapes'). Only include efforts the data supports.",
  "bests shapes": {
    "cycling power (watts, mean-max for the duration)":
      "{ power60minW, power20minW, power5minW, power1minW, power5sW } — any subset",
    "times (seconds, or \"MM:SS\" strings)":
      "run10k / run5k / run1k / run400m · swim1500 / swim400 / swim200 / swim100 / swim50 · ski10k / ski1k — any subset, as keys of the bests object",
    swimCss:
      'include BOTH swim400 and swim200 in the same session\'s bests — CSS pace is derived from the pair',
    "ski conditions": 'add skiConditions: "cold, fast" alongside ski bests — ski times are condition-dependent',
    strength:
      "{ lifts: { squat: {weightKg, reps}, bench: {...}, deadlift: {...} }, bestSet: { label, weightKg, reps } } — best set per lift actually performed; bestSet covers any other movement",
  },
};

/**
 * Source activity ID for duplicate protection: an explicit sourceId wins;
 * otherwise pull "Strava 20759801918" / "strava: 123456" style IDs out of
 * the details text.
 */
export function extractSourceId(details, sourceId) {
  const explicit = String(sourceId || "").trim();
  if (explicit) return explicit;
  const m = String(details || "").match(
    /(?:strava|garmin|activity)\s*(?:id)?\s*[:#]?\s*(\d{6,})/i
  );
  return m ? m[1] : "";
}

/** An existing session of this athlete carrying the same source ID, or null. */
export function findDuplicateSession(sessions, athleteId, sourceId, excludeId = null) {
  const id = String(sourceId || "").trim();
  if (!id) return null;
  return (
    sessions.find(
      (s) =>
        s.athleteId === athleteId &&
        s.id !== excludeId &&
        extractSourceId(s.details, s.sourceId) === id
    ) || null
  );
}

/** Validate + normalize a test result object. Returns { test } or { problem }. */
export function cleanTestResult(testType, raw) {
  if (raw == null || typeof raw !== "object")
    return { problem: `testType "${testType}" needs a "test" object with the result` };
  if (TIME_TEST_TYPES.includes(testType)) {
    const timeSec = parseClock(raw.timeSec ?? raw.time);
    if (!timeSec)
      return { problem: `${testType} test needs timeSec (seconds) or time ("MM:SS")` };
    const test = { timeSec: Math.round(timeSec) };
    if (testType === "ski10k" || testType === "ski1k")
      test.conditions = String(raw.conditions || "");
    return { test };
  }
  if (POWER_TEST_TYPES.includes(testType)) {
    const avgPowerW = Number(raw.avgPowerW ?? raw.powerW);
    if (!(avgPowerW > 0)) return { problem: `${testType} test needs avgPowerW > 0` };
    const test = { avgPowerW: Math.round(avgPowerW) };
    if (testType === "bikeFtp") test.ftpEstimateW = Math.round(avgPowerW * 0.95);
    return { test };
  }
  switch (testType) {
    case "swimCss": {
      const t400Sec = parseClock(raw.t400Sec ?? raw.t400);
      const t200Sec = parseClock(raw.t200Sec ?? raw.t200);
      if (!t400Sec || !t200Sec)
        return { problem: 'swimCss test needs t400Sec and t200Sec (seconds or "M:SS")' };
      if (!(t400Sec > t200Sec))
        return { problem: "swimCss: the 400 m time must be longer than the 200 m time" };
      return { test: { t400Sec: Math.round(t400Sec), t200Sec: Math.round(t200Sec) } };
    }
    case "strengthBestSet": {
      const label = String(raw.label || "").trim();
      const weightKg = Number(raw.weightKg);
      const reps = Number(raw.reps);
      if (!label) return { problem: "strengthBestSet test needs a label (which lift / movement)" };
      if (!(weightKg > 0) || !(reps > 0))
        return { problem: "strengthBestSet test needs weightKg and reps > 0" };
      return { test: { label, weightKg, reps } };
    }
    case "strength5rm": {
      const lifts = {};
      const oneRm = {};
      let total = 0;
      for (const lift of ["squat", "bench", "deadlift"]) {
        const set = raw.lifts?.[lift];
        if (set == null) continue;
        const weightKg = Number(set.weightKg);
        const reps = Number(set.reps);
        if (!(weightKg > 0) || !(reps > 0))
          return { problem: `strength5rm lifts.${lift} needs weightKg and reps > 0` };
        lifts[lift] = { weightKg, reps };
        oneRm[lift] = epley1RM(weightKg, reps);
        total += oneRm[lift];
      }
      if (Object.keys(lifts).length === 0)
        return {
          problem:
            "strength5rm test needs lifts with at least one of squat / bench / deadlift",
        };
      oneRm.totalKg = round1(total);
      return { test: { lifts, oneRm } };
    }
    default:
      return { problem: `unknown testType "${testType}"` };
  }
}

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
  if (obj.elevationGainM != null && !(Number(obj.elevationGainM) >= 0))
    problems.push("elevationGainM must be a number ≥ 0");

  // Optional performance data (Strava exports, power meters, HR straps).
  const perf = {};
  for (const key of ["avgHr", "avgPowerW", "npW", "relativeEffort", "maxPower20W", "ftpW"]) {
    if (obj[key] != null) {
      if (!(Number(obj[key]) > 0)) problems.push(`${key} must be a number > 0`);
      else perf[key] = Number(obj[key]);
    }
  }

  // Optional workout-derived best efforts (feed the PB board).
  let bests = null;
  if (obj.bests != null) {
    const cleaned = cleanBests(obj.bests);
    if (cleaned.problem) problems.push(cleaned.problem);
    else bests = cleaned.bests;
  }

  // Legacy formal-test fields (testType/test) are retired — new sessions
  // carry efforts in "bests". Never drop them silently (a dropped swim CSS
  // test cost Braeden his PB board entry on Nov 1, 2026): a swimCss test
  // converts cleanly to bests; anything else is a loud error so the coach
  // re-sends in the current shape.
  if (obj.testType != null || obj.test != null) {
    if (obj.testType === "swimCss") {
      const cleanedTest = cleanTestResult("swimCss", obj.test);
      if (cleanedTest.problem) problems.push(cleanedTest.problem);
      else {
        bests = bests || {};
        if (bests.swim400Sec == null) bests.swim400Sec = cleanedTest.test.t400Sec;
        if (bests.swim200Sec == null) bests.swim200Sec = cleanedTest.test.t200Sec;
      }
    } else {
      problems.push(
        `testType/test are retired (got testType "${obj.testType || ""}") — carry the effort in "bests" instead (AI Coach page, Best Efforts)`
      );
    }
  }

  if (problems.length > 0) {
    throw new Error("Coach block problem: " + problems.join("; "));
  }
  return {
    sport: obj.sport,
    date: obj.date,
    minutes: Number(obj.minutes),
    distanceKm: obj.distanceKm != null ? round2(obj.distanceKm) : null,
    elevationGainM: obj.elevationGainM != null ? Math.round(Number(obj.elevationGainM)) : null,
    details: String(obj.details || ""),
    difficulty: clampDifficulty(diff),
    difficultyBy: "ai",
    notes: String(obj.notes || ""),
    sourceId: extractSourceId(String(obj.details || ""), obj.sourceId),
    ...perf,
    bests,
  };
}

export { COACH_SCHEMA };
