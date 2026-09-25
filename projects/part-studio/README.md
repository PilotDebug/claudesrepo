# Part Studio

Design a flat part, check it can be cut, and download a DXF for a laser, waterjet, or CNC
service. It's the first slice of the **idea-to-object workshop** idea: the "describe it →
parametric model → made" loop, starting with the simplest manufacturable thing, a flat part.

## Templates

- **Plate:** a rectangle with rounded corners and a grid of holes.
- **Bent bracket:** a 90° bracket shown as the flat pattern you'd cut. It uses the bend
  allowance `BA = θ·(R + K·t)`, with each flat leg equal to the outside flange minus `(R + t)`.
  Bend lines go on a separate `BEND` layer.
- **Panel:** round and rectangular cutouts you drag into place on the preview. The default
  sizes are placeholders; use real sizes from each instrument's installation drawing.

## Checks (rules of thumb)

- Holes at least as wide as the material is thick.
- At least one thickness of material between any cutout and an edge or another cutout.
- Holes kept at least 2t + R from a bend.

These flag likely trouble; they don't guarantee a good part. Your fab's guidelines win.

## Notes

- `parts.js` holds all the geometry, maths, checks, and exporters, and `parts.test.js` covers them.
- DXF is ASCII R12 (LINE, ARC, CIRCLE) with `$INSUNITS` set to mm or inches.
- SVG export is real-size with hairline red cut paths and blue dashed bend lines, the
  common convention for laser software.
- Settings are saved in `localStorage`.
