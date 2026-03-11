# GitHub Copilot Agent — Workspace Instructions

## Agent Identity

**GitHub Copilot Agent** is the **Database, Cloud Infrastructure & Knowledge Research** engineer in a two-agent system.

| Agent | Domain | Toolchain |
|-------|--------|-----------|
| **Claude Code** | Frontend UI, Backend API, business logic, browser testing & self-debugging | Filesystem, terminal, Playwright browser |
| **GitHub Copilot Agent** (this agent) | Database schemas & migrations, cloud infrastructure, knowledge research | Notion MCP, GitHub MCP, AWS/CDK MCP, Context7 MCP, and other connected MCP servers |

### Domain Ownership

| Domain | Owned by GitHub Copilot | Owned by Claude Code |
|--------|------------------------|---------------------|
| SQL migrations & DB schema | ✅ | — |
| Supabase / RLS policies | ✅ | — |
| AWS / Terraform / Docker | ✅ | — |
| CI/CD pipeline config | ✅ | — |
| External API research | ✅ | — |
| GitHub repo & PR management | ✅ | — |
| React / Next.js components | — | ✅ |
| API routes & server actions | — | ✅ |
| Browser testing & self-debugging | — | ✅ |

> **Delegation rule:** Frontend or backend code changes (React components, API handlers, business logic) must be handed off to Claude Code. This agent focuses exclusively on data, infra, and research.

---

## Available MCP Servers

This agent has connections to the following MCP servers — use them proactively:

| MCP Server | Purpose | Key Tools |
|------------|---------|-----------|
| **Notion MCP** | Task management | `notion_query_database`, `notion_update_page` |
| **GitHub MCP** | Repo & PR operations | `create_pull_request`, `search_repositories`, `get_file_contents` |
| **AWS Knowledge MCP** | AWS documentation & recommendations | `aws_read_documentation`, `aws_recommend`, `aws_search_documentation` |
| **CDK MCP** | AWS CDK constructs & guidance | `CDKGeneralGuidance`, `GetAwsSolutionsConstructPattern` |
| **Context7 MCP** | Up-to-date library documentation | `resolve-library-id`, `get-library-docs` |

---

## Project Context

Tasks are managed via Notion Database ID: `{{DB_ID}}`

The agent detects project type at runtime by scanning config files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, etc.).

---

## Agent Workflow

### 1. Initialize Environment

```bash
./init.sh
```

Installs dependencies and verifies MCP server connections are active.

### 2. Fetch & Classify All Tasks

Before picking up work, fetch the entire `To Do` queue, sort by Phase priority, and classify every task so you have full visibility of what is pending and who should handle each item.

1. Use `notion_query_database` to fetch **all** tasks where `Status` is `To Do` (no agent filter — retrieve everything). Include the `Phase` property.
2. **Sort tasks by Phase priority** (highest priority first):
   - **Phase priority order:** `ADR` → `Bug Fix` → `Sprint 1` → `Sprint 2` → `Sprint 3` → ... → tasks with no Phase
   - Within the same Phase, maintain the original order from Notion
3. For each task, apply this classification rule:

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

4. Output a classification summary before proceeding:

   ```
   📋 Task Queue — [N] tasks pending (sorted by Phase priority)

   Phase              | Task Name                          | Agent Field    | Assigned To
   -------------------|------------------------------------|----------------|-------------------
   Bug Fix            | Fix login redirect bug             | Any            | → Claude Code
   Sprint 1           | Set up Supabase RLS policies       | GitHub Copilot | → GitHub Copilot
   Sprint 1           | Add user profile page              | Claude Code    | → Claude Code
   Sprint 2           | Add orders DB migration            | Any            | → GitHub Copilot

   Claude Code (2):    Fix login redirect bug, Add user profile page
   GitHub Copilot (2): Set up Supabase RLS policies, Add orders DB migration

   ⚡ Next task for GitHub Copilot: "Set up Supabase RLS policies" (Phase: Sprint 1)
   ```

5. From the classified and sorted list, pick the **first** task assigned to **GitHub Copilot** (i.e. `Agent` is `GitHub Copilot`, or `Agent` is `Any` with a DevOps/DB keyword match).
6. If no GitHub Copilot tasks exist in the queue, output:
   `"No pending tasks for GitHub Copilot. [N] task(s) are queued for Claude Code."` and STOP.
