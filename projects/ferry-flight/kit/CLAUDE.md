# Ferry Flight: digitizing a paper pilot logbook

You are helping a pilot turn photos of their paper logbook into a file ForeFlight can import.
You read the photos and write one JSON transcription per photo. A small tool then checks your
work against the page's own "totals this page" line and builds the ForeFlight CSV. Accuracy
matters more than speed: this is the pilot's legal flight record.

## The folder

```
ferry.config.json   logbook style and year of the first entry (read it first)
photos/             the pilot's photos, one page or two-page spread each, in logbook order
pages/              your transcriptions: page-001.json, page-002.json, … (you write these)
aircraft.json       one entry per aircraft; created by `export`, then completed with the pilot
output/             report.md, foreflight-import.csv, ferry-flight-project.json (tool output)
tools/              ferry.mjs (checker/exporter), review.html (offline review page)
examples/           a worked example with made-up pages; use it to see the whole flow
```

## Workflow

1. **Orient.** Read `ferry.config.json`. List `photos/` sorted by file name (phone photos sort
   in the order they were taken). A photo is done when a `pages/` file names it in `"photo"`.
   If the order looks wrong (dates jump backwards across photos), ask the pilot.
2. **Transcribe a batch** of about 5–10 photos. For each photo, in order:
   - Look at the whole photo to count the rows and see which columns this logbook has.
   - Zoom in before reading numbers. Crop the photo into halves or thirds (for example with
     Python and Pillow) and read the crops. Small handwriting read from a full photo is where
     most mistakes come from.
   - Write `pages/page-NNN.json` (three digits, in logbook order) in the format below.
3. **Check.** Run `node tools/ferry.mjs check` and read `output/report.md`.
   - **Totals mismatch**: some cell in that column is misread (or the pilot added wrong).
     Zoom into that column on the photo and re-read every cell. A 🔎 line names the row most
     likely at fault.
   - **Row flags** (PIC more than total, date going backwards, class hours ≠ total, cells you
     marked uncertain): re-read those cells zoomed in.
   - Fix the page JSON only when the photo supports the new value. **Never change a value just
     to make a total add up.** If the pilot's own addition is wrong, leave the cells as written
     and say so in `notes`.
   - Re-run `check` until each page adds up or the remaining flags are explained.
4. **Report to the pilot** after each batch: pages done, anything you couldn't resolve (quote
   the photo, row and column), and anything only they can answer.
5. **Export** once all photos are done: run `node tools/ferry.mjs export`. It creates or
   updates `aircraft.json` with one entry per tail number. Go through it with the pilot:
   `TypeCode` (ICAO type designator, e.g. C172), `GearType`, `EngineType`, and the Complex /
   HighPerformance flags. You may suggest values for common types, but confirm them with the
   pilot; never invent aircraft-specific details. Then run `export` again.
6. **Hand over.** The pilot opens `tools/review.html` in Chrome or Edge, loads
   `output/ferry-flight-project.json`, adds the photos, and checks anything they want. They
   import `output/foreflight-import.csv` in ForeFlight on the web (Logbook → Import), then
   compare ForeFlight's totals with the last "total to date" line in the paper logbook.

## Page file format

One JSON object per photo. Every value is a **string exactly as written**. Leave out fields
that are empty on the page (the tool treats a missing field as blank).

```json
{
  "photo": "photos/PXL_20260925_153012345.jpg",
  "yearHint": "2019",
  "notes": "Row 5 is an endorsement, not a flight.",
  "rows": [
    { "date": "3/2/19", "makeModel": "C-172S", "tail": "N123AB", "from": "KPAO", "to": "KPAO",
      "remarks": "Intro flight", "instructor": "J. Instructor", "landingsDay": "1",
      "total": "1.0", "dual": "1.0", "asel": "1.0" },
    { "date": "9", "makeModel": "\"", "tail": "\"", "from": "\"", "to": "\"",
      "landingsDay": "1", "total": "1.2", "dual": "1.2", "asel": "1.2", "uncertain": ["total"] }
  ],
  "pageTotals": { "total": "2.2", "dual": "2.2", "asel": "2.2", "landingsDay": "2" }
}
```

Row fields:

- `date`: as written ("6/18", "18", "Jun 18 2022"). The tool fills in missing months and
  years from the rows above, so don't add them yourself.
- `makeModel`, `tail` (N-number / ident), `from`, `to`, `via` (stops in between), `remarks`,
  `instructor` (CFI name if written).
- `approaches`, `landingsDay`, `landingsNight`, or `landings` if the logbook has only one
  landings column.
- Hours: `total`, `pic`, `sic`, `dual` (dual received), `cfi` (dual given), `solo`, `xc`
  (cross-country), `night`, `actual` (actual instrument), `hood` (simulated instrument),
  `sim` (simulator / FTD / ATD), and category/class `asel`, `amel`, `ases`, `ames`.
- `uncertain`: a list of the field names in this row you couldn't read confidently.

Rules:

- Hours as decimals. Where hours and tenths are separate columns, join them ("1" and "3" →
  "1.3").
- A ditto mark (", 〃, "do") stays a ditto: write `"\""`. The tool copies the value above.
- One row per flight line. Skip blank lines and the "totals this page", "amount forwarded" and
  "total to date" lines as rows. Put the **"totals this page"** values in `pageTotals`, using
  the same field names. Mention forwarded and to-date values in `notes` if they're useful.
- A two-page spread is one photo and one file. Match left-page and right-page cells by line
  position.
- Endorsements, ground lessons and other non-flight entries: include them only if they log
  time in a column, and say what they are in `notes`.

## What the checker does

Use this if `node` isn't available: install a Node.js LTS release if you can, otherwise do
these checks yourself and write the same kind of report.

- **Normalizes values**: ditto marks copy the row above; day-only dates take the month and
  year from above, rolling over the month or year when the date goes backwards; "1 3" and
  "1:18" become hours.
- **Totals check**: sums each column on a page and compares it with `pageTotals`, with a
  tolerance of 0.05. When every mismatched column is off by the same amount, it names the one
  row that has a value in all of them.
- **Row checks**: missing date or flight time; PIC/SIC/dual/solo/XC/night/instrument more
  than total; class columns not adding to total; no PIC, SIC or dual logged; night landings
  without night time; dates earlier than the row above; fields marked uncertain.
- **Export**: writes ForeFlight's import layout (an Aircraft Table, then a Flights Table)
  from the pages and `aircraft.json`. Landings go to `AllLandings` and night landings to
  `NightLandingsFullStop`. Approaches go in as a count. "BFR", "IPC" and "checkride" in
  remarks set ForeFlight's matching flags.
