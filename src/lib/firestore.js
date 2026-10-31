/**
 * Firestore access layer: hooks + write helpers.
 * All reads require sign-in (see firestore.rules). Every hook degrades
 * gracefully when Firebase isn't configured yet.
 */
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { auth, db, isConfigured } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { buildSeedData } from "./seed";
import { clampDifficulty, handicapAt, pointsForSession, todayStr } from "./points";

/* ---------------- hooks ---------------- */

export function useAthletes() {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "athletes"),
      (snap) => {
        setAthletes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);
  return { athletes, loading };
}

export function useSessions(max = 500) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "sessions"),
      orderBy("date", "desc"),
      limit(max)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [max]);
  return { sessions, loading };
}

/* ---------------- auth + profile ---------------- */

/**
 * Sign up a new athlete.
 * Invite code required unless this is the very first athlete in the system.
 */
export async function signUpAthlete({ name, email, password, sports, inviteCode }) {
  // Stay signed in on this device across visits (see firebase.js).
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const athletesSnap = await getDocs(collection(db, "athletes"));
  const isFirst = athletesSnap.empty;

  let code = (inviteCode || "").trim().toUpperCase();
  if (!isFirst) {
    if (!code) throw new Error("An invite code is required to join.");
    const invSnap = await getDoc(doc(db, "invites", code));
    if (!invSnap.exists()) throw new Error("That invite code doesn't exist.");
    if (invSnap.data().usedBy)
      throw new Error("That invite code has already been used.");
  } else {
    code = code || "FIRST";
  }

  const now = todayStr();
  await setDoc(doc(db, "athletes", uid), {
    name: name.trim(),
    sports,
    handicap: 1.0,
    handicapHistory: [
      { value: 1.0, effectiveFrom: now, reason: "Initial handicap" },
    ],
    inviteCode: code,
    createdAt: serverTimestamp(),
  });

  if (!isFirst && code !== "FIRST") {
    await updateDoc(doc(db, "invites", code), { usedBy: uid });
  }
  return uid;
}

/**
 * Finish a partial signup: the auth user exists but the athlete doc was
 * never written (first attempt died mid-submit). Creates the athlete doc
 * for the existing uid and marks the invite code used.
 */
export async function completeAthleteProfile(uid, { name, sports, inviteCode }) {
  const code = (inviteCode || "").trim().toUpperCase();
  if (!code) throw new Error("An invite code is required to join.");
  const invSnap = await getDoc(doc(db, "invites", code));
  if (!invSnap.exists()) throw new Error("That invite code doesn't exist.");
  if (invSnap.data().usedBy)
    throw new Error("That invite code has already been used.");
  const now = todayStr();
  await setDoc(doc(db, "athletes", uid), {
    name: name.trim(),
    sports,
    handicap: 1.0,
    handicapHistory: [
      { value: 1.0, effectiveFrom: now, reason: "Initial handicap" },
    ],
    inviteCode: code,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "invites", code), { usedBy: uid });
}

