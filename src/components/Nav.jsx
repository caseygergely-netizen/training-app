import { NavLink } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { useCoachPosts, useCoachReadsForPosts } from "../lib/firestore.js";

const TABS = [
  { to: "/", label: "Board", icon: "🏆", end: true },
  { to: "/feed", label: "Feed", icon: "📰" },
  { to: "/tests", label: "PBs", icon: "🏁" },
  { to: "/coaches", label: "Corner", icon: "🗣️", corner: true },
  { to: "/coaches-hub", label: "Coaches", icon: "🤖" },
];

/**
 * Bottom tab bar. The Corner tab carries a ★ whenever ANY Corner post
 * is unread by the signed-in athlete (Casey's spec, Nov 16, 2026: a
 * star, no count, bot check-ins included — he reads it all). "Unread"
 * uses the Corner's own read receipts (coachReads): a post counts as
 * unread when it isn't mine and I hold no read doc on it — the same
 * predicate the Corner's "● N new" badges use. The star clears as the
 * receipts land while he reads.
 */
export default function Nav() {
  const { athlete } = useAuth();
  const { posts } = useCoachPosts(200);
  const postIds = posts.map((p) => p.id);
  const { reads } = useCoachReadsForPosts(postIds);
  const myReadIds = new Set(
    athlete ? reads.filter((r) => r.readerUid === athlete.id).map((r) => r.postId) : []
  );
  const cornerUnread =
    !!athlete &&
    posts.some((p) => p.authorUid !== athlete.id && !myReadIds.has(p.id));

  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <span className="ico">
            {t.icon}
            {t.corner && cornerUnread && (
              <span className="tab-star" aria-label="Unread Corner posts">
                ★
              </span>
            )}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
