#!/usr/bin/env bash
# start-loop.sh
# Helper script for the run-next-task Agent Skill.
# Launches the autonomous Notion coding loop using whichever AI CLI is available.

set -e

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ -f "./start-work.sh" ]; then
  echo "→ Running start-work.sh (Claude Code loop)"
  bash ./start-work.sh
elif command -v claude &>/dev/null; then
  echo "→ Claude Code detected — starting autonomous loop"
  claude --dangerously-skip-permissions \
    -p "Follow the workflow in CLAUDE.md exactly. Run init.sh, fetch the next To Do task from Notion, implement it, pass all quality gates, commit, and mark Done."
elif command -v gemini &>/dev/null; then
  echo "→ Gemini CLI detected — starting loop"
  echo "Run: gemini (in this directory) — it will follow GEMINI.md automatically"
else
  echo "No AI CLI detected (claude / gemini)."
  echo "Open your AI assistant in this directory and say: 'run the next task'"
fi