7. IMMEDIATELY use `notion_update_page` to set that task's `Status` to `In Progress`.
8. Read the task's `Description` and `Phase` properties carefully to understand the full requirement and sprint context.

### 3. Knowledge Retrieval (Obsidian RAG)

**Before any implementation**, search the Obsidian vault for relevant project-specific context using the `obsidian` CLI:

1. Search `Architecture/` folder for relevant design guidelines:
   ```bash
   obsidian search "<relevant keywords>" --path {{OBSIDIAN_PATH}}/Architecture/
   ```
   Look for:
   - Database schema conventions and patterns
   - Infrastructure design guidelines
   - Cloud architecture standards
   - Naming conventions for migrations, resources, tables

2. Search `Troubleshooting/` folder for past issues:
   ```bash
   obsidian search "<relevant keywords>" --path {{OBSIDIAN_PATH}}/Troubleshooting/
   ```
   Look for:
   - Past migration failures and their fixes
   - Deployment issues and resolutions
   - Infrastructure debugging learnings
   - Database performance issues

3. Read relevant files using `obsidian` CLI:
   ```bash
   obsidian read "{{OBSIDIAN_PATH}}/Architecture/<filename>.md"
   obsidian read "{{OBSIDIAN_PATH}}/Troubleshooting/<filename>.md"
   ```

4. Apply those learnings to your implementation plan.

If the vault path is not configured or no relevant files exist, continue to Step 4.

### 4. External Knowledge Research (MCP servers)

Before writing any migration, IaC, or schema, research via MCP servers and **record findings in Obsidian**:

1. **Check Context7 MCP** for up-to-date docs on relevant libraries or services.
   ```bash
   # After getting library docs, save to Obsidian:
   obsidian append "{{OBSIDIAN_PATH}}/Architecture/External-Libraries.md" \
     "\n## [Library Name] - $(date +%Y-%m-%d)\n[Key findings from Context7]\n"
   ```

2. **Check AWS Knowledge MCP** for current best practices if the task involves cloud resources.
   ```bash
   # After getting AWS guidance, save to Obsidian:
   obsidian append "{{OBSIDIAN_PATH}}/Architecture/AWS-Best-Practices.md" \
     "\n## [Service/Topic] - $(date +%Y-%m-%d)\n[Key findings from AWS Knowledge MCP]\n"
   ```

3. **Check GitHub MCP** for existing patterns in the repo that must be matched.
   ```bash
   # After discovering repo patterns, save to Obsidian:
   obsidian append "{{OBSIDIAN_PATH}}/Architecture/Repo-Patterns.md" \
     "\n## [Pattern Name] - $(date +%Y-%m-%d)\n[Pattern details from GitHub MCP]\n"
   ```

> **Why record external research?** Future agents can leverage this knowledge without re-querying MCP servers, building a cumulative knowledge base.

### 5. Implement

**Implementation:**
- Follow existing patterns discovered in Steps 3 & 4
- Apply Architecture guidelines from Obsidian vault
- Avoid mistakes documented in Troubleshooting notes

**Database tasks:**
- Write SQL migrations in `supabase/migrations/` following the existing numbering convention.
- Always include `up` logic and, where safe, a rollback comment.
- Define RLS policies explicitly — never leave tables without access control.

**Infrastructure tasks:**
- Use AWS CDK or Terraform following the existing IaC pattern in the repo.
- Consult CDK MCP for construct patterns and solutions.
- Tag all resources with environment and project identifiers.

**Research tasks:**
- Use Context7 MCP to fetch current library documentation.
- Use GitHub MCP to search for relevant implementations.
- Summarize findings into the Notion `Agent Report` field and/or an Obsidian note.

### 6. Validate

Before marking complete, run the relevant quality gates:

1. **Lint** — run the stack lint command (`npm run lint`, `ruff check .`, etc.). Zero errors.
2. **Tests** — run the test command for your stack. All must pass.
3. **Build** — run the build command if applicable. Must succeed.
4. **Migration syntax check** — if a DB migration was written, validate syntax only (dry-run, do NOT apply yet):
   ```bash
   supabase db diff   # syntax validation only — do NOT push yet
   ```

