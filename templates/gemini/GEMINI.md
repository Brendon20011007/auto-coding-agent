# Project Context

This workflow runs in a **two-agent system**. Gemini CLI acts as a supplementary task runner, aware of the division of responsibilities between the two primary agents.

## Two-Agent Architecture

| Agent | Domain | Toolchain |
|-------|--------|-----------|
| **Claude Code** | Frontend UI, Backend API, business logic, browser testing & self-debugging | Filesystem, terminal, Playwright browser |
| **GitHub Copilot Agent** | Database schemas & migrations, cloud infrastructure, knowledge research | Notion MCP, GitHub MCP, AWS/CDK MCP, Context7 MCP |

> **Gemini CLI role:** handles general-purpose tasks that don't require deep specialisation in either domain, or acts as a coordinator when both agents need to be sequenced. For DB/infra work, defer to GitHub Copilot Agent. For UI/API work, defer to Claude Code.

This workflow is **stack-agnostic** and works with any language or framework. The agent detects your project type at runtime by scanning config files.

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

### Step 2: Fetch & Classify All Tasks

Before picking up work, fetch the entire `To Do` queue and classify every task so you have full visibility of what is pending and who should handle each item.

1. Use `notion_query_database` to fetch **all** tasks where `Status` is `To Do` (no agent filter — retrieve everything).
2. For each task, apply this classification rule:

   | `Agent` field    | Keyword in name or description | → Assigned to      |
   |------------------|--------------------------------|--------------------|
   | `Claude Code`    | —                              | **Claude Code**    |
   | `GitHub Copilot` | —                              | **GitHub Copilot** |
   | `Any`            | DevOps/DB keyword (see below)  | **GitHub Copilot** |
   | `Any`            | *(no keyword match — default)* | **Claude Code**    |

   **DevOps/DB keywords** (case-insensitive, matched anywhere in task name or description):
   `docker`, `terraform`, `aws`, `kubernetes`, `k8s`, `ci/cd`, `cicd`, `pipeline`,
   `database`, `migration`, `rls`, `supabase`, `cloud`, `s3`, `lambda`, `ecs`,
   `nginx`, `deployment`, `infrastructure`, `helm`, `vpc`, `iam`, `devops`

3. Output a classification summary before proceeding:

   ```
   📋 Task Queue — [N] tasks pending

   Task Name                          | Agent Field    | Assigned To
   -----------------------------------|----------------|-------------------
   Add user profile page              | Claude Code    | → Claude Code
   Set up Supabase RLS policies       | GitHub Copilot | → GitHub Copilot
   Fix login redirect bug             | Any            | → Claude Code
   Add orders DB migration            | Any            | → GitHub Copilot

   Claude Code (2):    Add user profile page, Fix login redirect bug
   GitHub Copilot (2): Set up Supabase RLS policies, Add orders DB migration
   ```

4. From the classified list, pick the **first** task assigned to **Claude Code** (i.e. `Agent` is `Claude Code`, or `Agent` is `Any` with no DevOps/DB keyword match).
5. If no Claude Code tasks exist in the queue, output:
   `"No pending tasks for Claude Code. [N] task(s) are queued for GitHub Copilot."` and STOP.
6. IMMEDIATELY use `notion_update_page` to set that task's `Status` to `In Progress`.
7. Read the task's `Description` property carefully to understand the full requirement.

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
2. **Respect agent boundaries** — Do not write SQL migrations, RLS policies, or cloud IaC (GitHub Copilot's domain). Do not perform browser/Playwright testing (Claude Code's domain).
3. **Test before marking complete** — All steps must pass before updating Notion to `Done`.
4. **Browser testing for UI changes** — Major page changes require browser verification by Claude Code; flag this in `Agent Report` if Gemini cannot invoke Playwright directly.
5. **Document in progress.txt** — Append a summary after each task.
6. **One commit per task** — Code + progress.txt in a single commit.
7. **Never skip Notion updates** — Status transitions (`To Do` → `In Progress` → `Done`/`Blocked`) are mandatory.
8. **Stop if blocked** — Do not commit; update Notion to `Blocked` and output blocking info.
