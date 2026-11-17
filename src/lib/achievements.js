/**
 * Secret achievements (Casey, Nov 16, 2026 — a video-game motivator:
 * "surprises built in code"). A hidden set of badges derived on read
 * from existing session / standings / flag data. Nobody can see the
 * triggers in advance — not in the UI, not in the Corner, not in the
 * coach contract. An athlete discovers one only by earning it; the
 * unlock is celebrated in the Monday recap and lands on their profile
 * trophy shelf (locked badges show there only as "???" tiles).
 *
 * THIS FILE IS THE ONLY PLACE THE TRIGGERS LIVE. Do not document them
 * in the AICoach contract, the Corner, the backlog or anywhere else.
 *
 * Voice: the System AI from Dungeon Crawler Carl — every unlock is
 * announced like a deranged game show: a backhanded title, a mocking
 * description, and a joke "Reward:" line (the reward is always just
 * the badge; the AI pretends it's treasure). No points, ever.
 */
import {
  addDays,
  mondayOf,
  todayStr,
  throneHistory,
  spoonHistory,
} from "./points.js";

const CORE_SPORTS = ["skiing", "running", "strength", "cycling", "swimming"];

/** Millis for a createdAt that may be a Timestamp, an ISO string, or absent. */
function createdMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Local hour (league home: Alberta) a session was logged at, from its
 * createdAt. Sessions carry a calendar date but no time of day — the
 * write timestamp is the only clock the data has. Null when unknown.
 */
function sessionLocalHour(session) {
  const ms = createdMillis(session?.createdAt);
  if (!ms) return null;
  try {
    const s = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Edmonton",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(ms));
    const h = parseInt(s, 10);
    return Number.isNaN(h) ? null : h % 24;
  } catch {
    return null;
  }
}

/** One athlete's sessions grouped into Mon–Sun weeks, chronological. */
function weeksOf(mine) {
  const map = new Map();
  for (const s of mine) {
    const wk = mondayOf(s.date);
    if (!map.has(wk))
      map.set(wk, {
        weekStart: wk,
        weekEnd: addDays(wk, 6),
        sessions: [],
        sports: new Set(),
        days: new Set(),
        points: 0,
        minutes: 0,
      });
    const w = map.get(wk);
    w.sessions.push(s);
    w.sports.add(s.sport);
    w.days.add(s.date);
    w.points += Number(s.points) || 0;
    w.minutes += Number(s.minutes) || 0;
  }
  return [...map.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

function buildCtx(sessions, athletes, athleteId, flags, asOf) {
  const mine = (sessions || [])
    .filter((s) => s.athleteId === athleteId)
    .slice()
    .sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : createdMillis(a.createdAt) - createdMillis(b.createdAt)
    );
  const throne = throneHistory(sessions, athletes, asOf, flags)
    .slice()
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)); // chronological
  const spoon = spoonHistory(sessions, athletes, asOf)
    .slice()
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)); // chronological
  const sessionById = new Map((sessions || []).map((s) => [s.id, s]));
  return { athleteId, mine, weeks: weeksOf(mine), throne, spoon, flags: flags || [], sessionById };
}

const firstWeekWhere = (ctx, pred) => {
  const w = ctx.weeks.find(pred);
  return w ? { date: w.weekEnd, weekStart: w.weekStart } : null;
};
const firstSessionWhere = (ctx, pred) => {
  const s = ctx.mine.find(pred);
  return s ? { date: s.date, weekStart: mondayOf(s.date) } : null;
};

/**
 * The hidden set. Each `find(ctx)` returns { date, weekStart } for the
 * FIRST time the athlete satisfied the trigger, or null. Order here is
 * display order on the trophy shelf.
 */
