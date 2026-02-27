#!/bin/bash

echo "========================================"
echo "🚀 Waking up autonomous coding agent..."
echo "========================================"

# Ensure helper files exist
touch progress.txt

# Invoke Claude with the autonomous agent prompt and skip permission prompts
claude -p "You are an autonomous Software Engineer Agent. Please read CLAUDE.md immediately. Your goal is to fetch ONE 'To Do' task from our Notion database, execute the entire design-code-test-commit workflow flawlessly, update the Notion status, and then exit gracefully. Do not ask for permissions, just execute the SOP." --dangerously-skip-permissions
