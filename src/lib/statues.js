/**
 * Athlete statue portraits (Casey, Nov 16–17, 2026): a full tiered
 * ladder of generated trophy statues per athlete, bundled as static
 * assets in public/statues/. Every athlete has NINE portraits:
 *
 *   Win side (Throne reign, consecutive weekly wins):
 *     T1 gold · T2 bright gold · T3 platinum · T4 radiant gold ·
 *     T5 DIAMOND — each tier a different, more absurd statue.
 *   Loss side (Spoon streak, consecutive last-place finishes):
 *     L1 sad gold · L2 tarnished bronze, obese · L3 corroded
 *     verdigris/rust · L4 cracked clay, collapsed — each tier more
 *     pathetic than the last.
 *
 * (This replaces the Nov 16 design where one gold master portrait was
 * escalated by CSS filters; Casey asked for a different statue image
 * per tier, generated Nov 17, 2026, faces matched per athlete.)
 * Keyed by athleteId with the display name as fallback, mirroring
 * avatars.js (same IDs, verified Nov 15, 2026).
 */
const STATUE_SLUG_BY_ATHLETE_ID = {
  "jnvRd5FdaXM8PRHGKY8GJJCG9Cs1": "casey", // Casey Gergely
  "iMPdZlvQjoWVwrPcAvTCsmm2PQC2": "pat", // Pat Edwards (Patrick Boreskie)
  "MxXK68G3gsUjWiqrM9FYJesIrs52": "braeden", // Braeden Taylor
  "ey5MXHvO45Ubc4SLEFtsBFjHc1k2": "graham", // Graham O'Bray
};

const STATUE_SLUG_BY_NAME = {
  "Casey Gergely": "casey",
  "Pat Edwards": "pat",
  "Patrick Boreskie": "pat",
  "Braeden Taylor": "braeden",
  "Graham O’Bray": "graham",
};

/** Statue asset slug ("casey" | "pat" | "braeden" | "graham") or null. */
export function statueSlugFor(athlete) {
  if (!athlete) return null;
  return (
    STATUE_SLUG_BY_ATHLETE_ID[athlete.id] ||
    STATUE_SLUG_BY_NAME[athlete.name] ||
    null
  );
}

export const STATUE_MAX_WIN_TIER = 5;
export const STATUE_MAX_LOSS_TIER = 4;

/**
 * Tiered statue URL for an athlete. `side` is "win" (Throne reign,
 * tier 1..5) or "loss" (Spoon streak, tier 1..4); out-of-range tiers
 * clamp to the ladder. Returns null for an athlete with no statues.
 */
export function statueTierUrlFor(athlete, side, tier) {
  const slug = statueSlugFor(athlete);
  if (!slug) return null;
  if (side === "loss") {
    const t = Math.max(1, Math.min(STATUE_MAX_LOSS_TIER, Number(tier) || 1));
    return `/statues/${slug}-l${t}.webp`;
  }
  const t = Math.max(1, Math.min(STATUE_MAX_WIN_TIER, Number(tier) || 1));
  return `/statues/${slug}-t${t}.webp`;
}

/** The base trophy statue (win tier 1). */
export function statueUrlFor(athlete) {
  return statueTierUrlFor(athlete, "win", 1);
}

/**
 * Trophy cups (Casey, Nov 18–19, 2026): the rolling-title cups in
 * public/trophies/, one per athlete per level (L1–L10) — the
 * holder's face engraved on the cup, escalating in absurdity every
 * level. Generated Nov 18, 2026 (masters in statue-assets/trophy-cups/).
 */
export const TROPHY_CUP_MAX_LEVEL = 10;

/** Trophy cup URL for an athlete at a cup level (1..10, clamped). */
export function trophyCupUrlFor(athlete, level) {
  const slug = statueSlugFor(athlete);
  if (!slug) return null;
  const t = Math.max(1, Math.min(TROPHY_CUP_MAX_LEVEL, Number(level) || 1));
  return `/trophies/${slug}-l${t}.webp`;
}

/** The base sad statue (loss tier 1). */
export function sadStatueUrlFor(athlete) {
  return statueTierUrlFor(athlete, "loss", 1);
}

export const STATUE_MATERIALS = [
  "Gold",
  "Bright gold",
  "Platinum",
  "Radiant gold",
  "Diamond",
];

/** Win-side material name for a reign tier (1..5, clamped). */
export function statueMaterialFor(tier) {
  const t = Math.max(1, Math.min(5, Number(tier) || 1));
  return STATUE_MATERIALS[t - 1];
}

export const STATUE_LOSS_TIERS = [
  "Sad gold",
  "Tarnished bronze",
  "Corroded bronze",
  "Cracked clay",
];

/** Loss-side material name for a spoon-streak tier (1..4, clamped). */
export function statueLossNameFor(tier) {
  const t = Math.max(1, Math.min(4, Number(tier) || 1));
  return STATUE_LOSS_TIERS[t - 1];
}
