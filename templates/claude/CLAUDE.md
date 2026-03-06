# Role & Architecture Context

## Agent Identity

This agent operates a **dual-system architecture**:

| System | Role | Tool |
|--------|------|------|
| **The PM** (Task Management) | Notion Database | Notion MCP (`notion_query_database`, `notion_update_page`) |
| **The Brain** (Knowledge Base) | Local Obsidian Vault | Standard filesystem reads/writes |

Use Notion **strictly** for fetching tasks and updating their status. Use the Obsidian vault for reading architecture guidelines and past troubleshooting learnings before writing code, and for writing post-mortems after fixing bugs.

## Environment Variables

| Variable | Value |
|----------|-------|
| **Notion Database ID** | {{DB_ID}} |
| **Obsidian Vault Path** | {{OBSIDIAN_VAULT}} |
| Task Statuses | `To Do`, `In Progress`, `Done`, `Blocked` |
| Target Properties | `Task Name`, `Status`, `Description`, `Agent Report` |

---

# Project Context

This workflow is **stack-agnostic** and works with any language or framework. The agent detects your project type at runtime by scanning config files — no manual configuration needed.

> Detailed task requirements are managed dynamically via the Notion Database above.

---

# MANDATORY: Agent Workflow

Every new agent session MUST follow this workflow strictly in order:

### Step 1: Initialize Environment & Scan Project

Run `./init.sh`

This installs dependencies and ensures the Obsidian vault directory structure exists. DO NOT skip this step.

**After `init.sh` completes, scan the project root for config files to determine the stack and available commands:**

| Config file found | Stack | Install | Lint | Test | Build |
|-------------------|-------|---------|------|------|-------|
| `package.json` | Node/JS/TS | `npm install` | from `scripts.lint` | from `scripts.test` | from `scripts.build` |
| `pyproject.toml` / `setup.py` / `requirements.txt` | Python | `pip install -e .` or `pip install -r requirements.txt` | `ruff check .` / `flake8` | `pytest` | n/a |
| `go.mod` | Go | `go mod download` | `go vet ./...` | `go test ./...` | `go build ./...` |
| `Cargo.toml` | Rust | `cargo fetch` | `cargo clippy` | `cargo test` | `cargo build` |
| `Makefile` | Any | `make install` (if target exists) | `make lint` | `make test` | `make build` |

Also read `CONTRIBUTING.md`, `.editorconfig`, and any linter config files (`.eslintrc`, `pyproject.toml [tool.ruff]`, etc.) — treat them as authoritative for style rules.

If no recognised config is found, ask the agent task description or README for guidance.

### Step 2: Fetch Task from Notion

This agent is **Claude Code**. Only pick up tasks assigned to this agent.

1. Use the Notion MCP tool `notion_query_database` to query the Target Database.
2. Filter the query for items where **both** conditions are true:
   - `Status` is `To Do`
   - `Agent` is `Claude Code` **OR** `Agent` is `Any`
3. Pick the FIRST matching task. If there are no matching tasks, output "No pending tasks for Claude Code in Notion. Waiting..." and STOP execution.
4. IMMEDIATELY use `notion_update_page` to change the selected task's `Status` to `In Progress`.
5. Read the `Description` property carefully to understand the requirement.

> If a task's `Agent` is `GitHub Copilot`, **skip it** — that task belongs to GitHub Copilot Agent.

### Headless Task Injection (Dispatcher Mode)

If this session was launched by the `dispatch-agent-tasks` dispatcher, the prompt
will contain a `TASK_CONTEXT:` block. When that is detected:

1. **Skip** the `notion_query_database` call entirely.
2. Parse the injected values:
   ```
   TASK_CONTEXT: name=<task_name> | id=<page_id> | description=<description>
   ```
3. Use `name`, `id`, and `description` as the task to work on.
4. At the end of the session, call `notion_update_page` using the injected `id`
   to mark the task `Done` or `Blocked` — **do not skip this step**.

All other steps (Step 1 init, Step 3 knowledge retrieval, Step 4 implement & test,
Step 5 document, Step 6 commit) remain MANDATORY.

### Step 3: Knowledge Retrieval (Obsidian RAG)

**Before writing any code**, search the Obsidian vault for relevant context:

1. Search `{{OBSIDIAN_VAULT}}/Architecture/` for design rules and conventions related to the current task's feature area.
2. Search `{{OBSIDIAN_VAULT}}/Troubleshooting/` for past bug reports related to the same feature or component.
3. Read any relevant files found and apply those learnings to your implementation plan.

If the vault path is not configured or no relevant files exist, continue to Step 4.

### Step 4: Implement & Test

**Implementation:**
- Implement the functionality to satisfy all requirements in the Notion task description.
- Follow existing code patterns, conventions, and any Architecture notes retrieved in Step 3.

**Testing (MANDATORY — all three gates must pass):**

