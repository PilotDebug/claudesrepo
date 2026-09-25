# Ferry Flight

Ferry your hours from paper to ForeFlight. Photograph each page of a paper pilot logbook,
let Claude read the handwriting, fix the handful of rows that don't add up, and download a
CSV that ForeFlight's logbook import accepts.

## How to use it

1. **Your logbook**: pick the logbook style, the year of the first entry (handwritten dates
   rarely include it), and paste an Anthropic API key. **Try sample pages** works without a key.
2. **Pages**: add photos in logbook order, one page or two-page spread each. **Read pages**
   sends each photo to Claude and gets the rows back as structured JSON (two at a time).
3. **Review**: every row is editable. Cells are flagged when something's off: PIC or night
   greater than total, class columns not matching total, dates going backwards, cells the
   model said it couldn't read. Most importantly, each page's **"totals this page" line** is
   read too, and the column sums are checked against it. A mismatch pinpoints which column
   holds the misread cell, so you check that column instead of re-reading the whole page.
4. **Aircraft**: one line per tail number, pre-filled from the page (model, and class from
   whichever ASEL/AMEL/… column held the hours). Type code, gear and engine are yours to fill
   in. Nothing aircraft-specific is invented.
5. **Export**: downloads `foreflight-import-<date>.csv`. Import it in ForeFlight on the web →
   Logbook → Import. **Save progress** writes a JSON file you can load later.

## Notes and decisions

- **Why bring-your-own key**: handwriting needs a real vision model. Tesseract-style OCR
  can't read logbook handwriting. The Hangar is static hosting with no secrets, so the page
  calls the Anthropic API straight from the browser with the user's key
  (`dangerouslyAllowBrowser`). The key is kept in memory, or in `localStorage` only if you
  tick "remember". The SDK (`@anthropic-ai/sdk`, pinned) loads from jsDelivr only when you
  press Read. For a public service, move the call into a Netlify function holding a
  server-side key, and add rate limiting and payment. That's the "graduate" step.
- **Model**: Claude Opus 5 by default, with Sonnet 5 as a cheaper option. On Opus 5 the
  request enables the API's server-side refusal fallback. The cost estimate on the Read
  button is rough, about $0.14 a page on Opus 5.
- **Structured output**: the response is constrained to `PAGE_SCHEMA` (`extract.js`). Every
  field is a string *as written*, and normalizing happens in tested JS (`normalize.js`):
  Jeppesen split hours|tenths columns, `h:mm`, ditto marks, day-only dates carried forward
  with month/year rollover, and the letter O read as zero.
- **ForeFlight format** (`foreflight.js`): the same layout ForeFlight's own export uses. A
  `ForeFlight Logbook Import` line, then an `Aircraft Table`, then a `Flights Table` with
  ForeFlight's column names. Paper logbooks don't record full-stop vs touch-and-go, so
  landings go to `AllLandings`, and night landings to `NightLandingsFullStop` (the usual
  convention for night currency). Check these if you rely on ForeFlight's currency tracking.
  Approaches go in as a count (`Approach1 = "n;;;<to>;;"`) because paper logs rarely record
  the type. `FlightReview`, `Checkride` and `IPC` are set from keywords in remarks.
- **Photos never persist**. They stay in memory for the session. Transcribed rows and edits
  are saved in `localStorage`.
- iPhone photos: the file picker converts HEIC to JPEG. On desktop, Chrome can't decode HEIC,
  so export as JPEG first.
- This is a transcription aid, not a logbook of record. Keep the paper original.

## Files

- `normalize.js`: raw handwriting strings → numbers, ISO dates, resolved dittos.
- `checks.js`: per-row sanity checks and the page-totals reconciliation.
- `foreflight.js`: aircraft derivation, ForeFlight column mapping, CSV writer.
- `extract.js`: prompt, JSON schema, response validation, cost estimate.
- `sample.js`: two made-up pages (one with a deliberate misread the totals check catches).
- `ferry.test.js`: `node --test`.
