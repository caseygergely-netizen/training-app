# Competition of Men — Braeden's updates (Oct 24, 2026)

Five requested changes, all in this zip. Extract over the repo root
(`C:\dev\training-app\training-app`), then the usual:

> ⚠️ **CASEY — read before extracting:** this zip's `src/firebase.js` comes
> from Nyx's working copy, which still has the PLACEHOLDER config
> ("PASTE-YOUR-API-KEY"). Your local copy has your real config pasted in.
> After extracting, re-paste your real `firebaseConfig` into
> `src/firebase.js` (keep the new persistence lines at the bottom), or skip
> extracting that one file and add the persistence lines by hand. If the
> app suddenly says "Firebase isn't configured yet", this is why.

```
git add .
git commit -m "Braeden updates: distance decimals, load, tests & PB board, auth persistence"
git push
```

## 1. Distance accepts two decimals (33.66 km)
- `src/pages/LogSession.jsx` — the distance input was `step="0.1"`, which made
  browsers reject values like 33.66 on submit. Now `step="0.01"`.
- `src/lib/points.js` — coach-block distances are kept at 2-decimal precision
  (`round2`); the feed now displays distance via `formatKm` (33.66 shows as
  33.66, 3.20 shows as 3.2).
- Nothing else truncated distance (validation already used `Number()`), so the
  step attribute was the culprit.

## 2. Training Load next to points
New session fields (all optional): `load`, `loadSource`, plus inputs
`relativeEffort`, `avgHr`, `avgPowerW`, `npW`, `maxPower20W`, session-level
`ftpW` / `thresholdHr`.
- Load is computed at write time in `logSession` (`src/lib/firestore.js`) by
  `computeLoad` (`src/lib/points.js`), in priority order:
  1. Strava Relative Effort, if provided (`loadSource: "strava"`)
  2. Cycling TSS from NP/avg power vs FTP (`"tss"`)
  3. hrTSS from avg HR vs threshold HR (`"hrtss"`)
  4. Fallback estimate: minutes × difficulty (`"est"`, shown as "Load 84 (est)")
- Shown next to points on every Feed card; older sessions without a stored
  load get one computed on the fly. The Log form has optional Avg HR /
  Avg power / Strava Relative Effort fields and a live Load preview.
- Note: there is still no automatic Strava sync in the app — load data
  arrives via coach blocks or the Log form fields. If a block includes
  `relativeEffort`, that's what Load shows.

## 3 + 4. Standard tests & the PB board
New page **Tests & PBs** (tab bar: 🏁 Tests, route `/tests`).

Test types (log via the Log form's new "Standard test" section, or a coach
block with `testType` + `test`):
| testType | sport | test object |
|---|---|---|
| `run5k` | running | `{ time: "19:42" }` or `{ timeSec: 1182 }` |
| `swimCss` | swimming | `{ t400Sec: 320, t200Sec: 155 }` (CSS pace computed) |
| `bikeFtp` | cycling | `{ avgPowerW: 268 }` (FTP estimate = 0.95 × power) |
| `ski10k` | skiing | `{ time: "38:24", conditions: "cold, fast" }` |
| `strength5rm` | strength | `{ lifts: { squat: {weightKg, reps}, bench: {...}, deadlift: {...} } }` (any subset; Epley 1RMs + total computed) |

New session fields: `testType`, `test` (normalized result object).
The Tests page shows, per test type: latest result, date, and delta vs the
previous test of the same type, plus full history.

PB board (same page, one metric per sport, each with its date):
- Running best 5 km — from run5k tests; if none, estimated by scaling the
  fastest-pace run ≥5 km (marked "estimated").
- Swimming best 400 m — from CSS tests; estimated the same way if none.
- Cycling best 20-min power in W and W/kg — from FTP tests (or any session
  with `maxPower20W` / avg power). W/kg needs the athlete's weight (below).
- Skiing best 10 km — from ski10k tests, flagged condition-dependent.
- Strength est. 1RM total (squat + bench + deadlift) from 5RM test days.

## New athlete profile fields (used by Load & PBs)
Set on **your own profile page** ("My numbers" card):
- `weightKg` — body weight, enables W/kg.
- `thresholdHr` — enables hrTSS when a session has avg HR but no power.
- `ftpW` — enables cycling TSS when a session has power data.

## 5. Stay signed in + landing-page glitch
- `src/firebase.js` + `src/lib/firestore.js` — Firebase Auth persistence is
  now explicitly `browserLocalPersistence`, set at startup and again before
  every sign-in/sign-up. (The web default is *usually* local, but some
  browsers/webviews fall back to session-only, which is why Braeden kept
  getting signed out.)
- **Likely glitch cause:** `src/App.jsx` rendered the whole shell — tab bar,
  login form, routed page — immediately, before `onAuthStateChanged`
  resolved, with user = null. A returning signed-in athlete saw a flash of
  the signed-out landing/login page (and the tab bar on the login screen),
  then the app swapped to the real content. The shell is now gated: a clean
  loading screen (brand + skeleton) shows until auth resolves, and the tab
  bar only renders when signed in.

## Files in this zip
- `UPDATE-NOTES.md` (this file)
- `src/lib/points.js` — load engine, test types/PBs, coach-block extensions
- `src/lib/firestore.js` — load at write time, auth persistence, profile settings
- `src/firebase.js` — explicit local auth persistence
- `src/App.jsx` — auth-gated first render, `/tests` route
- `src/components/Nav.jsx` — Tests tab
- `src/pages/Benchmarks.jsx` — NEW: Tests & PBs page
- `src/pages/LogSession.jsx` — distance step fix, HR/power fields, test section
- `src/pages/Feed.jsx` — Load next to points, test badges (difficulty rerate untouched)
- `src/pages/AthleteProfile.jsx` — "My numbers" settings card
- `src/pages/AICoach.jsx` — contract updated with the new fields & test blocks

No Firestore rule changes, no new packages. Existing sessions and points are
untouched; handicap logic unchanged.
