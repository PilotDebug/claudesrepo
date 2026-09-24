#!/usr/bin/env bash
# The one place that knows how to run or test a lab in each language.
# Usage: scripts/lab.sh <run|test> labs/<lang>/<name>
#        scripts/lab.sh test projects/<name>
# Exit codes: the command's own status, or 2 if the lab can't be handled here
# (toolchain missing, or the action doesn't apply — e.g. `run` for a web lab).
set -uo pipefail

action=${1:-}; dir=${2%/}
lang=$(basename "$(dirname "$dir")")
cd "$dir" || exit 2

# A toolchain counts only if it actually runs: on some hosts (e.g. Netlify) `cargo`
# is a rustup shim with no toolchain installed behind it.
need() { local bin=$1; shift; "$bin" "${@:---version}" >/dev/null 2>&1 || exit 2; }

case $lang:$action in
  python:run)  need python3; exec python3 main.py ;;
  python:test) need python3; exec python3 -m unittest discover -q -p 'test_*.py' ;;
  node:run)    need node;    exec node main.js ;;
  node:test)   need node;    exec node --test ;;
  web:test)    need node;    exec node --test ;;
  projects:test)
               need node; compgen -G '*.test.js' >/dev/null || exit 2; exec node --test ;;
  go:run)      need go version; exec go run . ;;
  go:test)     need go version; exec go test ./... ;;
  rust:run)    need cargo;   exec cargo run --quiet ;;
  rust:test)   need cargo;   exec cargo test --quiet ;;
  cpp:run)     need make; need "${CXX:-g++}"; exec make -s run ;;
  cpp:test)    need make; need "${CXX:-g++}"; exec make -s test ;;
  *)           exit 2 ;;
esac
