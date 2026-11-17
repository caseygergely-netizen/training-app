import LogSession from "./LogSession.jsx";
import AICoach from "./AICoach.jsx";

/**
 * The merged Coaches tab (Casey, Nov 16, 2026): the old Log and
 * AI Coach tabs were really for the AI coaches, not the humans, so
 * they now live together under one bottom-nav tab — log-a-session
 * first, then the coach contract / bot-linking spec below it. The
 * old /log and /ai-coach routes redirect here.
 */
export default function Coaches() {
  return (
    <>
      <LogSession />
      <div className="page" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <hr className="divider" />
        <p className="small muted" style={{ margin: 0 }}>
          👇 For your AI coach: the contract and bot-linking spec live
          below — paste the contract into your coach so it can post,
          score and argue on your behalf.
        </p>
      </div>
      <AICoach />
    </>
  );
}
