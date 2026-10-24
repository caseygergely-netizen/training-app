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
 *  1. Strava Relative Effort (suffer score) when present on the session.
 *  2. Cycling with power: TSS = hours × (NP or avg power / FTP)² × 100.
 *     FTP from the session (ftpW) or the athlete profile (ftpW).
 *  3. Run/swim (or any sport) with HR: hrTSS = hours × (avg HR / threshold HR)² × 100.
 *     Threshold HR from the session (thresholdHr) or the athlete profile.
 *  4. Fallback estimate: minutes × difficulty (labelled "est").
 * Returns { value, source } where source is
 * "strava" | "tss" | "hrtss" | "est", or null when nothing is computable.
 */
export function computeLoad(session, athlete) {
  const minutes = Number(session?.minutes) || 0;
  if (!(minutes > 0)) return null;
  const hours = minutes / 60;

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

  return {
    value: Math.round(minutes * clampDifficulty(session.difficulty ?? 1.0)),
    source: "est",
  };
}

/** Load to display: the value stored at write time, else computed on the fly. */
export function displayLoad(session, athlete) {
  if (session?.load != null && Number(session.load) > 0)
    return { value: Math.round(Number(session.load)), source: session.loadSource || "est" };
  return computeLoad(session || {}, athlete);
}

/* ---------------- standard test sets ---------------- */

/**
 * Standard tests, one per sport. Test sessions are normal sessions with a
 * testType and a structured `test` result object:
 *  - run5k:     test = { timeSec }
 *  - swimCss:   test = { t400Sec, t200Sec }       (CSS pace derived)
 *  - bikeFtp:   test = { avgPowerW, ftpEstimateW }
 *  - ski10k:    test = { timeSec, conditions }
 *  - strength5rm: test = { lifts: { squat|bench|deadlift: {weightKg, reps} },
 *                          oneRm: { squat, bench, deadlift, totalKg } }
 */
export const TEST_TYPES = {
  run5k: { sport: "running", label: "5 km time trial", short: "5K TT" },
  swimCss: { sport: "swimming", label: "CSS test — 400 m + 200 m", short: "CSS test" },
  bikeFtp: { sport: "cycling", label: "20-min FTP test", short: "20-min FTP" },
  ski10k: { sport: "skiing", label: "10 km time trial", short: "10K TT" },
  strength5rm: { sport: "strength", label: "5RM test day", short: "5RM day" },
};

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
  switch (session?.testType) {
    case "run5k":
      return t.timeSec ? `5K TT — ${formatDuration(t.timeSec)}` : "5K TT";
    case "ski10k":
      return t.timeSec ? `10K TT — ${formatDuration(t.timeSec)}` : "10K TT";
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
    default:
      return TEST_TYPES[session?.testType]?.label || "Test";
  }
}

