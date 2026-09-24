#!/usr/bin/env bash
# Export a project as a standalone, deployable folder (ready to become its own repo).
# Usage: scripts/graduate.sh <slug> [dest]   (default dest: scratch/graduated/<slug>)
set -euo pipefail
cd "$(dirname "$0")/.."

slug=${1:-}
[ -n "$slug" ] && [ -d "projects/$slug" ] || { echo "usage: $0 <slug> [dest] — no projects/$slug" >&2; exit 1; }
dest=${2:-scratch/graduated/$slug}
[ -e "$dest" ] && { echo "$dest already exists" >&2; exit 1; }

mkdir -p "$(dirname "$dest")"
cp -r "projects/$slug" "$dest"
rm -f "$dest/project.json"

cat > "$dest/netlify.toml" <<'TOML'
[build]
  publish = "."
  command = "node --test"
TOML
cat > "$dest/.gitignore" <<'IGN'
node_modules/
.DS_Store
IGN
mkdir -p "$dest/.github/workflows"
cat > "$dest/.github/workflows/ci.yml" <<'YML'
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: node --test
YML

echo "Exported projects/$slug -> $dest"
echo "Next: create a repo, push $dest to it, connect it to Netlify, then set"
echo "\"stage\": \"graduated\" and \"links\": {\"live\": ..., \"repo\": ...} in projects/$slug/project.json."
