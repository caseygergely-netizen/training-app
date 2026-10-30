import { Link } from "react-router-dom";
import { useAthletes, useSessions } from "../lib/firestore.js";
import {
  SPORTS,
  SPORT_META,
  computePBs,
  testsOfType,
  testHeadline,
  testDelta,
  formatDuration,
  prettyDate,
  round1,
  round2,
} from "../lib/points.js";

/**
 * PB metrics per sport — aerobic + anaerobic. `get(pbs, athlete)` returns
 * { text, date, estimated?, note? } or null when the athlete has no mark.
 * Classic five come from computePBs (tests, with pace-scaled estimates where
 * a test hasn't been logged); the extended set is test-only.
 */
const METRICS = {
  running: [
    {
      key: "run5k", label: "Best 5 km", kind: "aerobic",
      get: (p) => p.run5k && { text: formatDuration(p.run5k.seconds), date: p.run5k.date, estimated: p.run5k.estimated },
    },
    {
      key: "run10k", label: "Best 10 km", kind: "aerobic",
      get: (p) => p.run10k && { text: formatDuration(p.run10k.value), date: p.run10k.date },
    },
    {
      key: "run1k", label: "Best 1 km", kind: "anaerobic",
      get: (p) => p.run1k && { text: formatDuration(p.run1k.value), date: p.run1k.date },
    },
    {
      key: "run400m", label: "Best 400 m", kind: "anaerobic",
      get: (p) => p.run400m && { text: formatDuration(p.run400m.value), date: p.run400m.date },
    },
  ],
  swimming: [
    {
      key: "swim400", label: "Best 400 m", kind: "aerobic",
      get: (p) => p.swim400 && { text: formatDuration(p.swim400.seconds), date: p.swim400.date, estimated: p.swim400.estimated },
    },
    {
      key: "swim1500", label: "Best 1500 m", kind: "aerobic",
      get: (p) => p.swim1500 && { text: formatDuration(p.swim1500.value), date: p.swim1500.date },
    },
    {
      key: "swimCssPace", label: "CSS pace (per 100 m)", kind: "aerobic",
      get: (p) => p.swimCssPace && { text: formatDuration(p.swimCssPace.value), date: p.swimCssPace.date },
    },
    {
      key: "swim100", label: "Best 100 m", kind: "anaerobic",
      get: (p) => p.swim100 && { text: formatDuration(p.swim100.value), date: p.swim100.date },
    },
    {
      key: "swim50", label: "Best 50 m", kind: "anaerobic",
      get: (p) => p.swim50 && { text: formatDuration(p.swim50.value), date: p.swim50.date },
    },
  ],
  cycling: [
    {
      key: "bike20min", label: "Best 20-min power", kind: "aerobic",
      get: (p) =>
        p.bike20min && {
          text: `${p.bike20min.watts} W${p.bike20min.wPerKg ? ` · ${p.bike20min.wPerKg} W/kg` : ""}`,
          date: p.bike20min.date,
          estimated: p.bike20min.estimated,
          note: !p.bike20min.wPerKg ? "no weight on file for W/kg" : "",
        },
    },
    {
      key: "bike60min", label: "Best 60-min power", kind: "aerobic",
      get: (p, a) => powerText(p.bike60min, a),
    },
    {
      key: "bike5min", label: "Best 5-min power", kind: "anaerobic",
      get: (p, a) => powerText(p.bike5min, a),
    },
    {
      key: "bike1min", label: "Best 1-min power", kind: "anaerobic",
      get: (p, a) => powerText(p.bike1min, a),
    },
    {
      key: "bike5s", label: "Best 5-s power", kind: "anaerobic",
      get: (p, a) => powerText(p.bike5s, a),
    },
  ],
  skiing: [
    {
      key: "ski10k", label: "Best 10 km", kind: "aerobic",
      get: (p) =>
        p.ski10k && {
          text: formatDuration(p.ski10k.seconds),
          date: p.ski10k.date,
          estimated: p.ski10k.estimated,
          note: "condition-dependent",
        },
    },
    {
      key: "ski1k", label: "Best 1 km", kind: "anaerobic",
      get: (p) => p.ski1k && { text: formatDuration(p.ski1k.value), date: p.ski1k.date, note: "condition-dependent" },
    },
  ],
  strength: [
    {
      key: "strengthTotal", label: "Est. 1RM total (S+B+D)", kind: "anaerobic",
      get: (p) =>
        p.strengthTotal && {
          text: `${Math.round(p.strengthTotal.totalKg)} kg`,
          date: p.strengthTotal.date,
          note: `S ${Math.round(p.strengthTotal.squat)} · B ${Math.round(p.strengthTotal.bench)} · D ${Math.round(p.strengthTotal.deadlift)} kg`,
        },
    },
    {
      key: "lift_squat", label: "Est. 1RM — squat", kind: "anaerobic",
      get: (p) => p.lift_squat && { text: `${round1(p.lift_squat.value)} kg`, date: p.lift_squat.date },
    },
    {
      key: "lift_bench", label: "Est. 1RM — bench", kind: "anaerobic",
      get: (p) => p.lift_bench && { text: `${round1(p.lift_bench.value)} kg`, date: p.lift_bench.date },
    },
    {
      key: "lift_deadlift", label: "Est. 1RM — deadlift", kind: "anaerobic",
      get: (p) => p.lift_deadlift && { text: `${round1(p.lift_deadlift.value)} kg`, date: p.lift_deadlift.date },
    },
    {
      key: "strengthBestSet", label: "Best single set (est. 1RM)", kind: "anaerobic",
      get: (p) =>
        p.strengthBestSet && {
          text: `${round1(p.strengthBestSet.value)} kg`,
          date: p.strengthBestSet.date,
          note: p.strengthBestSet.label || "",
        },
    },
  ],
};

