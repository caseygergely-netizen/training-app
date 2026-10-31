import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Board", icon: "🏆", end: true },
  { to: "/versus", label: "Versus", icon: "⚔️" },
  { to: "/feed", label: "Feed", icon: "📰" },
  { to: "/log", label: "Log", icon: "➕" },
  { to: "/tests", label: "PBs", icon: "🏁" },
  { to: "/coaches", label: "Corner", icon: "🗣️" },
  { to: "/ai-coach", label: "AI Coach", icon: "🤖" },
];

export default function Nav() {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <span className="ico">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