const ACHIEVEMENTS = [
  {
    id: "night-owl",
    icon: "🦉",
    title: "Night Owl",
    desc: "You trained after 10 PM, you absolute gremlin. Your sleep schedule is now legally a cry for help.",
    reward: "A badge. It's worthless. Frame it.",
    find: (ctx) =>
      firstSessionWhere(ctx, (s) => {
        const h = sessionLocalHour(s);
        return h != null && (h >= 22 || h < 5);
      }),
  },
  {
    id: "full-house",
    icon: "🃏",
    title: "Full House",
    desc: "Swim, bike, run, ski, lift — every sport in a single week. Pick a personality, you degenerate.",
    reward: "One (1) badge, redeemable nowhere.",
    find: (ctx) => firstWeekWhere(ctx, (w) => CORE_SPORTS.every((sp) => w.sports.has(sp))),
  },
  {
    id: "comeback",
    icon: "👑",
    title: "The Comeback",
    desc: "Dead last one week, king the next. The spoon has been notified of its loss and is inconsolable.",
    reward: "Bragging rights, weaponised.",
    find: (ctx) => {
      const lastByWeek = new Map(
        ctx.spoon.map((w) => [w.weekStart, new Set(w.holders.map((h) => h.athlete.id))])
      );
      for (let i = 1; i < ctx.throne.length; i++) {
        const prev = ctx.throne[i - 1];
        const cur = ctx.throne[i];
        const won = cur.winners.some((a) => a.id === ctx.athleteId);
        const wasLast = lastByWeek.get(prev.weekStart)?.has(ctx.athleteId);
        if (won && wasLast) return { date: cur.weekEnd, weekStart: cur.weekStart };
      }
      return null;
    },
  },
  {
    id: "century",
    icon: "💯",
    title: "Century Club, Show-Off",
    desc: "A hundred points in a single session. Somewhere, a couch just filed a restraining order.",
    reward: "A shiny badge and the group's suspicion.",
    find: (ctx) => firstSessionWhere(ctx, (s) => (Number(s.points) || 0) >= 100),
  },
  {
    id: "iron-week",
    icon: "🔩",
    title: "Iron Week",
    desc: "Seven sessions in seven days. Rest is a rumour started by your enemies.",
    reward: "A badge. Ice baths are your own problem.",
    find: (ctx) => firstWeekWhere(ctx, (w) => w.sessions.length >= 7),
  },
  {
    id: "every-damn-day",
    icon: "📅",
    title: "Every Damn Day",
    desc: "You trained all seven days this week. Your couch has filed a missing persons report.",
    reward: "A badge and one (1) concerned glance.",
    find: (ctx) => firstWeekWhere(ctx, (w) => w.days.size >= 7),
  },
  {
    id: "double-day",
    icon: "✌️",
    title: "Double Trouble",
    desc: "Two sessions in one day. The first one didn't hurt enough, apparently.",
    reward: "A badge. Hydrate, dumbass.",
    find: (ctx) => {
      const counts = {};
      for (const s of ctx.mine) {
        counts[s.date] = (counts[s.date] || 0) + 1;
        if (counts[s.date] >= 2) return { date: s.date, weekStart: mondayOf(s.date) };
      }
      return null;
    },
  },
  {
    id: "marathon",
    icon: "🐌",
    title: "Oops, All Endurance",
    desc: "Three hours in a single session. That wasn't training, that was a cry for help with snacks.",
    reward: "A badge and permission to sit down.",
    find: (ctx) => firstSessionWhere(ctx, (s) => (Number(s.minutes) || 0) >= 180),
  },
  {
    id: "part-time-job",
    icon: "🕐",
    title: "The Part-Time Job",
    desc: "Ten hours of training in one week. HR has been notified. There is no overtime pay.",
    reward: "A badge. Benefits not included.",
    find: (ctx) => firstWeekWhere(ctx, (w) => w.minutes >= 600),
  },
  {
    id: "kingslayer",
    icon: "🗡️",
    title: "Regicide, Baby",
    desc: "You ended a reign of two-plus weeks. The crown was pried off and the king escorted from the building.",
    reward: "A badge, and a target on your back.",
    find: (ctx) => {
      for (let i = 1; i < ctx.throne.length; i++) {
        const prev = ctx.throne[i - 1];
        const cur = ctx.throne[i];
        if (!cur.winners.some((a) => a.id === ctx.athleteId)) continue;
        const endedReign = prev.winners.some(
          (a) => a.id !== ctx.athleteId && (prev.reignByWinner[a.id] || 0) >= 2
        );
        if (endedReign) return { date: cur.weekEnd, weekStart: cur.weekStart };
      }
      return null;
    },
  },
  {
    id: "audited",
    icon: "🚩",
    title: "The Audited",
    desc: "A rival flagged your session and dragged it into the Corner. Bold of them to assume shame works on you.",
    reward: "A badge. Wear it to the hearing.",
    find: (ctx) => {
      const hits = ctx.flags
        .filter((f) => f.sessionAthleteId === ctx.athleteId && f.flaggedByUid !== ctx.athleteId)
        .map((f) => f.date || ctx.sessionById.get(f.sessionId)?.date)
        .filter(Boolean)
        .sort();
      return hits.length ? { date: hits[0], weekStart: mondayOf(hits[0]) } : null;
    },
  },
  {
    id: "snitch",
    icon: "👀",
    title: "The Snitch",
    desc: "You saw something and you said something. The Corner thanks you for your service, narc.",
    reward: "A badge and a reputation.",
    find: (ctx) => {
      const hits = ctx.flags
        .filter((f) => f.flaggedByUid === ctx.athleteId && f.sessionAthleteId !== ctx.athleteId)
        .map((f) => f.date)
        .filter(Boolean)
        .sort();
      return hits.length ? { date: hits[0], weekStart: mondayOf(hits[0]) } : null;
    },
  },
  {
    id: "golden-spoon",
    icon: "🥄",
    title: "The Golden Spoon",
    desc: "Four straight weeks in the basement. This isn't a slump any more, it's a lifestyle brand.",
    reward: "A golden spoon. It's plastic. Obviously.",
    find: (ctx) => {
      const hit = ctx.spoon.find((w) =>
        w.holders.some((h) => h.athlete.id === ctx.athleteId && h.streak >= 4)
      );
      return hit ? { date: hit.weekEnd, weekStart: hit.weekStart } : null;
    },
  },
  {
    id: "pb-hunter",
    icon: "⚡",
    title: "PB Hunter",
    desc: "Five workouts with best efforts harvested. Your coach is just showing off through you at this point.",
    reward: "A badge. The PB board sends its regards.",
    find: (ctx) => {
      const withBests = ctx.mine.filter(
        (s) => s.bests && typeof s.bests === "object" && Object.keys(s.bests).length > 0
      );
      const fifth = withBests[4];
      return fifth ? { date: fifth.date, weekStart: mondayOf(fifth.date) } : null;
    },
  },
];

