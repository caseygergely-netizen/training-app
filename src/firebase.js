import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/* ============================================================================
   PASTE YOUR FIREBASE CONFIG HERE
   ----------------------------------------------------------------------------
   1. Go to https://console.firebase.google.com -> your project -> Project
      Overview -> click the </> icon (Add a Web app).
   2. Firebase shows you a `firebaseConfig` block. Copy the whole thing and
      paste it below, replacing the placeholder object.
   3. Save this file, then run `npm run build` to confirm it compiles.

   Full step-by-step: see build-walkthrough.md (Part 3).
   ============================================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyB_S6e5c6WPpWaBwLmTSlgjRXvH50TJbzM",
  authDomain: "training-app-db720.firebaseapp.com",
  projectId: "training-app-db720",
  storageBucket: "training-app-db720.firebasestorage.app",
  messagingSenderId: "25106473571",
  appId: "1:25106473571:web:62cbfd6388d066e7e24e56"
};

/** True once a real config has been pasted in. */
export const isConfigured =
  typeof firebaseConfig.apiKey === "string" &&
  !firebaseConfig.apiKey.startsWith("PASTE-YOUR");

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Keep athletes signed in across visits on the same device/browser.
 * Firebase Auth's web default is already local persistence in most
 * browsers, but some webviews / privacy modes fall back to session or
 * in-memory persistence — which is why athletes were being asked to sign
 * in again on later visits. Set it explicitly here, and again before each
 * sign-in / sign-up (see lib/firestore.js).
 */
export const authPersistenceReady = setPersistence(
  auth,
  browserLocalPersistence
).catch(() => {
  /* persistence unavailable (e.g. blocked storage) — sign-in still works */
});