/** Detail lines for a test result (used under the headline). */
export function testDetailLines(session) {
  const t = session?.test || {};
  const lines = [];
  if (session?.testType === "ski10k" && t.conditions)
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
  switch (session?.testType) {
    case "run5k":
    case "ski10k":
      return t.timeSec ? { value: Number(t.timeSec), kind: "time" } : null;
    case "swimCss": {
      const pace = cssPacePer100(t);
      return pace != null ? { value: pace, kind: "time" } : null;
    }
    case "bikeFtp":
      return t.avgPowerW ? { value: Number(t.avgPowerW), kind: "power" } : null;
    case "strength5rm":
      return t.oneRm?.totalKg ? { value: Number(t.oneRm.totalKg), kind: "weight" } : null;
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
 * One PB per sport for an athlete, derived from their sessions:
 *  - Running: best 5 km time — from run5k tests; else estimated by scaling
 *    the fastest-pace run of ≥5 km (minutes × 60 × 5 / distanceKm).
 *  - Swimming: best 400 m time — from swimCss tests (t400Sec); else estimated
 *    from the fastest-pace swim of ≥0.4 km.
 *  - Cycling: best 20-min mean-max power — from bikeFtp tests (avgPowerW) or
 *    any session carrying maxPower20W / avgPowerW; W/kg when weightKg known.
 *  - Skiing: best 10 km time — from ski10k tests; else estimated like running.
 *  - Strength: best combined estimated 1RM total from strength5rm tests.
 * Each entry: { value..., date, estimated } or null.
 */
export function computePBs(sessions, athlete) {
  const mine = sessions.filter((s) => s.athleteId === athlete?.id);
  const out = { run5k: null, swim400: null, bike20min: null, ski10k: null, strengthTotal: null };

  // --- running 5K ---
  const runTestList = mine.filter((s) => s.testType === "run5k" && s.test?.timeSec);
  if (runTestList.length > 0) {
    const best = runTestList.reduce((a, b) => (a.test.timeSec <= b.test.timeSec ? a : b));
    out.run5k = { seconds: Number(best.test.timeSec), date: best.date, estimated: false };
  } else {
    let best = null;
    for (const s of mine) {
      if (s.sport !== "running" || !(Number(s.distanceKm) >= 5) || !(Number(s.minutes) > 0)) continue;
      const sec = (Number(s.minutes) * 60 * 5) / Number(s.distanceKm);
      if (!best || sec < best.seconds) best = { seconds: round1(sec), date: s.date, estimated: true };
    }
    out.run5k = best;
  }

  // --- swimming 400 m ---
  const cssTests = mine.filter((s) => s.testType === "swimCss" && s.test?.t400Sec);
  if (cssTests.length > 0) {
    const best = cssTests.reduce((a, b) => (a.test.t400Sec <= b.test.t400Sec ? a : b));
    out.swim400 = { seconds: Number(best.test.t400Sec), date: best.date, estimated: false };
  } else {
    let best = null;
    for (const s of mine) {
      if (s.sport !== "swimming" || !(Number(s.distanceKm) >= 0.4) || !(Number(s.minutes) > 0)) continue;
      const sec = (Number(s.minutes) * 60 * 0.4) / Number(s.distanceKm);
      if (!best || sec < best.seconds) best = { seconds: round1(sec), date: s.date, estimated: true };
    }
    out.swim400 = best;
  }

  // --- cycling 20-min power ---
  let bestPower = null;
  for (const s of mine) {
    if (s.sport !== "cycling") continue;
    const candidates = [];
    if (s.testType === "bikeFtp" && s.test?.avgPowerW) candidates.push(Number(s.test.avgPowerW));
    if (s.maxPower20W) candidates.push(Number(s.maxPower20W));
    // A ride of ≥20 min: average power is a floor for 20-min mean-max.
    if (Number(s.minutes) >= 20 && s.avgPowerW) candidates.push(Number(s.avgPowerW));
    for (const w of candidates) {
      if (w > 0 && (!bestPower || w > bestPower.watts))
        bestPower = { watts: Math.round(w), date: s.date, estimated: !(s.testType === "bikeFtp") };
    }
  }
  if (bestPower) {
    const weightKg = Number(athlete?.weightKg) || 0;
    out.bike20min = {
      ...bestPower,
      wPerKg: weightKg > 0 ? round2(bestPower.watts / weightKg) : null,
    };
  }

  // --- skiing 10K ---
  const skiTests = mine.filter((s) => s.testType === "ski10k" && s.test?.timeSec);
  if (skiTests.length > 0) {
    const best = skiTests.reduce((a, b) => (a.test.timeSec <= b.test.timeSec ? a : b));
    out.ski10k = {
      seconds: Number(best.test.timeSec),
      date: best.date,
      estimated: false,
      conditions: best.test.conditions || "",
    };
  } else {
    let best = null;
    for (const s of mine) {
      if (s.sport !== "skiing" || !(Number(s.distanceKm) >= 10) || !(Number(s.minutes) > 0)) continue;
      const sec = (Number(s.minutes) * 60 * 10) / Number(s.distanceKm);
      if (!best || sec < best.seconds) best = { seconds: round1(sec), date: s.date, estimated: true, conditions: "" };
    }
    out.ski10k = best;
  }

  // --- strength 1RM total ---
  const strengthTests = mine.filter(
    (s) => s.testType === "strength5rm" && s.test?.oneRm?.totalKg
  );
  if (strengthTests.length > 0) {
    const best = strengthTests.reduce((a, b) =>
      a.test.oneRm.totalKg >= b.test.oneRm.totalKg ? a : b
    );
    out.strengthTotal = {
      totalKg: round1(best.test.oneRm.totalKg),
      squat: best.test.oneRm.squat || 0,
      bench: best.test.oneRm.bench || 0,
      deadlift: best.test.oneRm.deadlift || 0,
      date: best.date,
      estimated: false,
    };
  }

  return out;
}

/* ---------------- AI coach block (paste-into-/log JSON) ---------------- */

const COACH_SCHEMA = {
  sport: "one of: skiing | running | strength | cycling | swimming",
  date: "YYYY-MM-DD",
  minutes: "number > 0",
  distanceKm: "number, optional — decimals welcome, e.g. 33.66",
  details: "string, optional — sets / weights / swim set times",
  difficulty: "number 0.5–2.0, REQUIRED — set by the AI coach",
  notes: "string, optional — how it felt, what the coach noticed",
  avgHr: "number, optional — average heart rate (feeds the Load metric)",
  avgPowerW: "number, optional — average power in watts (cycling)",
  npW: "number, optional — normalized power in watts (cycling)",
  relativeEffort: "number, optional — Strava Relative Effort / suffer score (used as Load)",
  maxPower20W: "number, optional — best 20-min mean-max power in watts (feeds the PB board)",
  testType:
    "optional — one of: run5k | swimCss | bikeFtp | ski10k | strength5rm (must match sport)",
  test: "object, optional — required when testType is set; shape depends on the test (see below)",
  "test shapes": {
    run5k: '{ timeSec: seconds, or time: "MM:SS" }',
    swimCss: '{ t400Sec, t200Sec } — the 400 m and 200 m times in seconds (or "M:SS")',
    bikeFtp: "{ avgPowerW } — average power for the 20-min test; FTP estimate = 0.95 × power",
    ski10k: '{ timeSec (or time: "MM:SS"), conditions: "snow conditions, free text" }',
    strength5rm:
      "{ lifts: { squat: {weightKg, reps}, bench: {weightKg, reps}, deadlift: {weightKg, reps} } } — any subset",
  },
};

/** Validate + normalize a test result object. Returns { test } or { problem }. */
export function cleanTestResult(testType, raw) {
  if (raw == null || typeof raw !== "object")
    return { problem: `testType "${testType}" needs a "test" object with the result` };
  switch (testType) {
    case "run5k": {
      const timeSec = parseClock(raw.timeSec ?? raw.time);
      if (!timeSec) return { problem: 'run5k test needs timeSec (seconds) or time ("MM:SS")' };
      return { test: { timeSec: Math.round(timeSec) } };
    }
    case "ski10k": {
      const timeSec = parseClock(raw.timeSec ?? raw.time);
      if (!timeSec) return { problem: 'ski10k test needs timeSec (seconds) or time ("MM:SS")' };
      return {
        test: { timeSec: Math.round(timeSec), conditions: String(raw.conditions || "") },
      };
    }
    case "swimCss": {
      const t400Sec = parseClock(raw.t400Sec ?? raw.t400);
      const t200Sec = parseClock(raw.t200Sec ?? raw.t200);
      if (!t400Sec || !t200Sec)
        return { problem: 'swimCss test needs t400Sec and t200Sec (seconds or "M:SS")' };
      if (!(t400Sec > t200Sec))
        return { problem: "swimCss: the 400 m time must be longer than the 200 m time" };
      return { test: { t400Sec: Math.round(t400Sec), t200Sec: Math.round(t200Sec) } };
    }
    case "bikeFtp": {
      const avgPowerW = Number(raw.avgPowerW);
      if (!(avgPowerW > 0)) return { problem: "bikeFtp test needs avgPowerW > 0" };
      return {
        test: { avgPowerW: Math.round(avgPowerW), ftpEstimateW: Math.round(avgPowerW * 0.95) },
      };
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

  // Optional performance data (Strava exports, power meters, HR straps).
  const perf = {};
  for (const key of ["avgHr", "avgPowerW", "npW", "relativeEffort", "maxPower20W", "ftpW"]) {
    if (obj[key] != null) {
      if (!(Number(obj[key]) > 0)) problems.push(`${key} must be a number > 0`);
      else perf[key] = Number(obj[key]);
    }
  }

  // Optional standard test result.
  let testType = null;
  let test = null;
  if (obj.testType != null && obj.testType !== "") {
    if (!TEST_TYPES[obj.testType]) {
      problems.push(`testType must be one of: ${Object.keys(TEST_TYPES).join(", ")}`);
    } else if (TEST_TYPES[obj.testType].sport !== obj.sport) {
      problems.push(
        `testType "${obj.testType}" is a ${TEST_TYPES[obj.testType].sport} test, not ${obj.sport}`
      );
    } else {
      const cleaned = cleanTestResult(obj.testType, obj.test);
      if (cleaned.problem) problems.push(cleaned.problem);
      else {
        testType = obj.testType;
        test = cleaned.test;
      }
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
    details: String(obj.details || ""),
    difficulty: clampDifficulty(diff),
    difficultyBy: "ai",
    notes: String(obj.notes || ""),
    ...perf,
    testType,
    test,
  };
}

export { COACH_SCHEMA };
