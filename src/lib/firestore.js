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
  query,
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
} from "firebase/auth";
import { buildSeedData } from "./seed";
import { handicapAt, sessionPoints, todayStr } from "./points";

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

export function signInAthlete(email, password) {
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
  const points = sessionPoints({ minutes: fields.minutes, difficulty, handicap });
  const ref = doc(collection(db, "sessions"));
  await setDoc(ref, {
    athleteId: athlete.id,
    sport: fields.sport,
    date: fields.date,
    minutes: Number(fields.minutes),
    distanceKm: fields.distanceKm != null ? Number(fields.distanceKm) : null,
    details: fields.details || "",
    difficulty,
    difficultyBy: fields.difficultyBy === "ai" ? "ai" : "manual-default",
    handicapUsed: handicap,
    points,
    notes: fields.notes || "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** AI coach (via the athlete) updates a session's difficulty after review. */
export async function setSessionDifficulty(session, difficulty, athlete) {
  const handicap = handicapAt(athlete, session.date);
  await updateDoc(doc(db, "sessions", session.id), {
    difficulty,
    difficultyBy: "ai",
    handicapUsed: handicap,
    points: sessionPoints({ minutes: session.minutes, difficulty, handicap }),
  });
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
