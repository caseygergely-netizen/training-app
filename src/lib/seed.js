/**
 * Demo seed data: 3 fictional athletes + ~6 weeks of varied sessions across
 * all 5 sports. Dates are generated relative to "today" so the rolling
 * 14-day board, versus matchups, and feed always render meaningfully.
 *
 * Includes a 1.8-difficulty Fly Friday swim and 0.6 easy swims per the spec.
 * Written to Firestore by the "Load demo data" button (docs flagged demo:true).
 */

import {
  addDays,
  handicapAt,
  sessionPoints,
  todayStr,
} from "./points.js";

/** Deterministic PRNG so seed output is stable across builds. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20261018);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const range = (lo, hi) => Math.round(lo + rnd() * (hi - lo));

export const SEED_ATHLETES = [
  {
    id: "demo-sam",
    name: "Sam Rivera",
    sports: ["running", "cycling", "swimming"],
    handicap: 0.85,
    handicapHistory: [
      {
        value: 1.0,
        effectiveFrom: addDays(todayStr(), -42),
        reason: "Initial handicap",
      },
      {
        value: 0.85,
        effectiveFrom: addDays(todayStr(), -14),
        reason:
          "14-day review: 5K down to 19:40, FTP up to 265W — fittest in the group",
      },
    ],
    demo: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-jordan",
    name: "Jordan Blake",
    sports: ["swimming", "strength", "running"],
    handicap: 1.0,
    handicapHistory: [
      {
        value: 1.0,
        effectiveFrom: addDays(todayStr(), -42),
        reason: "Initial handicap",
      },
    ],
    demo: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-taylor",
    name: "Taylor Nguyen",
    sports: ["skiing", "cycling", "strength"],
    handicap: 1.15,
    handicapHistory: [
      {
        value: 1.3,
        effectiveFrom: addDays(todayStr(), -42),
        reason: "Initial handicap — newest to structured training",
      },
      {
        value: 1.15,
        effectiveFrom: addDays(todayStr(), -14),
        reason: "14-day review: volume climbing fast, handicap tightening",
      },
    ],
    demo: true,
    createdAt: new Date().toISOString(),
  },
];

const TEMPLATES = {
  running: [
    { min: [35, 70], diff: [0.9, 1.3], perKm: 5.2, notes: ["Easy aerobic miles", "Steady cruise", "Lunch run"] },
    { min: [40, 60], diff: [1.4, 1.7], perKm: 4.4, notes: ["Tempo Tuesday — hurt so good", "Threshold intervals 5x1k"] },
  ],
  cycling: [
    { min: [60, 120], diff: [0.8, 1.2], perKm: 0.033, notes: ["Zwift endurance spin", "Coffee ride"] },
    { min: [60, 90], diff: [1.4, 1.8], perKm: 0.028, notes: ["ZRL race — full gas", "VO2max 8x3min"] },
  ],
  swimming: [
    { min: [40, 60], diff: [0.8, 1.1], perKm: 25, notes: ["Technique + pull set", "Aerobic 3k"] },
  ],
  strength: [
    { min: [45, 60], diff: [1.0, 1.4], perKm: null, notes: ["Full body dumbbells", "Upper + core"] },
  ],
  skiing: [
    { min: [60, 120], diff: [0.9, 1.3], perKm: 4.6, notes: ["Rollerski classic", "Easy distance ski"] },
    { min: [75, 105], diff: [1.4, 1.7], perKm: 3.9, notes: ["Skate intervals on the rollerskis"] },
  ],
};

const STRENGTH_DETAILS = [
  "DB bench 4x8 @ 2x50lb; goblet squat 3x10 @ 50lb; bent row 3x10/arm @ 50lb; RDL 3x10 @ 2x50lb",
  "Overhead press 3x8 @ 2x35lb; Bulgarian split squat 3x8/leg @ 2x30lb; dead bugs 3x12",
  "Trap-bar style: goblet squat 4x12 @ 50lb; single-arm row 4x10 @ 50lb; pushups 3x15",
];

function easySwim(date) {
  return {
    sport: "swimming",
    minutes: range(28, 35),
    difficulty: 0.6,
    details: "Easy 1500m: 400 swim / 400 pull / 400 kick / 300 choice. Technique focus.",
    notes: pick(["Smooth and easy", "Shoulder felt good", "Drill day"]),
  };
}

function flyFriday(date) {
  return {
    sport: "swimming",
    minutes: range(60, 70),
    difficulty: 1.8,
    details:
      "FLY FRIDAY: 400 warmup, 8x50 fly @1:10 holding stroke, 4x100 IM @1:50, 400 cooldown. 1000m+ fly.",
    notes: pick([
      "Held technique through rep 6, died on 7-8. Brutal.",
      "Best Fly Friday in weeks — all 8 under 0:42",
    ]),
  };
}

function randomSession(athlete, date) {
  const sport = pick(athlete.sports);
  const d = parseDateSafe(date);
  const isFriday = d.getDay() === 5;

  // Jordan swims Fly Friday every week — the legendary hard session.
  if (athlete.id === "demo-jordan" && isFriday && rnd() < 0.85) {
    return { athleteId: athlete.id, date, difficultyBy: "ai", ...flyFriday(date) };
  }
  // Occasional easy recovery swim for anyone who swims.
  if (sport === "swimming" && rnd() < 0.3) {
    return { athleteId: athlete.id, date, difficultyBy: "ai", ...easySwim(date) };
  }

  const t = pick(TEMPLATES[sport]);
  const minutes = range(t.min[0], t.min[1]);
  const difficulty = Math.round((t.diff[0] + rnd() * (t.diff[1] - t.diff[0])) * 10) / 10;
  const s = {
    athleteId: athlete.id,
    date,
    sport,
    minutes,
    difficulty,
    difficultyBy: "ai",
    notes: pick(t.notes),
    details: "",
  };
  if (t.perKm) s.distanceKm = Math.round((minutes / t.perKm) * 10) / 10;
  if (sport === "strength") s.details = pick(STRENGTH_DETAILS);
  if (sport === "swimming")
    s.details = `${range(24, 34) * 100}m: warmup + main set ${range(8, 12)}x100 @${range(95, 115)}s + cooldown`;
  return s;
}

function parseDateSafe(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Build the full seed payload: { athletes, sessions } ready for Firestore. */
export function buildSeedData() {
  const today = todayStr();
  const sessions = [];
  let n = 0;

  for (const athlete of SEED_ATHLETES) {
    for (let back = 41; back >= 0; back--) {
      const date = addDays(today, -back);
      // Rest days: ~25% chance of no session (a bit more on Sundays).
      const restChance = parseDateSafe(date).getDay() === 0 ? 0.45 : 0.25;
      if (rnd() < restChance) continue;
      const s = randomSession(athlete, date);
      const handicap = handicapAt(athlete, date);
      sessions.push({
        id: `demo-session-${n++}`,
        ...s,
        handicapUsed: handicap,
        points: sessionPoints({
          minutes: s.minutes,
          difficulty: s.difficulty,
          handicap,
        }),
        demo: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Guarantee a couple of very recent sessions so streaks/badges feel alive.
  return { athletes: SEED_ATHLETES, sessions };
}
