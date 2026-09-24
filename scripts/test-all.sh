#!/usr/bin/env bash
# Run the tests of every lab and project (or only the given paths).
# Usage: scripts/test-all.sh [labs/<lang>/<name> | projects/<name> ...]
# Exits 1 if any lab fails, 2 if no lab could be tested at all.
set -uo pipefail
cd "$(dirname "$0")/.."

if [ $# -gt 0 ]; then
  labs=("$@")
else
  mapfile -t labs < <({ find labs -mindepth 2 -maxdepth 2 -type d; find projects -mindepth 1 -maxdepth 1 -type d; } 2>/dev/null | sort)
fi

pass=0; fail=0; skip=0; failed=()

for dir in "${labs[@]}"; do
  dir=${dir%/}
  echo "==> $dir"
  scripts/lab.sh test "$dir"
  case $? in
    0) pass=$((pass+1)) ;;
    2) echo "    (skipped: no toolchain or no tests)"; skip=$((skip+1)) ;;
    *) fail=$((fail+1)); failed+=("$dir") ;;
  esac
done

echo
echo "passed: $pass  failed: $fail  skipped: $skip"
[ $fail -eq 0 ] || { printf '  FAILED: %s\n' "${failed[@]}"; exit 1; }
[ $pass -gt 0 ] || exit 2
