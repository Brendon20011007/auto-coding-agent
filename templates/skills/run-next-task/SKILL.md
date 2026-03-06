---
name: run-next-task
description: Runs the autonomous Notion coding loop — fetches the next To Do task from
  the Notion database, implements it following the SOP (init → fetch task → Obsidian RAG
  → implement → lint/test/build gates → commit → mark Done). Use when the user says things
  like "start working", "run the next task", "pick up a task from Notion", "work on the
  backlog", "execute the agent loop", "do the next Notion task", or "start the coding agent".
allowed-tools: Bash
---

# run-next-task

You are executing the autonomous Notion coding loop. Follow the 6-step SOP below
**precisely and in order**. Do not skip any step.

For the complete procedure, see [references/SOP.md](references/SOP.md).

---

## Quick Reference

### Step 1 — Initialize

Run `./init.sh` if it exists. This installs dependencies and creates Obsidian vault
directories.

Then scan the project root for config files to detect the stack:

| File found | Stack | Install command |
|------------|-------|-----------------|
| `package.json` | Node/JS/TS | `npm install` |
| `pyproject.toml` / `requirements.txt` | Python | `pip install -e .` / `pip install -r requirements.txt` |
| `go.mod` | Go | `go mod download` |
| `Cargo.toml` | Rust | `cargo fetch` |
| `Makefile` | Any | `make install` (if target exists) |

### Step 2 — Fetch Task from Notion

Query the Notion database (ID: `{{DB_ID}}`) using the `notion_query_database` MCP tool.

Filter for **both** of the following conditions:
1. `Status = To Do`
2. `Agent = [your agent identity]` **OR** `Agent = Any`

Your agent identity is defined in your primary instruction file (`CLAUDE.md` → `Claude Code`, `.github/copilot-instructions.md` → `GitHub Copilot`). Only pick up tasks assigned to you or to `Any`.

Take the **first** matching result. If none match, say "No pending tasks for this agent in Notion." and stop.

Immediately call `notion_update_page` to set `Status` to `In Progress`.

### Step 3 — Knowledge Retrieval

Before writing code, read the Obsidian vault:
- `Architecture/` — design rules and conventions (use `find` or `ls` to discover files)
- `Troubleshooting/` — past bug learnings for the same feature area

Apply anything relevant to your implementation plan.

### Step 4 — Implement & Test

Implement the task. Then pass all quality gates — **all must have zero errors**:

1. **Lint gate** — use the command from Step 1 (e.g. `npm run lint`, `ruff check .`, `go vet ./...`)
2. **Test gate** — e.g. `npm test`, `pytest`, `go test ./...`, `cargo test`
3. **Build gate** — e.g. `npm run build`, `go build ./...`, `cargo build`
4. **Browser gate** — for UI changes, use Playwright MCP to verify rendering and interactions

### Step 5 — Document

Append to `progress.txt`:

```
## [Date] - Task: [Notion Task Name]

### What was done:
[specific changes made]

### Testing:
[how it was tested]
```

If bugs or non-obvious decisions occurred, write a post-mortem using **filesystem tools only** (never the `obsidian` CLI) to:
`{{OBSIDIAN_VAULT}}/Troubleshooting/YYYY-MM-DD-[Task-Name].md`

### Step 6 — Commit & Update Notion

1. `notion_update_page` → `Status: Done`, write execution summary to `Agent Report`
2. `git add . && git commit -m "[Task Name] - completed"`

---

## Blocking Protocol

If you cannot complete the task (missing API keys, 3 failed fix attempts, service down):

1. `notion_update_page` → `Status: Blocked`
2. Write the exact error to `Agent Report`
3. Append to `progress.txt`
4. Stop — do **not** commit

---

## Running via script

If `start-work.sh` exists, you may run it directly:

```bash
bash ./start-work.sh
```

Or use the bundled helper:

```bash
bash .github/skills/run-next-task/scripts/start-loop.sh
```