export const ACHIEVEMENT_TOTAL = ACHIEVEMENTS.length;

/**
 * One athlete's trophy shelf: the badges they've unlocked (with the
 * date each first fired) and how many remain hidden. Locked badges
 * expose NOTHING but the count — their names and triggers stay in
 * this file.
 * { unlocked: [{ id, icon, title, desc, reward, date, weekStart }],
 *   lockedCount, total }
 */
export function achievementsForAthlete(sessions, athletes, athleteId, flags = [], asOf = todayStr()) {
  const ctx = buildCtx(sessions, athletes, athleteId, flags, asOf);
  const unlocked = [];
  for (const def of ACHIEVEMENTS) {
    const hit = def.find(ctx);
    if (hit)
      unlocked.push({
        id: def.id,
        icon: def.icon,
        title: def.title,
        desc: def.desc,
        reward: def.reward,
        date: hit.date,
        weekStart: hit.weekStart,
      });
  }
  return {
    unlocked,
    lockedCount: ACHIEVEMENTS.length - unlocked.length,
    total: ACHIEVEMENTS.length,
  };
}

/**
 * Every achievement unlocked BY ANYONE whose unlock week is the given
 * weekStart — the Monday recap's surprise segment.
 * [{ athlete, unlock: { id, icon, title, desc, reward, date, weekStart } }]
 */
export function achievementUnlocksInWeek(sessions, athletes, flags, weekStart, asOf = todayStr()) {
  const out = [];
  for (const a of athletes || []) {
    const { unlocked } = achievementsForAthlete(sessions, athletes, a.id, flags, asOf);
    for (const u of unlocked)
      if (u.weekStart === weekStart) out.push({ athlete: a, unlock: u });
  }
  return out;
}
