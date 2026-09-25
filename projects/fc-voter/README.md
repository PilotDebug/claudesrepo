# FC Voter

Three flight controllers measure roll; one output drives the aircraft. Inject faults into
any of them and compare two redundancy strategies on the same faults. It's the first slice
of the **Pixhawk multi-FC redundancy board** idea.

## Strategies

- **Median vote + disagreement monitor:** the output is the median of the healthy
  controllers. A controller that differs from the median by more than the threshold, for
  longer than the persistence time, is dropped. With only two left, a disagreement can't
  be resolved, and the log says so.
- **Master/slave (heartbeat only):** use FC1 until it stops reporting, then fail over. It
  catches silent failures but misses controllers that are confidently wrong.

## Faults

Bias (fixed offset), drift (growing offset), frozen output, noise burst, and stopping
reporting. Sensor noise is seeded, so every run is repeatable.

## Notes

- `voter.js` holds the simulation and `voter.test.js` covers detection timing, both
  strategies, and the no-majority case.
- It's a learning tool, not flight software. Real systems also cross-check rates, use
  dissimilar sensors, and go through far more testing.
