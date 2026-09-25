// Parses IDEAS.md. Each "## " heading is an idea; the paragraph under it is the pitch;
// "Key: value" lines for known keys add structure. Everything before the first "## "
// is an intro and ignored.

export const STATUSES = ["raw", "shaped", "exists", "building"];

const FIELDS = {
  "status": "status",
  "category": "category",
  "prior art": "priorArt",
  "angle": "angle",
  "first slice": "firstSlice",
  "project": "project",
  "tags": "tags",
};
const FIELD_LINE = new RegExp(`^(${Object.keys(FIELDS).join("|")}):\\s*(.*)$`, "i");

export function parseIdeas(markdown) {
  return markdown.split(/^## /m).slice(1).map((chunk) => {
    const [heading, ...lines] = chunk.split("\n");
    const idea = {
      title: heading.trim(), pitch: "", status: "raw", category: "Uncategorised",
      priorArt: "", angle: "", firstSlice: "", project: "", tags: [],
    };
    const pitch = [];
    for (const line of lines) {
      const m = line.trim().match(FIELD_LINE);
      if (!m) { pitch.push(line); continue; }
      const key = FIELDS[m[1].toLowerCase()];
      const value = m[2].trim();
      if (key === "tags") idea.tags = value.split(",").map((t) => t.trim()).filter(Boolean);
      else if (key === "status") idea.status = STATUSES.includes(value.toLowerCase()) ? value.toLowerCase() : "raw";
      else idea[key] = value;
    }
    idea.pitch = pitch.join("\n").trim().replace(/\s*\n\s*/g, " ");
    return idea;
  });
}
