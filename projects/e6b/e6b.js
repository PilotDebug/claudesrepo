// Flight-computer maths. Pure functions: angles in degrees, speeds in knots,
// altitudes in feet, temperatures in °C, pressure in inHg.

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Normalise any angle to (-180, 180]. */
export const signedAngle = (a) => {
  const x = ((a % 360) + 360) % 360;
  return x > 180 ? x - 360 : x;
};

/** Normalise to [1, 360] — compass convention, where north is 360, not 0. */
export const compass = (a) => {
  const x = ((Math.round(a) % 360) + 360) % 360;
  return x === 0 ? 360 : x;
};

/** "27", "09L", "270" → magnetic heading in degrees. */
export function runwayHeading(input) {
  const n = parseInt(String(input).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 36) return n * 10;
  return n <= 360 ? n : null;
}

/**
 * Headwind and crosswind components for a runway.
 * headwind < 0 means a tailwind; side says which side the crosswind comes from.
 */
export function windComponents(runwayHdg, windDir, windSpeed) {
  const angle = signedAngle(windDir - runwayHdg);
  const headwind = windSpeed * Math.cos(rad(angle));
  const crosswind = windSpeed * Math.sin(rad(angle));
  return {
    angle,
    headwind,
    crosswind: Math.abs(crosswind),
    side: Math.abs(crosswind) < 0.05 ? "none" : crosswind > 0 ? "right" : "left",
  };
}

export const pressureAltitude = (elevation, altimeter) => elevation + (29.92 - altimeter) * 1000;

/** ISA temperature at a pressure altitude (standard lapse rate, ~2 °C / 1000 ft). */
export const isaTemp = (pressureAlt) => 15 - (1.98 * pressureAlt) / 1000;

/** Density altitude, using the common 120 ft per °C rule of thumb. */
export const densityAltitude = (pressureAlt, oat) => pressureAlt + 120 * (oat - isaTemp(pressureAlt));

/**
 * Wind triangle: heading to fly and groundspeed for a desired true course.
 * Returns null when the wind is too strong to hold the course.
 */
export function windTriangle(trueCourse, tas, windDir, windSpeed) {
  const angle = rad(windDir - trueCourse);
  const s = (windSpeed * Math.sin(angle)) / tas;
  if (tas <= 0 || Math.abs(s) > 1) return null;
  const wca = Math.asin(s);
  const groundSpeed = tas * Math.cos(wca) - windSpeed * Math.cos(angle);
  if (groundSpeed <= 0) return null;
  return { wca: deg(wca), heading: compass(trueCourse + deg(wca)), groundSpeed };
}