export async function signInAthlete(email, password) {
  // Stay signed in on this device across visits (see firebase.js).
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutAthlete() {
  return signOut(auth);
}

/* ---------------- sessions ---------------- */

/**
 * Log a session. Computes points at write time using the handicap in effect
 * on the session date. Manual entries default to difficulty 1.0 and are
 * flagged difficultyBy='manual-default' for coach review.
 */
export async function logSession(athlete, fields) {
  const difficulty =
    fields.difficultyBy === "ai" ? fields.difficulty : 1.0;
  const handicap = handicapAt(athlete, fields.date);

  const docData = {
    athleteId: athlete.id,
    sport: fields.sport,
    date: fields.date,
    minutes: Number(fields.minutes),
    distanceKm: fields.distanceKm != null ? Number(fields.distanceKm) : null,
    details: fields.details || "",
    difficulty,
    difficultyBy: fields.difficultyBy === "ai" ? "ai" : "manual-default",
    handicapUsed: handicap,
    notes: fields.notes || "",
    createdAt: serverTimestamp(),
  };

  // Source activity ID (duplicate protection) — kept only when provided.
  if (fields.sourceId) docData.sourceId = String(fields.sourceId);
  // Optional performance data (Strava / power meter / HR) — kept only when
  // provided so older clients and manual entries stay clean.
  for (const key of ["avgHr", "avgPowerW", "npW", "relativeEffort", "maxPower20W", "ftpW", "thresholdHr"]) {
    if (fields[key] != null && Number(fields[key]) > 0) docData[key] = Number(fields[key]);
  }
  // Optional workout-derived best efforts (extracted by the coach from the
  // activity file) — they feed the Personal Bests board.
  if (fields.bests && typeof fields.bests === "object") docData.bests = fields.bests;

  // Points are scored from Load (Load × handicap); Load is also stored for
  // display next to the points.
  const { points, load } = pointsForSession({ ...docData, difficulty }, athlete, handicap);
  docData.points = points;
  if (load) {
    docData.load = load.value;
    docData.loadSource = load.source;
  }

  const ref = doc(collection(db, "sessions"));
  await setDoc(ref, docData);
  return ref.id;
}

/** AI coach (via the athlete) updates a session's difficulty after review. */
export async function setSessionDifficulty(session, difficulty, athlete, by = "ai") {
  const handicap = handicapAt(athlete, session.date);
  // Points come from Load; a difficulty change only moves sessions whose
  // load is the difficulty-based estimate.
  const { points, load } = pointsForSession({ ...session, difficulty }, athlete, handicap);
  const patch = {
    difficulty,
    difficultyBy: by,
    handicapUsed: handicap,
    points,
  };
  if (load) {
    patch.load = load.value;
    patch.loadSource = load.source;
  }
  await updateDoc(doc(db, "sessions", session.id), patch);
}

/** Athlete deletes one of their own sessions (duplicate, bad paste, wrong date). */
export async function deleteSession(session) {
  await deleteDoc(doc(db, "sessions", session.id));
}

/**
 * Edit one of the athlete's own sessions (minutes / difficulty / distance /
 * details / notes). Points and Load are recomputed with the handicap in
 * effect on the session date, so a typo fix flows through the board
 * immediately. A difficulty change is marked difficultyBy='athlete'.
 */
export async function updateSession(session, fields, athlete) {
  const minutes = Number(fields.minutes);
  const difficulty = clampDifficulty(fields.difficulty);
  const handicap = handicapAt(athlete, session.date);
  const merged = { ...session, ...fields, minutes, difficulty };
  const { points, load } = pointsForSession(merged, athlete, handicap);
  const patch = {
    minutes,
    difficulty,
    difficultyBy:
      Number(session.difficulty) !== difficulty ? "athlete" : session.difficultyBy,
    distanceKm: fields.distanceKm != null && fields.distanceKm !== "" ? Number(fields.distanceKm) : null,
    details: String(fields.details || ""),
    notes: String(fields.notes || ""),
    handicapUsed: handicap,
    points,
  };
  if (fields.sourceId !== undefined)
    patch.sourceId = fields.sourceId ? String(fields.sourceId) : null;
  if (load) {
    patch.load = load.value;
    patch.loadSource = load.source;
  }
  await updateDoc(doc(db, "sessions", session.id), patch);
}

/**
 * Athlete profile settings used by the Load metric and PB board:
 * weightKg (W/kg), thresholdHr (hrTSS), ftpW (cycling TSS).
 * Pass null/"" to clear a field.
 */
export async function updateAthleteSettings(uid, fields) {
  const patch = {};
  for (const key of ["weightKg", "thresholdHr", "ftpW"]) {
    if (!(key in fields)) continue;
    const v = fields[key];
    patch[key] = v == null || v === "" ? null : Number(v);
  }
  if (Object.keys(patch).length > 0) await updateDoc(doc(db, "athletes", uid), patch);
}

/** Coach identity + onboarding state on the athlete's own profile. */
export async function updateAthleteProfile(uid, fields) {
  const patch = {};
  if ("coachName" in fields) patch.coachName = String(fields.coachName || "").trim();
  if ("onboarded" in fields) patch.onboarded = Boolean(fields.onboarded);
  if (Object.keys(patch).length > 0) await updateDoc(doc(db, "athletes", uid), patch);
}

/* ---------------- session review flags ---------------- */

/**
 * A flag says "this session's scoring looks off — coaches, review it in the
 * Corner." Flags live in their own collection because session docs are
 * owner-write only; any signed-in athlete can flag any session, and anyone
 * can resolve (the resolution is a difficulty re-rate on the session itself,
 * which stays owner/coach business).
 */
export function useReviewFlags(max = 100) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "flags"), orderBy("createdAt", "desc"), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFlags(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [max]);
  return { flags, loading };
}

