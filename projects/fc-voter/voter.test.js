import { test } from "node:test";
import assert from "node:assert/strict";
import { median, rng, simulate, truthRoll } from "./voter.js";

test("median and seeded RNG", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  const a = rng(1), b = rng(1);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("clean flight: nothing excluded, output tracks truth", () => {
  const r = simulate({});
  assert.deepEqual(r.excluded, [null, null, null]);
  assert.equal(r.events.length, 0);
  assert.ok(r.metrics.rms < 0.3, `rms ${r.metrics.rms}`);
});

test("median vote drops a biased FC within the persistence window", () => {
  const r = simulate({ faults: [null, { type: "bias", start: 5, magnitude: 10 }], persist: 0.2, hz: 50 });
  assert.equal(r.excluded[0], null);
  assert.equal(r.excluded[2], null);
  const d = r.metrics.detections[0];
  assert.ok(d.detectedAfter !== null && d.detectedAfter <= 0.2 + 1e-9, `detected after ${d.detectedAfter}`);
  assert.ok(r.metrics.maxError < 3, "the median never follows the bad FC");
});

test("slow drift is caught once it crosses the threshold", () => {
  const r = simulate({ faults: [null, null, { type: "drift", start: 4, magnitude: 1 }], threshold: 3 });
  const d = r.metrics.detections[0];
  // 1 °/s crosses 3° after ~3 s; measured against the median (which the drifting FC pulls
  // slightly) and with sensor noise resetting the persistence counter, detection lands ~3–4.5 s.
  assert.ok(d.detectedAfter > 2.5 && d.detectedAfter < 4.5, `drift detected after ${d.detectedAfter}s`);
});

test("a frozen FC is caught when the aircraft manoeuvres", () => {
  const r = simulate({ faults: [{ type: "stuck", start: 3 }] });
  assert.notEqual(r.excluded[0], null);
});

test("master/slave misses a confidently wrong master…", () => {
  const r = simulate({ mode: "master", faults: [{ type: "bias", start: 5, magnitude: 10 }] });
  assert.equal(r.excluded[0], null, "heartbeat is fine, so no switch");
  assert.ok(r.metrics.maxError > 9);
  assert.ok(r.metrics.outOfTolerance > 20);
});

test("…but does switch when the master goes silent", () => {
  const r = simulate({ mode: "master", faults: [{ type: "dropout", start: 5 }], persist: 0.2 });
  assert.ok(r.events.some((e) => e.kind === "switch" && e.fc === 1));
  const k = Math.round(5.3 * 50);
  assert.ok(Math.abs(r.series.out[k] - truthRoll(r.series.t[k])) < 2);
});

test("two simultaneous faults leave no majority, and it says so", () => {
  const r = simulate({ faults: [{ type: "dropout", start: 5 }, { type: "bias", start: 5, magnitude: 8 }] });
  assert.ok(r.events.some((e) => e.kind === "warn" && /can't tell/.test(e.msg)));
});

test("runs are repeatable", () => {
  const a = simulate({ faults: [{ type: "noise", start: 2, magnitude: 5 }] });
  const b = simulate({ faults: [{ type: "noise", start: 2, magnitude: 5 }] });
  assert.deepEqual(a.series.out, b.series.out);
});
