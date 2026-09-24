#!/usr/bin/env bash
# Scaffold a new lab by copying the hello template for a language.
# Usage: scripts/new.sh <python|node|go|rust|cpp|web> <name>
set -euo pipefail
cd "$(dirname "$0")/.."

lang=${1:-}; name=${2:-}
if [ -z "$lang" ] || [ -z "$name" ]; then
  echo "usage: $0 <python|node|go|rust|cpp|web> <name>" >&2; exit 1
fi
[[ $name =~ ^[a-z][a-z0-9_-]*$ ]] || { echo "name must match ^[a-z][a-z0-9_-]*$" >&2; exit 1; }

src=labs/$lang/hello; dst=labs/$lang/$name
[ -d "$src" ] || { echo "unknown language: $lang" >&2; exit 1; }
[ -e "$dst" ] && { echo "$dst already exists" >&2; exit 1; }

cp -r "$src" "$dst"
rm -rf "$dst/target" "$dst/node_modules" "$dst/__pycache__" "$dst/build"

# Rename the package/module so it doesn't clash with the template.
case $lang in
  go)   sed -i "s/^module hello$/module $name/" "$dst/go.mod" ;;
  rust) sed -i "s/^name = \"hello\"$/name = \"${name//-/_}\"/" "$dst/Cargo.toml" ;;
  node|web) sed -i "s/\"name\": \"hello\"/\"name\": \"$name\"/" "$dst/package.json" ;;
esac

# Fresh README: the site uses its heading as the title and first paragraph as the summary.
printf '# %s\n\nTODO: one sentence on what this experiment explores.\n' "$name" > "$dst/README.md"

echo "Created $dst — run: make test LAB=$dst"