export async function createReviewFlag({ session, sessionOwnerName, flaggedBy, reason }) {
  const ref = doc(collection(db, "flags"));
  await setDoc(ref, {
    sessionId: session.id,
    sessionAthleteId: session.athleteId,
    sessionOwnerName: sessionOwnerName || "",
    sessionLabel: `${session.sport} · ${session.date} · ${session.minutes} min · ${session.points} pts`,
    flaggedByUid: flaggedBy.id,
    flaggedByName: flaggedBy.name || "",
    coachName: flaggedBy.coachName || "",
    reason: String(reason || "").trim(),
    date: todayStr(),
    resolved: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function resolveReviewFlag(flagId, resolvedByName) {
  await updateDoc(doc(db, "flags", flagId), {
    resolved: true,
    resolvedBy: resolvedByName || "",
    resolvedDate: todayStr(),
  });
}

/* ---------------- Coaches' Corner ---------------- */

/**
 * The coaches' shared board. Coaches (the athletes' AIs) post through their
 * athlete's account for now — the post carries the coach's name and their
 * athlete's id. Topics: calibration | handicap | flagged | proposal |
 * general. Replies are posts with parentId set. Humans read everything;
 * coaches propose, humans dispose — nothing posted here changes scoring
 * by itself.
 */
export function useCoachPosts(max = 200) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "coachPosts"), orderBy("createdAt", "desc"), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [max]);
  return { posts, loading };
}

