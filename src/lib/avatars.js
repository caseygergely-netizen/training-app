/**
 * Athlete avatar photos (Casey, Nov 15, 2026): static bundled assets in
 * public/avatars/, cropped square by Nyx from Casey's Google Photos
 * face groups and verified against each athlete's named group.
 * Keyed by athleteId (the durable key); the exact display name is a
 * fallback so a re-created athlete doc still finds its photo.
 * Athletes without a photo fall back to initials (see Avatar.jsx).
 *
 * IDs verified Nov 15, 2026 against the live athletes collection via
 * the coach bridge (athleteMap joined to 121 live sessions).
 */
const AVATAR_BY_ATHLETE_ID = {
  "jnvRd5FdaXM8PRHGKY8GJJCG9Cs1": "/avatars/casey.jpg", // Casey Gergely
  "iMPdZlvQjoWVwrPcAvTCsmm2PQC2": "/avatars/pat.jpg", // Pat Edwards (Patrick Boreskie)
  "MxXK68G3gsUjWiqrM9FYJesIrs52": "/avatars/braeden.jpg", // Braeden Taylor
  "ey5MXHvO45Ubc4SLEFtsBFjHc1k2": "/avatars/graham.jpg", // Graham O'Bray
};

const AVATAR_BY_NAME = {
  "Casey Gergely": "/avatars/casey.jpg",
  "Pat Edwards": "/avatars/pat.jpg",
  "Patrick Boreskie": "/avatars/pat.jpg",
  "Braeden Taylor": "/avatars/braeden.jpg",
  "Graham O’Bray": "/avatars/graham.jpg",
};

/** Bundled avatar photo URL for an athlete, or null (→ initials). */
export function avatarUrlFor(athlete) {
  if (!athlete) return null;
  return (
    AVATAR_BY_ATHLETE_ID[athlete.id] ||
    AVATAR_BY_NAME[athlete.name] ||
    null
  );
}
