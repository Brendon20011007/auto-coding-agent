# Project Context

This workflow is **stack-agnostic** and works with any language or framework. The agent detects your project type at runtime by scanning config files.

> Detailed task requirements are managed dynamically via a Notion Database.

## Notion Integration Context

- **Target Database ID**: {{DB_ID}}
- **Task Statuses**: `To Do`, `In Progress`, `Done`, `Blocked`
- **Target Properties**: `Task Name`, `Status`, `Description`, `Agent Report`

---

# MANDATORY: Agent Workflow

Every new Gemini CLI agent session MUST follow this workflow strictly in order:

### Step 1: Initialize Environment & Scan Project

Run `./init.sh`

This installs dependencies and ensures the Obsidian vault directory structure exists. DO NOT skip this step.

**After `init.sh` completes, scan the project root for config files to determine the stack and available commands:**

| Config file found | Install | Lint | Test | Build |
|-------------------|---------|------|------|-------|
| `package.json` | `npm install` | from `scripts.lint` | from `scripts.test` | from `scripts.build` |
| `pyproject.toml` / `setup.py` | `pip install -e .` | `ruff` / `flake8` | `pytest` | n/a |
| `requirements.txt` | `pip install -r requirements.txt` | `ruff` / `flake8` | `pytest` | n/a |
| `go.mod` | `go mod download` | `go vet ./...` | `go test ./...` | `go build ./...` |
| `Cargo.toml` | `cargo fetch` | `cargo clippy` | `cargo test` | `cargo build` |
| `Makefile` | `make install` | `make lint` | `make test` | `make build` |

Also read `CONTRIBUTING.md` and any linter config files for project style rules.

### Step 2: Fetch Next Task from Notion

1. Use the Notion MCP tool `notion_query_database` to query the Target Database.
2. Filter the query strictly for items where `Status` is `To Do`.
3. Pick the FIRST task in the list. If there are no `To Do` tasks, output "No pending tasks found in Notion. Waiting..." and STOP execution.
4. IMMEDIATELY use `notion_update_page` to change the selected task's `Status` to `In Progress`.
5. Read the `Description` property carefully to understand the requirement.

### Step 3: Implement the Task

- Implement the functionality to satisfy all requirements in the Notion task description.
- Follow existing code patterns and conventions.

### Step 4: Test Thoroughly (MANDATORY)

After implementation, verify ALL steps:

- **Major UI Changes**: Test in the browser. Verify rendering, navigation, and form submissions.
- **Minor Changes**: Validate via unit tests or lint/build.
**Strict Checks (all three gates must pass):**

1. **Lint** — run the lint command discovered in Step 1. Zero errors required.
2. **Tests** — run the test command discovered in Step 1. All tests must pass.
3. **Build** — run the build command discovered in Step 1 (if applicable). Must succeed.
4. **Browser** (UI projects only) — for major visual changes, verify in the browser that rendering and interactions work correctly.

### Step 5: Update Progress

Append to `progress.txt`:

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
├── GEMINI.md          # This workflow file
├── progress.txt       # Progress log
├── init.sh            # Initialization script
└── <your-app>/        # Application directory — discovered at runtime
```

## Command Discovery

Commands are derived from project config files found at runtime — no manual configuration required:

| Config file | Commands used |
|-------------|---------------|
| `package.json` | `scripts.lint`, `scripts.test`, `scripts.build` |
| `pyproject.toml` / `setup.py` | `pytest`, `ruff`/`flake8`, `mypy` |
| `go.mod` | `go vet ./...`, `go test ./...`, `go build ./...` |
| `Cargo.toml` | `cargo clippy`, `cargo test`, `cargo build` |
| `Makefile` | `make lint`, `make test`, `make build` |

## Coding Conventions

- Read existing files in the target area **before** writing new code
- Match the style, naming patterns, and idioms already present in the codebase
- If a `CONTRIBUTING.md`, `.editorconfig`, or linter config exists, treat it as authoritative
- Prefer editing existing files over creating new ones when extending functionality
- Write tests for new behaviour, following whatever test framework is already in use

---

## Key Rules

1. **One task per session** — Fetch one `To Do` task from Notion and complete it fully.
2. **Test before marking complete** — All steps must pass before updating Notion to `Done`.
3. **Browser testing for UI changes** — Major page changes require browser verification.
4. **Document in progress.txt** — Append a summary after each task.
5. **One commit per task** — Code + progress.txt in a single commit.
6. **Never skip Notion updates** — Status transitions (`To Do` → `In Progress` → `Done`/`Blocked`) are mandatory.
7. **Stop if blocked** — Do not commit; update Notion to `Blocked` and output blocking info.