1. **Lint gate** — run the lint command discovered in Step 1. Zero errors required.
2. **Test gate** — run the test command discovered in Step 1. All tests must pass.
3. **Build gate** — run the build command discovered in Step 1 (if applicable). Must succeed with no errors.
4. **Browser gate** (UI projects only) — for major visual changes, verify rendering, clicks, and form submissions using the MCP Playwright tool.

If the project has no explicit test command, validate with a lint + build check at minimum.

### Step 5: Document Post-Mortem (Obsidian) & Update Progress

**Obsidian Post-Mortem** (only if bugs or non-obvious design decisions were encountered):

> **CRITICAL:** Do NOT use the `obsidian` CLI command. It has known GUI pop-up bugs and silent failures in headless environments. Use standard filesystem file-writing tools only.

Write to: `{{OBSIDIAN_VAULT}}/Troubleshooting/YYYY-MM-DD-[Task-Name].md`

```markdown
# [Task Name] — Post-Mortem
Date: YYYY-MM-DD

## Context
[Brief description of the task]

## The Bug / Issue
[What went wrong or was unexpectedly complex]

## The Fix
[How it was resolved]

## Lessons Learned
[Guidelines for future agents to avoid this issue]
```

If the task completed cleanly with no bugs, skip the Obsidian write.

**Progress Log** — always append to `progress.txt`:

```
## [Date] - Task: [Notion Task Name]

### What was done:
[specific changes made]

### Testing:
[how it was tested]
```

### Step 6: Commit Changes & Update Notion

IMPORTANT: All code changes MUST be committed, and Notion MUST be updated atomically!

1. **Update Notion**: Use `notion_update_page` to change the task `Status` to `Done`. Add a brief execution summary to the `Agent Report` property.
2. **Commit Local Changes**:
   ```bash
   git add .
   git commit -m "[Notion Task Name] - completed"
   ```

---

## ⚠️ Blocking Issues & Fallback

If a task cannot be completed, YOU MUST STOP AND ASK FOR HUMAN INTERVENTION:

**Triggers for Blocking:**
- Missing `.env` variables or API keys.
- Third-party service downtime.
- Complex bugs failing after 3 retries.

**Blocking Protocol (DO NOT COMMIT CODE):**
1. Use `notion_update_page` to change task `Status` to `Blocked`.
2. Write the exact error or missing requirement into the `Agent Report` property in Notion.
3. Append the blocking reason to `progress.txt`.
4. Output the blocking message to the terminal and STOP execution.

---

## Project Structure

```
/
├── CLAUDE.md          # This workflow file
├── start-work.sh      # Agent trigger script
├── progress.txt       # Session progress log
├── init.sh            # Environment initialization
└── <your-app>/        # Application directory — discovered at runtime
```

The application directory and its structure are discovered at runtime by scanning for config files (see Step 1). The agent does not assume a specific layout.

## Command Discovery

| Config file | Commands used |
|-------------|---------------|
| `package.json` | `scripts.lint`, `scripts.test`, `scripts.build`, `scripts.dev` |
| `pyproject.toml` / `setup.py` | `pytest`, `ruff`/`flake8`, `mypy` |
| `go.mod` | `go vet ./...`, `go test ./...`, `go build ./...` |
| `Cargo.toml` | `cargo clippy`, `cargo test`, `cargo build` |
| `Makefile` | `make lint`, `make test`, `make build` |

The agent reads these files at the start of every session and uses the commands it finds. No manual configuration is needed.

## Coding Conventions

- Read existing files in the target area **before** writing new code
- Match the style, naming patterns, and idioms already present in the codebase
- If a `CONTRIBUTING.md`, `.editorconfig`, or linter config exists, treat it as authoritative
- Prefer editing existing files over creating new ones when extending functionality
- Write tests for new behaviour, following whatever test framework is already in use

---

## Key Rules

1. **One task per session** — Fetch one `To Do` task from Notion and complete it fully.
2. **Knowledge first** — Always search Obsidian (Architecture/ + Troubleshooting/) before writing code.
3. **Test before marking complete** — All checks must pass before updating Notion to `Done`.
4. **Browser testing for UI changes** — Major page changes require Playwright browser verification.
5. **Document bugs in Obsidian** — Any bug or design surprise gets a post-mortem in `Troubleshooting/`.
6. **Never use `obsidian` CLI** — Write Obsidian files with native filesystem tools only.
7. **Document in progress.txt** — Append a summary after each task.
8. **One commit per task** — Code + progress.txt in a single commit.
9. **Never skip Notion updates** — Status transitions (`To Do` → `In Progress` → `Done`/`Blocked`) are mandatory.
10. **Stop if blocked** — Do not commit; update Notion to `Blocked` and output blocking info.
11. **Headless mode** — When invoked with `TASK_CONTEXT:`, skip Notion fetch and use the injected `name`, `id`, and `description` directly. Still update Notion at the end.
