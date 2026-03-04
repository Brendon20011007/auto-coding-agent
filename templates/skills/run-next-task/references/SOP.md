# Full SOP Reference — Notion Coding Agent

This document is the complete procedure reference for the `run-next-task` skill.
Loaded on demand when more detail is needed.

---

## Step 1: Initialize Environment & Scan Project

Run `./init.sh` to install dependencies and create Obsidian vault directories.

Scan the project root for config files:

| Config file | Stack | Install | Lint | Test | Build |
|-------------|-------|---------|------|------|-------|
| `package.json` | Node/JS/TS | `npm install` | from `scripts.lint` | from `scripts.test` | from `scripts.build` |
| `pyproject.toml` / `setup.py` / `requirements.txt` | Python | `pip install -e .` or `pip install -r requirements.txt` | `ruff check .` / `flake8` | `pytest` | n/a |
| `go.mod` | Go | `go mod download` | `go vet ./...` | `go test ./...` | `go build ./...` |
| `Cargo.toml` | Rust | `cargo fetch` | `cargo clippy` | `cargo test` | `cargo build` |
| `Makefile` | Any | `make install` | `make lint` | `make test` | `make build` |

Also read `CONTRIBUTING.md`, `.editorconfig`, and any linter config — treat as authoritative.

---

## Step 2: Fetch Task from Notion

1. `notion_query_database` — database ID: `{{DB_ID}}`, filter `Status = To Do`
2. Take the **first** result. If empty, stop with "No pending tasks found."
3. `notion_update_page` — set `Status` to `In Progress`
4. Read `Task Name`, `Description`, and any other properties carefully.

---

## Step 3: Knowledge Retrieval (Obsidian RAG)

Before writing any code, check the Obsidian vault:

1. `Architecture/` — design rules, conventions, approved patterns for this feature area
2. `Troubleshooting/` — past bug reports for the same component or service

Apply any relevant learnings to the implementation plan.

---

## Step 4: Implement & Test

**Implementation:**
- Read existing files in the target area before writing
- Match style, naming, and idioms already in the codebase
- Prefer editing existing files over creating new ones

**Mandatory quality gates (all must pass):**

1. **Lint gate** — zero errors (command from Step 1)
2. **Test gate** — all tests pass (command from Step 1)
3. **Build gate** — compiles/builds with no errors (command from Step 1)
4. **Browser gate** — UI projects only: use Playwright MCP to verify rendering, interactions, and responsive layout

---

## Step 5: Document

**Progress log** — always append to `progress.txt`:

```
## [Date] - Task: [Notion Task Name]

### What was done:
[specific changes made]

### Testing:
[how it was tested]
```

**Obsidian post-mortem** — write ONLY if bugs or non-obvious design decisions occurred.
Use filesystem tools only — **never the `obsidian` CLI**.

File: `{{OBSIDIAN_VAULT}}/Troubleshooting/YYYY-MM-DD-[Task-Name].md`

```markdown
# [Task Name] — Post-Mortem
Date: YYYY-MM-DD

## Context
[Brief description]

## The Bug / Issue
[What went wrong]

## The Fix
[How it was resolved]

## Lessons Learned
[Guidelines for future agents]
```

---

## Step 6: Commit & Update Notion

1. `notion_update_page` → `Status: Done`, write execution summary to `Agent Report`
2. Commit atomically:

```bash
git add .
git commit -m "[Notion Task Name] - completed"
```

---

## Blocking Protocol

If unable to complete (missing secrets, service down, 3 failed retries):

1. `notion_update_page` → `Status: Blocked`
2. Write exact error/blocker to `Agent Report`
3. Append to `progress.txt`
4. Output block message and **stop** — do not commit
