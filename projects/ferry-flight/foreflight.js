// Builds ForeFlight's logbook import file: one CSV holding an Aircraft Table and then a
// Flights Table, in the same layout ForeFlight's own export uses (so it re-imports cleanly).

export const AIRCRAFT_COLUMNS = [
  "AircraftID", "EquipmentType", "TypeCode", "Year", "Make", "Model", "Category", "Class",
  "GearType", "EngineType", "Complex", "TAA", "HighPerformance", "Pressurized",
];

export const FLIGHT_COLUMNS = [
  "Date", "AircraftID", "From", "To", "Route", "TimeOut", "TimeOff", "TimeOn", "TimeIn",
  "OnDuty", "OffDuty", "TotalTime", "PIC", "SIC", "Night", "Solo", "CrossCountry", "NVG",
  "NVG Ops", "Distance", "DayTakeoffs", "DayLandingsFullStop", "NightTakeoffs",
  "NightLandingsFullStop", "AllLandings", "ActualInstrument", "SimulatedInstrument",
  "HobbsStart", "HobbsEnd", "TachStart", "TachEnd", "Holds", "Approach1", "Approach2",
  "Approach3", "Approach4", "Approach5", "Approach6", "DualGiven", "DualReceived",
  "SimulatedFlight", "GroundTraining", "InstructorName", "InstructorComments", "Person1",
  "Person2", "Person3", "Person4", "Person5", "Person6", "FlightReview", "Checkride", "IPC",
  "NVG Proficiency", "FAA6158", "PilotComments",
];

// ForeFlight's enumerations for the aircraft fields the owner picks in the UI.
export const EQUIPMENT_TYPES = ["aircraft", "batd", "aatd", "ftd", "ffs"];
export const CLASSES = {
  airplane_single_engine_land: "ASEL", airplane_multi_engine_land: "AMEL",
  airplane_single_engine_sea: "ASES", airplane_multi_engine_sea: "AMES",
  rotorcraft_helicopter: "Helicopter", glider: "Glider",
};
export const GEAR_TYPES = ["fixed_tricycle", "fixed_tailwheel", "retractable_tricycle", "retractable_tailwheel", "amphibian", "floats", "skids", "skis"];
export const ENGINE_TYPES = ["Piston", "Turboprop", "Turbofan", "Turbojet", "Non-Powered", "Electric"];

const CLASS_FROM_FIELD = {
  asel: "airplane_single_engine_land", amel: "airplane_multi_engine_land",
  ases: "airplane_single_engine_sea", ames: "airplane_multi_engine_sea",
};

// One entry per distinct tail, guessing class from which category/class column held hours.
// `existing` (keyed by tail) keeps whatever the owner already edited.
export function deriveAircraft(rows, existing = {}) {
  const byTail = new Map();
  for (const r of rows) {
    const id = r.tail || (r.sim > 0 && !r.total ? "SIM" : "");
    if (!id) continue;
    const a = byTail.get(id) || { id, models: new Map(), classHours: {}, flights: 0, simOnly: true };
    a.flights++;
    if (r.makeModel) a.models.set(r.makeModel, (a.models.get(r.makeModel) || 0) + 1);
    for (const f of Object.keys(CLASS_FROM_FIELD)) a.classHours[f] = (a.classHours[f] || 0) + (r[f] || 0);
    if (r.total > 0) a.simOnly = false;
    byTail.set(id, a);
  }
  return [...byTail.values()].map((a) => {
    const model = [...a.models.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || "";
    const topClass = Object.entries(a.classHours).sort((x, y) => y[1] - x[1])[0];
    const guess = {
      AircraftID: a.id,
      EquipmentType: a.simOnly ? "aatd" : "aircraft",
      TypeCode: "",
      Year: "",
      Make: "",
      Model: model,
      Category: a.simOnly ? "" : "airplane",
      Class: a.simOnly ? "" : topClass && topClass[1] > 0 ? CLASS_FROM_FIELD[topClass[0]] : "airplane_single_engine_land",
      GearType: "",
      EngineType: a.simOnly ? "" : "Piston",
      Complex: false, TAA: false, HighPerformance: false, Pressurized: false,
    };
    return { ...guess, ...(existing[a.id] || {}), AircraftID: a.id, flights: a.flights };
  });
}

// Pick up events pilots note in remarks, for ForeFlight's boolean columns.
export function remarkFlags(remarks = "") {
  const r = remarks.toLowerCase();
  return {
    FlightReview: /\b(bfr|flight review|61\.56)\b/.test(r),
    Checkride: /\b(check ?ride|practical test|8710)\b/.test(r),
    IPC: /\b(ipc|instrument proficiency)\b/.test(r),
  };
}

const hrs = (n) => (n == null || n === 0 ? "" : String(Math.round(n * 100) / 100));
const cnt = (n) => (n == null || n === 0 ? "" : String(n));

export function toFlightRow(r) {
  const flags = remarkFlags(r.remarks);
  const simOnly = !r.total && r.sim > 0;
  const approaches = r.approaches > 0 ? `${r.approaches};;;${r.to || ""};;` : "";
  const values = {
    Date: r.iso || "",
    AircraftID: r.tail || (simOnly ? "SIM" : ""),
    From: r.from,
    To: r.to,
    Route: r.via,
    TotalTime: hrs(r.total),
    PIC: hrs(r.pic),
    SIC: hrs(r.sic),
    Night: hrs(r.night),
    Solo: hrs(r.solo),
    CrossCountry: hrs(r.xc),
    NightLandingsFullStop: cnt(r.landingsNight),
    AllLandings: cnt(r.landings),
    ActualInstrument: hrs(r.actual),
    SimulatedInstrument: hrs(r.hood),
    Approach1: approaches,
    DualGiven: hrs(r.cfi),
    DualReceived: hrs(r.dual),
    SimulatedFlight: hrs(r.sim),
    InstructorName: r.instructor,
    FlightReview: String(flags.FlightReview),
    Checkride: String(flags.Checkride),
    IPC: String(flags.IPC),
    "NVG Proficiency": "false",
    FAA6158: "false",
    PilotComments: r.remarks,
  };
  return FLIGHT_COLUMNS.map((c) => values[c] ?? "");
}

export function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const line = (cells, width) => [...cells, ...Array(Math.max(0, width - cells.length)).fill("")].map(csvCell).join(",");

// The complete import file. `aircraft` are objects keyed by AIRCRAFT_COLUMNS; `rows` normalized.
export function buildForeFlightCsv(aircraft, rows) {
  const aw = AIRCRAFT_COLUMNS.length;
  const fw = FLIGHT_COLUMNS.length;
  const out = [
    line(["ForeFlight Logbook Import"], aw),
    line([], aw),
    line(["Aircraft Table"], aw),
    line(AIRCRAFT_COLUMNS, aw),
    ...aircraft.map((a) => line(AIRCRAFT_COLUMNS.map((c) => (typeof a[c] === "boolean" ? String(a[c]) : a[c] ?? "")), aw)),
    line([], aw),
    line(["Flights Table"], fw),
    line(FLIGHT_COLUMNS, fw),
    ...[...rows].sort((a, b) => (a.iso || "").localeCompare(b.iso || "")).map((r) => line(toFlightRow(r), fw)),
  ];
  return out.join("\r\n") + "\r\n";
}
