# Morph Wing

A shape-per-phase explorer for wings that change shape. Step through **takeoff → climb →
cruise → landing** and watch four concepts reconfigure (section and top view, animated), then
compare what each one buys and costs. It's the first slice of the **UAV or robot that changes
shape such as wing** idea.

| Concept | What changes |
| --- | --- |
| Fixed wing + flaps | The baseline: 15° flaps to take off, 40° to land. |
| Slats + flaps (STOL) | Leading-edge slats deploy with the flaps: + ΔCLmax, a little weight and cruise drag. |
| Variable-area wing | Full wing to take off, climb and land; retracts chord (and optionally span) to cruise. |
| VTOL lift + cruise | Lift rotors hover at each end; a smaller clean wing cruises, carrying the stowed rotors. |

Each card has a "where it's done and how it's failed" note. The page also lists six more
shape-changing ideas.

## What it computes (rules of thumb)

- **ISA atmosphere** and the Gagg–Ferrar piston power lapse.
- **Stall:** Vs = √(2W / ρ S CLmax).
- **Drag:** parasite q·f plus induced W² / (q π e b²). Parasite drag is split: a share (default 40 %)
  is the wing and scales with its area, and the rest (fuselage, gear, struts) doesn't. Induced
  drag depends on **span**, not area: that's why shrinking span slows you down.
- **Top speed / 75 % cruise:** where power required meets power available.
- **Climb and ceiling:** excess power at the best speed (≥ 1.1 Vs); ceiling where it falls to 100 fpm.
- **Takeoff roll:** average-acceleration method at 0.7 V_LOF with a takeoff prop efficiency of 0.5.
  **Landing roll:** braking from 1.15 Vs with μ = 0.3.
- **VTOL:** momentum-theory hover power ÷ figure of merit. The battery for two hover segments is
  sized by iteration (more battery → more weight → more hover power → more battery) and it reports
  when that runs away.

All maths is in `morph.js` (tested in `morph.test.js` against hand-worked values). `drawing.js`
builds the section and planform geometry; `app.js` is the page.

## Decisions and limits

- **Placeholder airplane.** The defaults are round numbers for a generic ~180 hp four-seater, not
  any real type. Enter your own (they're saved in this browser).
- Added mechanism weight goes on top of gross weight (same payload), rather than eating payload.
- The ceiling uses whichever in-flight shape climbs better, since a morphing wing would choose.
- No stability, control, structure, flutter, or transition modelling. It compares ideas; it is
  **not for flight planning** or design sign-off.
