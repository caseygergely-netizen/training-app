import { useState } from "react";
import { Link } from "react-router-dom";
import { useAthletes, useSessions } from "../lib/firestore.js";
import { useAuth } from "../App.jsx";
import {
  TEST_TYPES,
  computePBs,
  testsOfType,
  testHeadline,
  testDetailLines,
  testDelta,
  formatDuration,
  prettyDate,
} from "../lib/points.js";

function PbRow({ icon, label, value, date, estimated, note }) {
  return (
    <div className="hist-row">
      <div>
        <strong>
          {icon} {label}
        </strong>
        <div className="small muted">
          {value ? (
            <>
              {prettyDate(date)}
              {estimated ? " · estimated from training pace" : ""}
              {note ? ` · ${note}` : ""}
            </>
          ) : (
            "Not set yet — log a test or a session in this sport."
          )}
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{value || "—"}</div>
    </div>
  );
}

export default function Benchmarks() {
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const { athlete: me } = useAuth();
  const [pickedId, setPickedId] = useState(null);

  const loading = aLoading || sLoading;
  const athlete =
    athletes.find((a) => a.id === pickedId) ||
    athletes.find((a) => a.id === me?.id) ||
    athletes[0];

  if (loading) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 200, marginBottom: 12 }} />
        <div className="skel" style={{ height: 120 }} />
      </div>
    );
  }
  if (!athlete) {
    return (
      <div className="page">
        <div className="empty">
          <div className="big">🏁</div>
          <p>No athletes yet.</p>
        </div>
      </div>
    );
  }

  const pbs = computePBs(sessions, athlete);
  const isMe = me && me.id === athlete.id;

  return (
    <div className="page">
      <h1>🏁 Tests &amp; PBs</h1>
      <p className="sub">
        Standard test sets and the personal-best board they feed. Log tests
        from the <Link to="/log" style={{ color: "var(--accent)" }}>Log page</Link>{" "}
        (pick a test type) or via a coach block with a testType.
      </p>

      {athletes.length > 1 && (
        <div className="sport-pick" style={{ marginBottom: 14 }}>
          {athletes.map((a) => (
            <button
              key={a.id}
              type="button"
              className={a.id === athlete.id ? "on" : ""}
              onClick={() => setPickedId(a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <h3>🏆 Personal bests — {athlete.name}</h3>
        <PbRow
          icon="🏃"
          label="Running — best 5 km"
          value={pbs.run5k ? formatDuration(pbs.run5k.seconds) : null}
          date={pbs.run5k?.date}
          estimated={pbs.run5k?.estimated}
        />
        <PbRow
          icon="🏊"
          label="Swimming — best 400 m"
          value={pbs.swim400 ? formatDuration(pbs.swim400.seconds) : null}
          date={pbs.swim400?.date}
          estimated={pbs.swim400?.estimated}
        />
        <PbRow
          icon="🚴"
          label="Cycling — best 20-min power"
          value={
            pbs.bike20min
              ? `${pbs.bike20min.watts} W${pbs.bike20min.wPerKg ? ` · ${pbs.bike20min.wPerKg} W/kg` : ""}`
              : null
          }
          date={pbs.bike20min?.date}
          estimated={pbs.bike20min?.estimated}
          note={
            pbs.bike20min && !pbs.bike20min.wPerKg
              ? isMe
                ? "add your weight on your profile for W/kg"
                : "no weight on file"
              : ""
          }
        />
        <PbRow
          icon="⛷️"
          label="Skiing — best 10 km"
          value={pbs.ski10k ? formatDuration(pbs.ski10k.seconds) : null}
          date={pbs.ski10k?.date}
          estimated={pbs.ski10k?.estimated}
          note={pbs.ski10k ? "condition-dependent" : ""}
        />
        <PbRow
          icon="🏋️"
          label="Strength — est. 1RM total (squat + bench + deadlift)"
          value={pbs.strengthTotal ? `${Math.round(pbs.strengthTotal.totalKg)} kg` : null}
          date={pbs.strengthTotal?.date}
          estimated={false}
          note={
            pbs.strengthTotal
              ? `S ${Math.round(pbs.strengthTotal.squat)} · B ${Math.round(pbs.strengthTotal.bench)} · D ${Math.round(pbs.strengthTotal.deadlift)} kg`
              : ""
          }
        />
      </div>

      {Object.keys(TEST_TYPES).map((testType) => {
        const meta = TEST_TYPES[testType];
        const tests = testsOfType(sessions, athlete.id, testType);
        if (tests.length === 0) return null;
        const [latest, previous] = tests;
        const delta = previous ? testDelta(latest, previous) : null;
        return (
          <div className="card" key={testType}>
            <h3>
              {meta.label} — {athlete.name}
            </h3>
            <div className="kv">
              <span className="k">Latest</span>
              <span className="v">{testHeadline(latest)}</span>
            </div>
            <div className="kv">
              <span className="k">Date</span>
              <span className="v">{prettyDate(latest.date)}</span>
            </div>
            {delta && (
              <div className="kv">
                <span className="k">Change</span>
                <span
                  className="v"
                  style={{ color: delta.improved ? "var(--accent)" : "var(--danger)" }}
                >
                  {delta.text}
                </span>
              </div>
            )}
            {testDetailLines(latest).map((line, i) => (
              <p className="small muted" key={i} style={{ margin: "4px 0 0" }}>
                {line}
              </p>
            ))}

            {tests.length > 1 && (
              <>
                <hr className="divider" />
                {tests.slice(1).map((t) => (
                  <div className="hist-row" key={t.id}>
                    <div>{testHeadline(t)}</div>
                    <div className="small muted">{prettyDate(t.date)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}

      {Object.keys(TEST_TYPES).every(
        (tt) => testsOfType(sessions, athlete.id, tt).length === 0
      ) && (
        <div className="notice">
          No tests logged for {athlete.name} yet. Run a 5K TT, a CSS test, a
          20-min FTP test, a 10K ski TT or a 5RM day and log it with its test
          type — it lands here and updates the PB board.
        </div>
      )}
    </div>
  );
}
