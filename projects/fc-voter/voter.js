// Redundant flight-controller simulation: three FCs measure roll; faults are injected;
// a redundancy manager picks the output. Pure and deterministic (seeded).

export const FAULTS = {
  none: "No fault",
  bias: "Bias (offset, °)",
  drift: "Drift (°/s)",
  stuck: "Frozen output",
  noise: "Noise burst (σ, °)",
  dropout: "Stops reporting",
};

export const MODES = {
  median: "Median vote + disagreement monitor",
  master: "Master/slave (heartbeat only)",
};

/** Small seeded PRNG (mulberry32) so every run is repeatable. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gaussian(rand) {
  const u = Math.max(rand(), 1e-12), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Roll angle the aircraft actually flies: a mix of slow and quicker manoeuvres. */
export const truthRoll = (t) => 20 * Math.sin((2 * Math.PI * t) / 8) + 8 * Math.sin((2 * Math.PI * t) / 2.3);

/** One FC's reading at time t given its fault (NaN = no data). */
function reading(t, truth, fault, rand, state) {
  const base = truth + gaussian(rand) * 0.3;
  if (!fault || fault.type === "none" || t < fault.start) return base;
  switch (fault.type) {
    case "bias": return base + fault.magnitude;
    case "drift": return base + fault.magnitude * (t - fault.start);
    case "stuck": return (state.frozen ??= base);
    case "noise": return base + gaussian(rand) * fault.magnitude;
    case "dropout": return NaN;
    default: return base;
  }
}

/**
 * Run the simulation.
 * mode: "median" — exclude an FC whose reading strays from the median of the healthy set by
 *   more than `threshold` for `persist` seconds, or that stops reporting for `persist` seconds.
 * mode: "master" — use FC1 until its heartbeat stops (no data for `persist` s), then FC2, then FC3.
 */
export function simulate({
  mode = "median", faults = [], duration = 30, hz = 50, threshold = 3, persist = 0.2, seed = 7,
} = {}) {
  const rand = rng(seed);
  const dt = 1 / hz;
  const needed = Math.max(1, Math.round(persist * hz));
  const fcState = [{}, {}, {}];
  const excluded = [null, null, null];      // time each FC was excluded
  const strikes = [0, 0, 0];
  const silent = [0, 0, 0];
  let active = 0;                            // master/slave: current master
  let last = 0;
  let warnedNoMajority = false;
  const series = { t: [], truth: [], fc: [[], [], []], out: [], healthy: [[], [], []] };
  const events = [];

  for (let k = 0; k <= duration * hz; k++) {
    const t = k * dt;
    const truth = truthRoll(t);
    const r = [0, 1, 2].map((i) => reading(t, truth, faults[i], rand, fcState[i]));
    const healthy = [0, 1, 2].filter((i) => excluded[i] === null);

    // Heartbeat: an FC that sends nothing for `persist` seconds is dropped in either mode.
    for (const i of healthy) {
      silent[i] = Number.isNaN(r[i]) ? silent[i] + 1 : 0;
      if (silent[i] >= needed) {
        excluded[i] = t;
        events.push({ t, fc: i, kind: "exclude", msg: `FC${i + 1} stopped reporting — dropped` });
      }
    }

    let out;
    if (mode === "master") {
      if (excluded[active] !== null) {
        const next = [0, 1, 2].find((i) => excluded[i] === null);
        if (next !== undefined) {
          events.push({ t, fc: next, kind: "switch", msg: `Switched to FC${next + 1}` });
          active = next;
        }
      }
      out = excluded[active] === null && !Number.isNaN(r[active]) ? r[active] : last;
    } else {
      const live = [0, 1, 2].filter((i) => excluded[i] === null && !Number.isNaN(r[i]));
      if (live.length >= 3) {
        const m = median(live.map((i) => r[i]));
        for (const i of live) {
          strikes[i] = Math.abs(r[i] - m) > threshold ? strikes[i] + 1 : 0;
          if (strikes[i] >= needed) {
            excluded[i] = t;
            events.push({ t, fc: i, kind: "exclude", msg: `FC${i + 1} disagreed with the others — dropped` });
          }
        }
        out = median([0, 1, 2].filter((i) => excluded[i] === null && !Number.isNaN(r[i])).map((i) => r[i]));
      } else if (live.length === 2) {
        const [a, b] = live;
        if (Math.abs(r[a] - r[b]) > threshold && !warnedNoMajority) {
          warnedNoMajority = true;
          events.push({ t, fc: null, kind: "warn", msg: `FC${a + 1} and FC${b + 1} disagree with no third vote — can't tell which is wrong` });
        }
        out = (r[a] + r[b]) / 2;
      } else if (live.length === 1) out = r[live[0]];
      else out = last;
    }
    last = out;

    series.t.push(t); series.truth.push(truth); series.out.push(out);
    for (let i = 0; i < 3; i++) { series.fc[i].push(r[i]); series.healthy[i].push(excluded[i] === null); }
  }

  // Scoring
  const errs = series.out.map((o, k) => Math.abs(o - series.truth[k]));
  const rms = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
  const outOfTol = (errs.filter((e) => e > threshold).length) / hz;
  const detections = [0, 1, 2].filter((i) => faults[i] && faults[i].type !== "none").map((i) => ({
    fc: i, type: faults[i].type, start: faults[i].start,
    detectedAfter: excluded[i] === null ? null : Math.max(0, excluded[i] - faults[i].start),
  }));
  return { series, events, excluded, metrics: { rms, maxError: Math.max(...errs), outOfTolerance: outOfTol, detections } };
}