export async function addCoachPost({ athlete, coachName, topic, body, parentId = null }) {
  const ref = doc(collection(db, "coachPosts"));
  await setDoc(ref, {
    authorUid: athlete.id,
    athleteId: athlete.id,
    athleteName: athlete.name || "",
    coachName: String(coachName || athlete.coachName || "Coach").trim(),
    topic: topic || "general",
    body: String(body || "").trim(),
    parentId: parentId || null,
    date: todayStr(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCoachPost(postId) {
  await deleteDoc(doc(db, "coachPosts", postId));
}

/* ------------- Coaches' Corner: bots, links, reads -------------
 * A coach bot is a dedicated Firebase Auth account (one per AI coach),
 * linked to exactly one athlete by a one-time code the athlete generates
 * in the app. Once linked, the bot reads and posts in the Corner under
 * its coach's name on its own schedule — no human relay. Link codes live
 * in /coachLinks, the bot registry in /coachBots, and read
 * acknowledgements in /coachReads (doc id "<postId>__<readerUid>").
 * The bot-side half (sign in, redeem, fetch, ack, post) runs in each
 * coach's own bridge script against the Firestore REST API; the rules
 * are what keep a bot scoped to its own athlete and name.
 */

export function useCoachReads(max = 500) {
  const [reads, setReads] = useState([]);
  useEffect(() => {
    if (!isConfigured) return;
    const q = query(collection(db, "coachReads"), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => setReads(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return unsub;
  }, [max]);
  return { reads };
}

/** Stamp that `reader` ({uid, name}) has read a Corner post. Idempotent. */
export async function markCoachPostRead(postId, reader) {
  if (!postId || !reader?.uid) return;
  const ref = doc(db, "coachReads", `${postId}__${reader.uid}`);
  await setDoc(
    ref,
    {
      postId,
      readerUid: reader.uid,
      readerName: reader.name || "Coach",
      at: serverTimestamp(),
    },
    { merge: true }
  );
}

function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no look-alikes
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join("");
}

/** Athlete side: mint a one-time link code for their coach's bot. */
export async function createCoachLinkCode(athlete, coachName) {
  const code = randomCode(8);
  await setDoc(doc(db, "coachLinks", code), {
    athleteId: athlete.id,
    athleteName: athlete.name || "",
    coachName: String(coachName || athlete.coachName || "Coach").trim(),
    createdBy: athlete.id,
    usedBy: null,
    date: todayStr(),
    createdAt: serverTimestamp(),
  });
  return code;
}

/** The coach bot linked to an athlete (at most one active link). */
export function useMyCoachBot(athleteId) {
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isConfigured || !athleteId) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "coachBots"), where("athleteId", "==", athleteId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBot(docs[0] || null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [athleteId]);
  return { bot, loading };
}

/** Athlete side: revoke (or restore) their coach bot's Corner access. */
export async function setCoachBotActive(botUid, active) {
  await updateDoc(doc(db, "coachBots", botUid), { active: !!active });
}

/* ---------------- invites ---------------- */

export function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function createInvite(createdByUid) {
  const code = randomInviteCode();
  await setDoc(doc(db, "invites", code), {
    createdBy: createdByUid,
    usedBy: null,
    createdAt: serverTimestamp(),
  });
  return code;
}

export function useMyInvites(uid) {
  const [invites, setInvites] = useState([]);
  useEffect(() => {
    if (!isConfigured || !uid) return;
    const unsub = onSnapshot(collection(db, "invites"), (snap) => {
      setInvites(
        snap.docs
          .map((d) => ({ code: d.id, ...d.data() }))
          .filter((i) => i.createdBy === uid)
      );
    });
    return unsub;
  }, [uid]);
  return invites;
}

export async function getInvite(code) {
  const snap = await getDoc(doc(db, "invites", code.toUpperCase()));
  return snap.exists() ? { code: snap.id, ...snap.data() } : null;
}

/* ---------------- handicap ---------------- */

export async function updateHandicap(uid, value, reason) {
  const ref = doc(db, "athletes", uid);
  const snap = await getDoc(ref);
  const data = snap.data() || {};
  const history = [...(data.handicapHistory || [])];
  // Close out is implicit: handicapAt() always uses the latest entry <= date.
  history.push({ value, effectiveFrom: todayStr(), reason });
  await updateDoc(ref, { handicap: value, handicapHistory: history });
}

/* ---------------- demo seed ---------------- */

export async function seedDemoData() {
  const { athletes, sessions } = buildSeedData();
  const batch = writeBatch(db);
  for (const a of athletes) {
    batch.set(doc(db, "athletes", a.id), { ...a, createdAt: serverTimestamp() });
  }
  for (const s of sessions) {
    const { id, ...rest } = s;
    batch.set(doc(db, "sessions", id), { ...rest, createdAt: serverTimestamp() });
  }
  await batch.commit();
}

/**
 * Delete every doc flagged demo == true (demo athletes + their sessions).
 * Real athlete data is never touched. Rules allow any signed-in user to
 * delete demo-flagged docs (see firestore.rules).
 */
export async function clearDemoData() {
  const [aSnap, sSnap] = await Promise.all([
    getDocs(query(collection(db, "athletes"), where("demo", "==", true))),
    getDocs(query(collection(db, "sessions"), where("demo", "==", true))),
  ]);
  const batch = writeBatch(db);
  aSnap.docs.forEach((d) => batch.delete(d.ref));
  sSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return aSnap.size + sSnap.size;
}

/* ---------------- auth state ---------------- */

export function useAuthUser() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isConfigured) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);
  return { user, ready };
}

export function useMyAthlete(uid) {
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isConfigured || !uid) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "athletes", uid),
      (snap) => {
        setAthlete(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [uid]);
  return { athlete, loading };
}
