import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