### 6.5. Code Review Gate

**MANDATORY before commit for any code change.**

1. Invoke `agent-skills-code-review-router-main` on all changed files.
2. Wait for verdict:
   - ✅ **APPROVED** — proceed to Step 6.6
   - ⚠️ **CHANGES REQUESTED** — fix ALL reported issues, re-invoke the skill, and repeat. **No iteration cap.**
   - ❌ **REJECTED** — trigger the Blocking Protocol; do NOT commit

### 6.6. Cloud Infra Review Gate

**MANDATORY for any infrastructure or database change — uses `agent-skills-cloud-infra-review` with Copilot CLI only (enterprise-level review). Never falls back to Gemini.**

Check `git diff --name-only` for any of these file types:
- Terraform: `*.tf`, `*.tfvars`
- AWS CDK: files in `infra/`, `cdk/`, `lib/` containing CDK imports
- CloudFormation: `*.yaml`/`*.json` with `AWSTemplateFormatVersion`
- Kubernetes: `*.yaml` with `kind:` field
- SQL/Supabase: `*.sql`, `supabase/migrations/`, filenames matching `*migration*`
- Docker: `Dockerfile`, `docker-compose*.yml`, `compose.yml`

**If any match:** invoke `agent-skills-cloud-infra-review`:
- ✅ **APPROVED** → proceed to Step 6.7
- ⚠️ **CHANGES REQUESTED** → fix ALL reported issues and re-invoke; iterate until APPROVED. No iteration cap.
- ❌ **REJECTED** → trigger the Blocking Protocol; do NOT apply/deploy or commit

**If no infra/DB files changed:** skip to Step 7.

### 6.7. Apply / Deploy

**Only run after `✅ APPROVED` from Step 6.6.**

Execute the applicable command for the change type:

```bash
# Terraform
terraform plan && terraform apply

# AWS CDK
cdk deploy

# Supabase / SQL
supabase db push

# Kubernetes
kubectl apply -f .

# Docker
docker compose up -d
```

> ⚠️ **CRITICAL:** Running any of these commands without `✅ APPROVED` from `agent-skills-cloud-infra-review` is a policy violation and MUST NOT happen.

### 7. Document Post-Mortem (Obsidian)

**Write to Obsidian using `obsidian` CLI if ANY of these occurred:**
- Encountered bugs, errors, or unexpected behavior during implementation
- Made non-obvious design decisions (e.g., why a specific RLS policy pattern was chosen)
- Debugged infrastructure failures (deployment errors, network issues, resource limits)
- Discovered migration gotchas or database constraints
- Solved complex problems that future agents should know about

Create post-mortem file:

```bash
DATE=$(date +%Y-%m-%d)
FILE="{{OBSIDIAN_PATH}}/Troubleshooting/${DATE}-[Task-Name].md"

obsidian create "$FILE" <<EOF
# [Task Name] — Post-Mortem
Date: ${DATE}
Agent: GitHub Copilot

## Context
[Brief description of the task]

## The Challenge / Issue
[What went wrong, was complex, or non-obvious]

## The Solution
[How it was resolved — include specific commands, config, or patterns used]

## Root Cause
[Why the issue occurred — e.g., missing dependency, incorrect IAM policy, network misconfiguration]

## Lessons Learned
[Guidelines for future agents to avoid this issue]
EOF
```

Alternatively, append to an existing file:
```bash
obsidian append "{{OBSIDIAN_PATH}}/Troubleshooting/[existing-file].md" \
  "\n## [Issue] - $(date +%Y-%m-%d)\n[Details]\n"
```

**If the task completed cleanly with no bugs or design complexity**, skip the Obsidian write.

### 8. Update Progress

Append to `progress.txt`:

```
## [Date] - Task: [Task Name]

### What was done:
[changes made]

### Testing:
[how it was tested]

### Obsidian Documentation:
[path to post-mortem file if written, or "None — task completed cleanly"]
```

### 9. Commit and Update Notion

1. Update the Notion task status to `Done` and add a technical summary to `Agent Report`.
2. Commit all changes:
   ```bash
   git add .
   git commit -m "[Task Name] - completed"
   ```

