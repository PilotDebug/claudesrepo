# Ferry Flight kit

Turn photos of your paper pilot logbook into a ForeFlight import file, using Claude in a
Cowork project on your own computer. Claude reads the photos. A small checker compares every
page against its own "totals this page" line, so you only re-check the cells that don't add
up.

## What's in the folder

| Path | What it is |
|---|---|
| `CLAUDE.md` | Instructions Claude follows in this folder. You don't need to edit it. |
| `ferry.config.json` | Your logbook style and the year of your first entry. **Edit this.** |
| `photos/` | Put your logbook photos here. |
| `pages/` | Claude writes one transcription per photo here. |
| `output/` | The check report, the ForeFlight CSV, and a file for the review page. |
| `tools/ferry.mjs` | The checker and exporter (Claude runs it). |
| `tools/review.html` | Offline review page: double-click to open it in Chrome or Edge. |
| `examples/` | A worked example with two made-up logbook pages. |

## Set up (Windows)

1. Make a folder, e.g. `Documents\Logbook`, and unzip this kit into it.
2. Open `ferry.config.json` in Notepad. Set `logbookStyle` (`jeppesen`, `asa` or `other`) and
   `firstYear` (the year of your first logbook entry, e.g. `"2004"`). Handwritten dates rarely
   include the year.
3. Copy your logbook photos into `photos\`. Keep the Pixel's file names
   (`PXL_2026…jpg`): they sort in the order you took them, so shoot in logbook order.
4. In the Claude desktop app, start a Cowork task on the `Logbook` folder.

## Taking the photos (Pixel 8)

- Use the normal Camera app at the default 12 MP, **not** a document-scan mode. Scanners
  save PDFs and their black-and-white filter can erase pencil and faint ink.
- Shoot each **two-page spread** as one photo, so every row's date, route and hours stay
  together. Include the "totals this page" line at the bottom.
- Lay the book flat, press the spine down, and hold the phone directly above it, parallel to
  the page, with the spread filling the frame on the 1× lens.
- Use even daylight with no flash and no phone shadow. Zoom in on each photo to check it's
  sharp.
- Copy the photos to your PC with a USB cable (choose "File transfer" on the phone, then
  open `DCIM\Camera`) or download them from Google Photos.

## Try the example first

In Cowork, say:

> Read CLAUDE.md. Then run `node tools/ferry.mjs check --dir examples` and walk me through
> the report using the example photos.

The example's second page has a deliberate misread: row 1's total reads 1.3, but the photo
says 1.8. The report catches it because four columns are each off by 0.5, and it names row 1.
Ask Claude to fix it from the photo and check again. The page then adds up.

## Digitize your logbook

Start each session with:

> Read CLAUDE.md and transcribe the next 10 photos that don't have a page file yet. Run the
> check, fix what the photos support, and tell me what you couldn't resolve.

When every photo has a page file:

> Run the export and help me fill in aircraft.json.

A long logbook uses a fair amount of your Claude plan. Working in batches of about 10 photos
lets you stop and pick up later, because each finished page is saved in `pages\`.

## Review and import

1. Double-click `tools\review.html`. Click **Load project file** and choose
   `output\ferry-flight-project.json`. Click **Add photos** and select everything in
   `photos\` to compare each page with its photo.
2. Flagged cells are highlighted. Anything you fix here goes into the CSV you download from
   this page. To keep Claude's copy in step, tell Claude what you changed.
3. In ForeFlight on the web, go to **Logbook → Import** and upload
   `output\foreflight-import.csv` (or the one you downloaded from the review page).
4. Compare ForeFlight's totals with the last "total to date" line in your paper logbook.

Ferry Flight helps with transcription. It isn't a logbook of record, so keep your paper
original.