function powerText(entry, athlete) {
  if (!entry) return null;
  const wkg = Number(athlete?.weightKg) > 0 ? round2(entry.value / Number(athlete.weightKg)) : null;
  return {
    text: `${Math.round(entry.value)} W${wkg ? ` · ${wkg} W/kg` : ""}`,
    date: entry.date,
    note: !wkg ? "no weight on file for W/kg" : "",
  };
}

function MetricBlock({ metric, athletes, pbsByAthlete }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
        {metric.label}{" "}
        <span
          className="small"
          style={{
            color: metric.kind === "aerobic" ? "#8ce99a" : "#ffb35c",
            fontWeight: 600,
          }}
        >
          {metric.kind === "aerobic" ? "· aerobic" : "· anaerobic"}
        </span>
      </div>
      {athletes.map((a) => {
        const v = metric.get(pbsByAthlete[a.id] || {}, a);
        return (
          <div className="hist-row" key={a.id}>
            <div>
              {a.name}
              <div className="small muted">
                {v
                  ? `${prettyDate(v.date)}${v.estimated ? " · estimated from training pace" : ""}${v.note ? ` · ${v.note}` : ""}`
                  : "Not set yet"}
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{v ? v.text : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Benchmarks() {
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const loading = aLoading || sLoading;

  if (loading) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 200, marginBottom: 12 }} />
        <div className="skel" style={{ height: 120 }} />
      </div>
    );
  }
  if (athletes.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <div className="big">🏁</div>
          <p>No athletes yet.</p>
        </div>
      </div>
    );
  }

  const pbsByAthlete = {};
  for (const a of athletes) pbsByAthlete[a.id] = computePBs(sessions, a);
  const athleteById = Object.fromEntries(athletes.map((a) => [a.id, a]));

  const recentTests = sessions
    .filter((s) => s.testType)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 10);

  return (
    <div className="page">
      <h1>🏁 Tests &amp; PBs</h1>
      <p className="sub">
        Personal bests by sport — every athlete side by side, aerobic and
        anaerobic. Log tests from the{" "}
        <Link to="/log" style={{ color: "var(--accent)" }}>Log page</Link>{" "}
        (pick a test type) or via a coach block with a testType.
      </p>

      {SPORTS.map((sport) => (
        <div className="card" key={sport}>
          <h3>
            {SPORT_META[sport].icon} {SPORT_META[sport].label}
          </h3>
          {METRICS[sport].map((m) => (
            <MetricBlock
              key={m.key}
              metric={m}
              athletes={athletes}
              pbsByAthlete={pbsByAthlete}
            />
          ))}
        </div>
      ))}

      {recentTests.length > 0 && (
        <div className="card">
          <h3>Recent tests</h3>
          {recentTests.map((s) => {
            const mine = testsOfType(sessions, s.athleteId, s.testType);
            const idx = mine.findIndex((t) => t.id === s.id);
            const previous = idx >= 0 ? mine[idx + 1] : null;
            const delta = previous ? testDelta(s, previous) : null;
            return (
              <div className="hist-row" key={s.id}>
                <div>
                  <strong>{athleteById[s.athleteId]?.name || "?"}</strong> — {testHeadline(s)}
                  <div className="small muted">
                    {prettyDate(s.date)}
                    {delta && (
                      <span style={{ color: delta.improved ? "var(--accent)" : "var(--danger)" }}>
                        {" "}· {delta.text}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="notice">
        Extended marks (10K / 1K / 400 m runs, 1500 / 100 / 50 m swims, 60-min /
        5-min / 1-min / 5-s power, 1K ski, best single set) come from standard
        tests only — log the test and the board fills in. The classic five
        (5K, 400 m swim, 20-min power, 10K ski, 1RM total) also show a
        pace-scaled estimate, labelled as such, until a real test replaces it.
      </div>
    </div>
  );
}