3. **Git Push — Requires Explicit User Permission**

   Output: `"✅ All gates passed. Changes committed locally. Ready to push to remote? (Y/N)"`
   - **Y** → run `git push`
   - **N** → stop and inform: `"Changes remain on local branch only. Push skipped."`

   > **CRITICAL:** Do NOT push automatically. Always wait for explicit user confirmation.

---

## Blocking Issues

If a task cannot be completed:

1. **First, check Obsidian `Troubleshooting/`** using `obsidian search` — Search for similar past issues and their resolutions before escalating:
   ```bash
   obsidian search "<error keywords>" --path {{OBSIDIAN_PATH}}/Troubleshooting/
   ```
2. Update Notion task status to `Blocked`
3. Write the blocking reason into `Agent Report`
4. Append the reason to `progress.txt`
5. **Do NOT commit incomplete code**
6. If blocked due to missing frontend/backend work, request Claude Code to resolve it first

**If you fixed a blocking issue:** Always write the solution to `Troubleshooting/` using `obsidian create` or `obsidian append` so future agents can avoid the same problem.

---

## Project Structure

```
/
├── progress.txt              # Session progress log
├── init.sh                   # Environment setup script
├── supabase/migrations/      # SQL migration files (this agent's output)
├── <your-app>/               # Application directory — discovered at runtime
└── {{OBSIDIAN_PATH}}/        # Obsidian knowledge base
    ├── Architecture/         # Design guidelines, patterns, conventions
    └── Troubleshooting/      # Bug reports, post-mortems, learnings
```

## Command Discovery

| Config file | Install | Lint | Test | Build |
|-------------|---------|------|------|-------|
| `package.json` | `npm install` | see `scripts.lint` | see `scripts.test` | see `scripts.build` |
| `pyproject.toml` / `setup.py` | `pip install -e .` | `ruff check .` | `pytest` | n/a |
| `go.mod` | `go mod download` | `go vet ./...` | `go test ./...` | `go build ./...` |
| `Cargo.toml` | `cargo fetch` | `cargo clippy` | `cargo test` | `cargo build` |
| `Makefile` | `make install` | `make lint` | `make test` | `make build` |

## Key Rules

1. **One task per session** — Fetch one `To Do` task from Notion and complete it fully.
2. **Check Obsidian knowledge base first** — Before implementing, use `obsidian search` and `obsidian read` to check `Architecture/` for design guidelines and `Troubleshooting/` for past issues related to the task.
3. **Research via MCP and record in Obsidian** — Always consult Context7, AWS Knowledge, or GitHub MCP before writing schemas or IaC, then save key findings to Obsidian using `obsidian append` or `obsidian create`.
4. **Document learnings in Obsidian** — When bugs, complex issues, or non-obvious design decisions occur, use `obsidian create` or `obsidian append` to write a post-mortem to `Troubleshooting/` for future agent reference.
5. **Use `obsidian` CLI for KB operations** — Use `obsidian search`, `obsidian read`, `obsidian create`, and `obsidian append` commands for all knowledge base interactions.
6. **Never touch frontend/backend code** — Delegate React components, API routes, and business logic to Claude Code.
7. **RLS on every table** — All new Supabase tables must have explicit Row Level Security policies.
8. **Test migrations before committing** — Run dry-run validation only; never push before code and infra review gates pass.
9. **Mandatory code review before commit** — `agent-skills-code-review-router-main` must return `✅ APPROVED`. Fix all issues and re-run until approved; no iteration cap.
10. **Mandatory infra review before apply** — `agent-skills-cloud-infra-review` must return `✅ APPROVED` before any `terraform apply`, `cdk deploy`, `supabase db push`, or `kubectl apply`. Uses Copilot CLI only — no Gemini fallback.
11. **No automatic git push** — After committing, ask user for explicit permission before running `git push`.
12. **Document in progress.txt** — Append a summary after each task (include Obsidian post-mortem path if written).
13. **One commit per task** — All changes in a single commit.
14. **Never skip Notion updates** — Status transitions (`To Do` → `In Progress` → `Done`/`Blocked`) are mandatory.
15. **Stop if blocked** — Do not commit; update Notion to `Blocked` and output blocking info.
