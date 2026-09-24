# E6B Flight Computer

Crosswind components with a live runway diagram, density altitude, and wind-correction
heading/groundspeed — the E6B whiz-wheel maths, worked as you type.

## Notes

- All maths lives in `e6b.js` as pure functions; `e6b.test.js` checks them against
  hand-worked examples. The UI (`app.js`) only reads inputs and renders.
- Density altitude uses the 120 ft/°C rule of thumb; pressure altitude uses 1000 ft/inHg.
- Inputs are remembered in `localStorage`.
