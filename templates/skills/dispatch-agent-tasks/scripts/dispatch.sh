#!/usr/bin/env bash
# dispatch.sh — routes a Notion task to the correct AI CLI agent
#
# Usage:
#   bash dispatch.sh "<task_name>" "<page_id>" "<description>" "<claude|copilot>"
#
# Exit codes:
#   0  — agent CLI completed successfully
#   1  — CLI not found, bad arguments, or agent invocation failed

set -euo pipefail

TASK_NAME="${1:-}"
PAGE_ID="${2:-}"
DESCRIPTION="${3:-}"
AGENT="${4:-claude}"

# ── Validate arguments ────────────────────────────────────────────────────────

if [[ -z "$TASK_NAME" || -z "$PAGE_ID" || -z "$DESCRIPTION" ]]; then
  echo "ERROR: dispatch.sh requires 4 arguments: task_name, page_id, description, agent" >&2
  echo "Usage: bash dispatch.sh \"<task_name>\" \"<page_id>\" \"<description>\" \"<claude|copilot>\"" >&2
  exit 1
fi

if [[ "$AGENT" != "claude" && "$AGENT" != "copilot" ]]; then
  echo "ERROR: Unknown agent '${AGENT}'. Must be 'claude' or 'copilot'." >&2
  exit 1
fi

# ── Build the injected prompt ─────────────────────────────────────────────────

PROMPT="TASK_CONTEXT: name=${TASK_NAME} | id=${PAGE_ID} | description=${DESCRIPTION}

You are operating in headless dispatch mode. Follow your agent instructions file
exactly with these rules:
- The task is ALREADY set to In Progress in Notion (page id: ${PAGE_ID})
- SKIP the Notion query / fetch step — use the injected name, id, and description above
- At the end, call notion_update_page with id=${PAGE_ID} to mark the task Done or Blocked
- All other steps (init, implement, lint/test/build gates, commit) are MANDATORY as usual"

# ── Route to Claude Code CLI ──────────────────────────────────────────────────

if [[ "$AGENT" == "claude" ]]; then
  if ! command -v claude &>/dev/null; then
    echo "ERROR: 'claude' CLI not found." >&2
    echo "Install Claude Code: https://claude.ai/code" >&2
    exit 1
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "→ Agent:  Claude Code CLI"
  echo "→ Task:   ${TASK_NAME}"
  echo "→ ID:     ${PAGE_ID}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  claude --dangerously-skip-permissions -p "$PROMPT"
  exit $?
fi

# ── Route to GitHub Copilot CLI ───────────────────────────────────────────────

if [[ "$AGENT" == "copilot" ]]; then
  if ! command -v copilot &>/dev/null; then
    echo "ERROR: 'copilot' CLI not found." >&2
    echo "Install it: npm install -g @github/copilot-cli" >&2
    exit 1
  fi

  OUTPUT_FILE="copilot-output.md"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "→ Agent:  GitHub Copilot CLI"
  echo "→ Task:   ${TASK_NAME}"
  echo "→ ID:     ${PAGE_ID}"
  echo "→ Output: ${OUTPUT_FILE}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  copilot -p "$PROMPT" | tee "$OUTPUT_FILE"
  exit ${PIPESTATUS[0]}
fi
