---
name: dispatch-agent-tasks
description: >
  Multi-agent task dispatcher — fetches the next To Do task from the Notion database,
  classifies it by domain (SWE/Frontend/Backend/QA → Claude Code via `claude -p`;
  DevOps/Cloud/DB/Infrastructure → GitHub Copilot via `copilot -p`), dispatches to
  the correct CLI agent, and updates Notion. Use when the user says "dispatch the next
  agent task", "route the next task", "dispatch tasks", or "run the dispatcher".
allowed-tools: Bash
---

# dispatch-agent-tasks

You are the **multi-agent task dispatcher**. Your job is to fetch the next pending
task from Notion, classify it by domain, and dispatch it to the correct CLI agent:

| Domain | CLI Agent | Command |
|--------|-----------|---------|
| Software Engineering, Frontend, Backend, QA | **Claude Code CLI** | `claude --dangerously-skip-permissions -p "..."` |
| DevOps, Cloud, Database, Infrastructure | **GitHub Copilot CLI** | `copilot -p "..."` |

Follow this workflow precisely.

---

## Workflow

### Step 1 — Fetch Next Task

Query the Notion database (`{{DB_ID}}`):
- Filter: `Status = To Do`
- Sort by created time ascending (oldest first)
- Pick the **first** result

If no tasks are found, output: `"No pending tasks found. Dispatcher exiting."` and STOP.

Read these fields from the task:
- `Task Name` (title)
- `Agent` (select: `Claude Code`, `GitHub Copilot`, or `Any`)
- `Description` (rich_text)
- Page ID (internal Notion ID)

### Step 2 — Classify the Task

Apply the routing table in order:

| Condition | → Route to |
|-----------|-----------|
| `Agent = Claude Code` | Claude Code CLI |
| `Agent = GitHub Copilot` | GitHub Copilot CLI |
| `Agent = Any` + DevOps keyword in name/description | GitHub Copilot CLI |
| `Agent = Any` + no keyword match (default) | Claude Code CLI |

**DevOps keywords** (case-insensitive, match anywhere in name or description):
`docker`, `terraform`, `aws`, `kubernetes`, `k8s`, `ci/cd`, `cicd`, `pipeline`,
`database`, `migration`, `rls`, `supabase`, `cloud`, `s3`, `lambda`, `ecs`,
`nginx`, `deployment`, `infrastructure`, `helm`, `vpc`, `iam`, `devops`

See `.github/skills/dispatch-agent-tasks/references/routing-rules.md` for the full
reference table.

### Step 3 — Mark In Progress

Use `notion_update_page` to set the task `Status` to `In Progress`.

### Step 4 — Dispatch

Run:

```bash
bash .github/skills/dispatch-agent-tasks/scripts/dispatch.sh \
  "<task_name>" \
  "<notion_page_id>" \
  "<task_description>" \
  "<claude|copilot>"
```

Arguments:
- `$1` — Task Name (from Notion `Task Name` field)
- `$2` — Notion Page ID
- `$3` — Description (from Notion `Description` field)
- `$4` — Resolved agent: either `claude` or `copilot`

### Step 5 — Update Notion

**If `dispatch.sh` exits with code 0 (success):**
- Use `notion_update_page` → Status: `Done`
- Set `Agent Report`: `"Dispatched to [claude|copilot] CLI — task completed successfully."`

**If `dispatch.sh` exits with a non-zero code (failure):**
- Use `notion_update_page` → Status: `Blocked`
- Set `Agent Report` to the error message printed by `dispatch.sh`
- Append to `progress.txt`:
  ```
  ## [Date] — BLOCKED: [Task Name]
  Reason: dispatch.sh exited non-zero — [error output]
  ```
- STOP — do not retry

---

## Blocking Protocol

Triggers:
- `claude` or `copilot` CLI not installed on the system
- Notion database is unreachable
- `dispatch.sh` exits non-zero after a task was already set to In Progress

Actions:
1. `notion_update_page` → Status: `Blocked`
2. Write the exact error into `Agent Report`
3. Append to `progress.txt`
4. Output the blocking reason to the terminal
5. STOP — do not commit code
