import { useParams, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  useAthletes,
  useSessions,
  updateHandicap,
  updateAthleteSettings,
} from "../lib/firestore.js";
import { useAuth } from "../App.jsx";
import {
  dailyPoints,
  addDays,
  todayStr,
  SPORT_META,
  round1,
} from "../lib/points.js";
import { useEffect, useState } from "react";

const PIE_COLORS = ["#7cc4ff", "#8ce99a", "#b197fc", "#ffb35c", "#66d9e8"];

export default function AthleteProfile() {
  const { id } = useParams();
  const { athletes, loading: aLoading } = useAthletes();
  const { sessions, loading: sLoading } = useSessions();
  const { athlete: me } = useAuth();
  const [hcpValue, setHcpValue] = useState("");
  const [hcpReason, setHcpReason] = useState("");
  const [hcpMsg, setHcpMsg] = useState("");
  const [hcpSaving, setHcpSaving] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [thresholdHr, setThresholdHr] = useState("");
  const [ftpW, setFtpW] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loading = aLoading || sLoading;
  const athlete = athletes.find((a) => a.id === id);

  // Populate the settings form once this athlete's doc is loaded.
  useEffect(() => {
    if (!athlete) return;
    setWeightKg(athlete.weightKg != null ? String(athlete.weightKg) : "");
    setThresholdHr(athlete.thresholdHr != null ? String(athlete.thresholdHr) : "");
    setFtpW(athlete.ftpW != null ? String(athlete.ftpW) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id]);
  const asOf = todayStr();
  const start = addDays(asOf, -13);

  if (loading) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 180, marginBottom: 12 }} />
        <div className="skel" style={{ height: 180 }} />
      </div>
    );
  }
  if (!athlete) {
    return (
      <div className="page">
        <div className="empty">
          <div className="big">🤷</div>
          <p>Athlete not found.</p>
          <Link to="/">Back to the board</Link>
        </div>
      </div>
    );
  }

  const mine = sessions.filter((s) => s.athleteId === id);
  const last14 = mine.filter((s) => s.date >= start && s.date <= asOf);
  const chartData = dailyPoints(sessions, id, start, asOf);
  const totalPoints = round1(last14.reduce((t, s) => t + Number(s.points || 0), 0));
  const totalMinutes = last14.reduce((t, s) => t + Number(s.minutes || 0), 0);

  const bySport = {};
  for (const s of last14) {
    bySport[s.sport] = (bySport[s.sport] || 0) + Number(s.points || 0);
  }
  const pieData = Object.entries(bySport)
    .map(([sport, points]) => ({
      name: SPORT_META[sport]?.label || sport,
      value: round1(points),
    }))
    .sort((a, b) => b.value - a.value);

  const history = [...(athlete.handicapHistory || [])].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? 1 : -1
  );

  const isMe = me && me.id === id;

  async function handleSettingsSave(e) {
    e.preventDefault();
    setSettingsMsg("");
    const check = (v, label, lo, hi) => {
      if (v === "") return null;
      const n = Number(v);
      if (!(n >= lo && n <= hi)) return `${label} looks off — check the number.`;
      return null;
    };
    const problem =
      check(weightKg, "Weight", 30, 250) ||
      check(thresholdHr, "Threshold HR", 100, 220) ||
      check(ftpW, "FTP", 50, 600);
    if (problem) {
      setSettingsMsg(problem);
      return;
    }
    setSettingsSaving(true);
    try {
      await updateAthleteSettings(id, { weightKg, thresholdHr, ftpW });
      setSettingsMsg("✅ Saved — Load and W/kg use these from now on.");
    } catch (err) {
      setSettingsMsg(err.message || "Couldn't save settings.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleHandicapUpdate(e) {
    e.preventDefault();
    setHcpMsg("");
    const v = Number(hcpValue);
    if (!(v >= 0.5 && v <= 2.0)) {
      setHcpMsg("Handicap must be between 0.5 and 2.0 (usual range 0.7–1.5).");
      return;
    }
    if (!hcpReason.trim()) {
      setHcpMsg("Give a reason — benchmarks, training load, head-to-head.");
      return;
    }
    setHcpSaving(true);
    try {
      await updateHandicap(id, v, hcpReason.trim());
      setHcpMsg("✅ Handicap updated — applies to new sessions from today.");
      setHcpValue("");
      setHcpReason("");
    } catch (err) {
      setHcpMsg(err.message || "Couldn't update the handicap.");
    } finally {
      setHcpSaving(false);
    }
  }

  return (
    <div className="page">
      <h1>👤 {athlete.name}</h1>
      <p className="sub">
        {(athlete.sports || []).map((s) => SPORT_META[s]?.icon).join(" ")} · handicap ×
        {Number(athlete.handicap ?? 1).toFixed(2)}
      </p>

      <div className="badges" style={{ marginBottom: 12 }}>
        <div className="badge">
          <div className="t">Points · 14d</div>
          <div className="v" style={{ fontSize: 18 }}>{totalPoints}</div>
        </div>
        <div className="badge">
          <div className="t">Sessions · 14d</div>
          <div className="v" style={{ fontSize: 18 }}>{last14.length}</div>
        </div>
        <div className="badge">
          <div className="t">Minutes · 14d</div>
          <div className="v" style={{ fontSize: 18 }}>{totalMinutes}</div>
        </div>
      </div>

      {isMe && (
        <div className="card">
          <h3>My numbers (for Load &amp; W/kg)</h3>
          <p className="small muted">
            Optional — they power the training-load metric and the cycling
            PB in W/kg. Weight feeds W/kg, threshold HR feeds hrTSS, FTP
            feeds cycling TSS.
          </p>
          {settingsMsg && (
            <div className={settingsMsg.startsWith("✅") ? "notice" : "error"}>
              {settingsMsg}
            </div>
          )}
          <form onSubmit={handleSettingsSave}>
            <div className="row">
              <div className="field grow">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="78.5"
                />
              </div>
              <div className="field grow">
                <label>Threshold HR (bpm)</label>
                <input
                  type="number"
                  min="0"
                  value={thresholdHr}
                  onChange={(e) => setThresholdHr(e.target.value)}
                  placeholder="172"
                />
              </div>
              <div className="field grow">
                <label>FTP (W)</label>
                <input
                  type="number"
                  min="0"
                  value={ftpW}
                  onChange={(e) => setFtpW(e.target.value)}
                  placeholder="255"
                />
              </div>
            </div>
            <button className="btn ghost" type="submit" disabled={settingsSaving}>
              {settingsSaving ? "Saving…" : "Save my numbers"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Daily points — last 14 days</h3>
        {chartData.every((d) => d.points === 0) ? (
          <p className="muted small">No sessions in the last 14 days.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#8b94a7", fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: "#8b94a7", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#161c28", border: "1px solid #232c3f", borderRadius: 10 }}
                labelStyle={{ color: "#eef2f7" }}
              />
              <Bar dataKey="points" fill="#c6ff4a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3>Points by sport — last 14 days</h3>
        {pieData.length === 0 ? (
          <p className="muted small">No sessions in the last 14 days.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#161c28", border: "1px solid #232c3f", borderRadius: 10 }}
                  labelStyle={{ color: "#eef2f7" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div>
              {pieData.map((d, i) => (
                <div className="kv" key={d.name}>
                  <span className="k">
                    <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>●</span> {d.name}
                  </span>
                  <span className="v">{d.value} pts</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>Handicap history</h3>
        <p className="small muted">
          Re-evaluated by the AI coach every 14 days. Applies to new sessions
          from the effective date — past points don't change.
        </p>
        {history.length === 0 ? (
          <p className="muted small">No handicap history recorded.</p>
        ) : (
          history.map((h, i) => (
            <div className="hist-row" key={i}>
              <div>
                <strong>×{Number(h.value).toFixed(2)}</strong>
                <div className="small muted">{h.reason}</div>
              </div>
              <div className="small muted">{h.effectiveFrom}</div>
            </div>
          ))
        )}

        {isMe && (
          <>
            <hr className="divider" />
            <h3>Update my handicap</h3>
            <p className="small muted">
              Normally your AI coach does this every 14 days. Manual override
              for when you know better.
            </p>
            {hcpMsg && (
              <div className={hcpMsg.startsWith("✅") ? "notice" : "error"}>{hcpMsg}</div>
            )}
            <form onSubmit={handleHandicapUpdate}>
              <div className="row">
                <div className="field grow">
                  <label>New handicap</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="2.0"
                    value={hcpValue}
                    onChange={(e) => setHcpValue(e.target.value)}
                    placeholder="1.00"
                  />
                </div>
              </div>
              <div className="field">
                <label>Reason</label>
                <input
                  value={hcpReason}
                  onChange={(e) => setHcpReason(e.target.value)}
                  placeholder="5K down to 19:40, FTP up — fitter than the field"
                />
              </div>
              <button className="btn ghost" type="submit" disabled={hcpSaving}>
                {hcpSaving ? "Saving…" : "Update handicap"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
