#!/usr/bin/env bash
# Scaffold a new web prototype from templates/project.
# Usage: scripts/new-project.sh <slug> ["Title"]
set -euo pipefail
cd "$(dirname "$0")/.."

slug=${1:-}; title=${2:-}
[ -n "$slug" ] || { echo "usage: $0 <slug> [\"Title\"]" >&2; exit 1; }
[[ $slug =~ ^[a-z][a-z0-9-]*$ ]] || { echo "slug must match ^[a-z][a-z0-9-]*$" >&2; exit 1; }
dst=projects/$slug
[ -e "$dst" ] && { echo "$dst already exists" >&2; exit 1; }

# Default title: "flight-planner" -> "Flight Planner"
[ -n "$title" ] || title=$(echo "$slug" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)} 1')

cp -r templates/project "$dst"
esc_title=$(printf '%s' "$title" | sed 's/[&/\]/\\&/g')
for f in "$dst"/project.json "$dst"/README.md "$dst"/index.html; do
  sed -i "s/__TITLE__/$esc_title/g; s/__DATE__/$(date +%F)/g" "$f"
done
echo "Created $dst — preview with: make serve, then open http://localhost:8000/#/p/$slug"
