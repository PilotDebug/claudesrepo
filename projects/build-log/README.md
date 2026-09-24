# Kit Build Log

A shop-time tracker for a homebuilt aircraft kit: log sessions by assembly, see hours
per assembly and per week, and keep the record safe with CSV export/import.

## Notes

- Data lives in the browser's `localStorage` — use **Export CSV** as the backup.
  The CSV opens in any spreadsheet and imports back without duplicating sessions.
- The assembly suggestions follow a typical Bearhawk-style kit; type anything to add your own.
- `log.js` holds all the logic (validation, weekly buckets, CSV); `log.test.js` covers it.
