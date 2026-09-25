# Airfoil Lab

Compare NACA 4-digit sections, see how camber moves the lift curve, and design a section for
the lift you need. It's the first slice of the **foil to optimize for desired flight
characteristics** idea.

## What it computes

- **Geometry:** the standard NACA 4-digit equations with cosine spacing and a closed
  trailing edge.
- **Thin-airfoil theory (Glauert):** the zero-lift angle and quarter-chord moment, found by
  numerically integrating the camber slope. Cl = 2π(α − α_L0). The tests check it against the
  textbook NACA 2412 values (α_L0 ≈ −2.08°, Cm_c/4 ≈ −0.053).
- **Inverse design:** α_L0 is linear in camber, so for a target Cl at a chosen α the required
  camber comes straight out, then rounds to the nearest 4-digit code.
- **Reynolds number:** from airspeed and chord, for sea-level standard air.

## Limits

Thin-airfoil theory predicts no drag and no stall, and thickness doesn't affect lift in it. Use
it to build intuition, then check real section data (wind-tunnel polars, XFOIL) before
designing anything.

## Notes

- `airfoil.js` holds all the maths and `airfoil.test.js` covers it. `app.js` handles the page,
  charts, and hover readouts.
- The chart colours are a colour-blind-safe three-colour palette, and every line also has a
  direct label and a table row.
