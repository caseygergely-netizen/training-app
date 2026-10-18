# Training App (v1 scaffold)

Shared training competition app: AI coaches log sessions with difficulty scores,
the app turns them into points (`minutes × difficulty × handicap`), and friends
compete on a rolling 14-day leaderboard plus weekly head-to-head matchups.

Product decisions live in `../your_files/training-app-outline/training-app-outline.md`.
The full Windows setup walkthrough (VS Code, Node, Firebase, GitHub auto-deploy)
is at `../your_files/training-app-outline/build-walkthrough.md` — follow it.

## Quick start (after the walkthrough)

```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
```

## Tech

- Vite + React 18 (plain JavaScript) + React Router
- Firebase: Authentication (email/password), Cloud Firestore, Hosting
- Recharts for profile charts; hand-rolled SVG sparklines on the leaderboard

## Data model (Firestore)

- `athletes/{uid}` — name, sports[], handicap, handicapHistory[{value, effectiveFrom, reason}], inviteCode, createdAt
- `sessions/{id}` — athleteId, sport, date (YYYY-MM-DD), minutes, distanceKm?, details, difficulty (default 1.0), difficultyBy ('ai' | 'manual-default'), points (computed at write), notes, createdAt
- `invites/{code}` — createdBy, usedBy?, createdAt

Points are computed at write time using the handicap in effect on the session
date. A handicap re-evaluation applies to new sessions only (see
`src/lib/points.js`).

## Demo data

With an empty Firestore, the dashboard shows a **Load demo data** button that
writes 3 fictional athletes + ~6 weeks of sessions (including a 1.8-difficulty
Fly Friday and 0.6 easy swims) so every screen renders meaningfully. Demo docs
are flagged `demo: true`; `firestore.rules` allows any signed-in user to create
them. Tighten that rule before going beyond friends-and-family use.

## Screens

| Route            | What it is                                                     |
|------------------|----------------------------------------------------------------|
| `/`              | Rolling 14-day leaderboard + hype badges                        |
| `/versus`        | This week's head-to-head matchup cards (Mon–Sun)                |
| `/feed`          | Activity feed, newest first; tap a session for full details     |
| `/log`           | Manual session entry (+ paste-a-coach-block for AI difficulty)  |
| `/athletes/:id`  | Athlete profile: 14-day chart, per-sport breakdown, handicaps   |
| `/ai-coach`      | The AI interface contract (paste this into your AI coach)       |
| `/invite`        | Generate invite codes/links; sign up with a code                |
| `/login`         | Sign in / sign up                                               |

## Decisions made in this scaffold (not in the outline)

- **Signup bootstrap:** invite code required unless the athletes collection is
  still empty (first athlete onboards free).
- **Coach difficulty input:** the AI coach emits a JSON session block; the
  athlete pastes it into the Log page ("Coach entry" box), which sets the
  difficulty and marks `difficultyBy: 'ai'`. Schema is documented on `/ai-coach`.
- **Manual entries** default to difficulty 1.0 and are flagged in the feed as
  "awaiting coach review".
- **Versus projections:** the "projected winner" is simply whoever leads the
  pair right now, with days-remaining shown — no predictive model in v1.
- **Comeback of the week:** largest positive week-over-week points delta.
- No secrets or credentials are committed anywhere in this repo.
