// Two made-up pages of a student pilot's logbook, in the shape the vision model returns, so
// the review and export steps can be tried without an API key. Page 2 hides a misread (a 1.8
// read as 1.3) that its "totals this page" line catches.

const row = (o) => ({
  date: "", makeModel: "", tail: "", from: "", to: "", via: "", remarks: "", instructor: "",
  approaches: "", landingsDay: "", landingsNight: "", landings: "", total: "", pic: "", sic: "",
  dual: "", cfi: "", solo: "", xc: "", night: "", actual: "", hood: "", sim: "",
  asel: "", amel: "", ases: "", ames: "", uncertain: [], ...o,
});

export const SAMPLE_PAGES = [
  {
    name: "Sample page 1",
    extraction: {
      yearHint: "2019",
      notes: "Sample data — not a real logbook.",
      rows: [
        row({ date: "3/2/19", makeModel: "C-172S", tail: "N123AB", from: "KPAO", to: "KPAO", remarks: "Intro flight, straight & level", instructor: "J. Instructor", landingsDay: "1", total: "1.0", dual: "1.0", asel: "1.0" }),
        row({ date: "9", makeModel: '"', tail: '"', from: '"', to: '"', remarks: "Slow flight, stalls", instructor: "J. Instructor", landingsDay: "1", total: "1.2", dual: "1.2", asel: "1.2" }),
        row({ date: "16", makeModel: '"', tail: "N456CD", from: "KPAO", to: "KPAO", remarks: "Steep turns, ground ref", instructor: "J. Instructor", landingsDay: "1", total: "1.3", dual: "1.3", hood: "0.3", asel: "1.3" }),
        row({ date: "23", makeModel: '"', tail: '"', from: '"', to: '"', remarks: "Pattern work", instructor: "J. Instructor", landingsDay: "8", total: "1.1", dual: "1.1", asel: "1.1" }),
        row({ date: "4/6", makeModel: '"', tail: "N123AB", from: "KPAO", to: "KPAO", remarks: "Pattern, emergencies", instructor: "J. Instructor", landingsDay: "7", total: "1.2", dual: "1.2", asel: "1.2" }),
        row({ date: "13", makeModel: '"', tail: '"', from: '"', to: '"', remarks: "1st SOLO! 3 T/Os & ldgs", landingsDay: "3", total: "0.6", pic: "0.6", solo: "0.6", asel: "0.6" }),
        row({ date: "20", makeModel: '"', tail: '"', from: "KPAO", to: "KLVK", via: "KHWD", remarks: "Towered airports", instructor: "J. Instructor", landingsDay: "3", total: "1.5", dual: "1.5", asel: "1.5", uncertain: ["via"] }),
      ],
      pageTotals: { total: "7.9", dual: "7.3", pic: "0.6", solo: "0.6", hood: "0.3", asel: "7.9", landingsDay: "24" },
    },
  },
  {
    name: "Sample page 2",
    extraction: {
      yearHint: "",
      notes: "Sample data — not a real logbook.",
      rows: [
        row({ date: "5/4", makeModel: "C-172S", tail: "N123AB", from: "KPAO", to: "KSNS", remarks: "Dual XC", instructor: "J. Instructor", landingsDay: "2", total: "1.3", dual: "1.3", xc: "1.3", asel: "1.3", uncertain: ["total"] }),
        row({ date: "18", makeModel: '"', tail: '"', from: "KPAO", to: "KPAO", remarks: "Night — pattern + local", instructor: "J. Instructor", landingsNight: "10", total: "1.4", dual: "1.4", night: "1.4", asel: "1.4" }),
        row({ date: "6/1", makeModel: '"', tail: '"', from: "KPAO", to: "KMRY", via: "KSNS", remarks: "Solo XC", landingsDay: "3", total: "2.4", pic: "2.4", solo: "2.4", xc: "2.4", asel: "2.4" }),
        row({ date: "15", makeModel: '"', tail: "N456CD", from: "KPAO", to: "KPAO", remarks: "Hood work, unusual attitudes", instructor: "J. Instructor", landingsDay: "1", total: "1.2", dual: "1.2", hood: "1.0", asel: "1.2" }),
        row({ date: "30", makeModel: "Redbird TD", tail: "", remarks: "ATD — VOR tracking", instructor: "J. Instructor", sim: "1.0", hood: "1.0", dual: "1.0" }),
        row({ date: "7/20", makeModel: "C-172S", tail: "N123AB", from: "KPAO", to: "KPAO", remarks: "PPL checkride — passed!", landingsDay: "4", total: "1.6", pic: "1.6", asel: "1.6" }),
      ],
      pageTotals: { total: "8.4", dual: "5.4", pic: "4.0", solo: "2.4", xc: "4.2", night: "1.4", hood: "2.0", sim: "1.0", asel: "8.4", landingsDay: "10", landingsNight: "10" },
    },
  },
];
