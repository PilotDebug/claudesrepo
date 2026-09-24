#!/usr/bin/env bash
# Run the tests of every lab (or only those under the given paths).
# Usage: scripts/test-all.sh [labs/<lang>/<name> ...]
set -uo pipefail
cd "$(dirname "$0")/.."

if [ $# -gt 0 ]; then
  labs=("$@")
else
  mapfile -t labs < <(find labs -mindepth 2 -maxdepth 2 -type d | sort)
fi

pass=0; fail=0; skip=0; failed=()

run() {
  local dir=$1 lang
  lang=$(basename "$(dirname "$dir")")
  case $lang in
    python) command -v python3 >/dev/null || return 2
            (cd "$dir" && python3 -m unittest discover -q -p 'test_*.py') ;;
    node)   command -v node >/dev/null || return 2
            (cd "$dir" && node --test) ;;
    go)     command -v go >/dev/null || return 2
            (cd "$dir" && go test ./...) ;;
    rust)   command -v cargo >/dev/null || return 2
            (cd "$dir" && cargo test --quiet) ;;
    *)      return 2 ;;
  esac
}

for dir in "${labs[@]}"; do
  dir=${dir%/}
  echo "==> $dir"
  run "$dir"
  case $? in
    0) pass=$((pass+1)) ;;
    2) echo "    (skipped: no toolchain for this lab)"; skip=$((skip+1)) ;;
    *) fail=$((fail+1)); failed+=("$dir") ;;
  esac
done

echo
echo "passed: $pass  failed: $fail  skipped: $skip"
[ $fail -eq 0 ] || { printf '  FAILED: %s\n' "${failed[@]}"; exit 1; }
