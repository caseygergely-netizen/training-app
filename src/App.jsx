import React, { createContext, useContext, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Versus from "./pages/Versus.jsx";
import Feed from "./pages/Feed.jsx";
import LogSession from "./pages/LogSession.jsx";
import AthleteProfile from "./pages/AthleteProfile.jsx";
import AICoach from "./pages/AICoach.jsx";
import Invite from "./pages/Invite.jsx";
import Login from "./pages/Login.jsx";
import FinishSetup from "./pages/FinishSetup.jsx";
import { isConfigured } from "./firebase.js";
import {
  useAuthUser,
  useMyAthlete,
  signOutAthlete,
} from "./lib/firestore.js";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function Header() {
  const { user, athlete } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        COMPETITION<span>OF MEN</span>
      </Link>
      <div className="topbar-actions">
        <Link className="chip" to="/invite">
          ✉️ Invite
        </Link>
        <button
          className="chip"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Account menu"
        >
          {athlete ? athlete.name.split(" ")[0] : "…"} ▾
        </button>
      </div>
      {menuOpen && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: 52,
            right: 12,
            zIndex: 30,
            minWidth: 190,
            margin: 0,
          }}
        >
          {athlete && (
            <div style={{ marginBottom: 8 }}>
              <Link to={`/athletes/${athlete.id}`} onClick={() => setMenuOpen(false)}>
                👤 My profile
              </Link>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <Link to="/ai-coach" onClick={() => setMenuOpen(false)}>
              🤖 AI coach contract
            </Link>
          </div>
          <button
            className="chip"
            onClick={() => {
              signOutAthlete();
              setMenuOpen(false);
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}

function RequireAuth({ children }) {
  const { user, athlete, ready, athleteLoading } = useAuth();
  if (!ready || athleteLoading)
    return (
      <div className="page">
        <div className="skel" style={{ height: 120 }} />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  // Signed in but the athlete doc was never written (partial signup):
  // let them finish setup instead of bouncing them to the leaderboard.
  if (!athlete) return <FinishSetup />;
  return children;
}

function AuthProvider({ children }) {
  const { user, ready } = useAuthUser();
  const { athlete, loading: athleteLoading } = useMyAthlete(user?.uid);
  return (
    <AuthCtx.Provider value={{ user, athlete, ready, athleteLoading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          {!isConfigured && (
            <div className="banner">
              ⚠️ Firebase isn't configured yet — paste your config into{" "}
              <code>src/firebase.js</code> (see build-walkthrough.md Part 3),
              then <code>npm run build</code>.
            </div>
          )}
          <Header />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/versus" element={<RequireAuth><Versus /></RequireAuth>} />
            <Route path="/feed" element={<RequireAuth><Feed /></RequireAuth>} />
            <Route path="/log" element={<RequireAuth><LogSession /></RequireAuth>} />
            <Route path="/athletes/:id" element={<RequireAuth><AthleteProfile /></RequireAuth>} />
            <Route path="/ai-coach" element={<RequireAuth><AICoach /></RequireAuth>} />
            <Route path="/invite" element={<RequireAuth><Invite /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Nav />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
