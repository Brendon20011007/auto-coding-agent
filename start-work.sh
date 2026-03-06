#!/bin/bash

echo "========================================"
echo "🚀 正在唤醒全自动编程 Agent..."
echo "========================================"

# Ensure helper files exist
touch progress.txt

# Invoke the Task Dispatcher agent.
# The dispatcher fetches ONE task from Notion, classifies it by role:
#   - DevOps/Cloud  → gh copilot suggest + cloud-devops-engineer sub-agent
#   - QA            → test-runner sub-agent
#   - SWE bug       → bug-fixer sub-agent
#   - SWE arch      → tech-lead sub-agent
#   - SWE review    → code-reviewer sub-agent
#   - SWE general   → task-runner sub-agent (default)
# Then it executes the task, updates Notion, commits, and exits.
claude -p "You are the Task Dispatcher. Use the task-dispatcher agent skill to fetch the next 'To Do' task from the Notion database, classify it by engineering role using keyword analysis, and route it to the correct specialist agent (task-runner, bug-fixer, code-reviewer, tech-lead, test-runner, or cloud-devops-engineer). For DevOps/Cloud tasks, also run 'gh copilot suggest' before spawning the cloud-devops-engineer sub-agent. Complete the full workflow: fetch → classify → dispatch → verify → update Notion → commit. Do not ask for permissions, just execute." \
  --dangerously-skip-permissions
