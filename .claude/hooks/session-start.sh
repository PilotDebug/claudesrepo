#!/usr/bin/env bash
# Prints the sandbox's toolchains at the start of each Claude Code session,
# so Claude knows what it can run without having to probe.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
echo "Sandbox toolchains:"
for cmd in "python3 --version" "node --version" "go version" "cargo --version" "g++ --version"; do
  bin=${cmd%% *}
  if command -v "$bin" >/dev/null; then echo "  $($cmd 2>&1 | head -1)"; else echo "  $bin: not installed"; fi
done
echo "Projects: $(find projects -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)  Labs: $(find labs -mindepth 2 -maxdepth 2 -type d 2>/dev/null | wc -l)  Ideas: $(grep -c '^## ' IDEAS.md 2>/dev/null || echo 0)"
echo "Skills: /prototype /tweak /ship /graduate /idea — see CLAUDE.md"
