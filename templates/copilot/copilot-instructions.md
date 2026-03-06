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

### 2. Find Your Task

This agent is **GitHub Copilot**. Only pick up tasks assigned to this agent.

Query Notion for tasks matching **both** conditions:
- `Status = To Do`
- `Agent = GitHub Copilot` **OR** `Agent = Any`

Pick the first matching item, update its `Status` to `In Progress` immediately, and read the `Description` field carefully.

> If a task's `Agent` is `Claude Code`, **skip it** — that task belongs to Claude Code.

### 3. Knowledge Research (before any implementation)

Before writing any migration, IaC, or schema:

1. **Check Context7 MCP** for up-to-date docs on relevant libraries or services.
2. **Check AWS Knowledge MCP** for current best practices if the task involves cloud resources.
3. **Check GitHub MCP** for existing patterns in the repo that must be matched.

### 4. Implement

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

### 5. Validate

Before marking complete, run the relevant quality gates:

1. **Lint** — run the stack lint command (`npm run lint`, `ruff check .`, etc.). Zero errors.
2. **Tests** — run the test command for your stack. All must pass.
3. **Build** — run the build command if applicable. Must succeed.
4. **Migration validation** — if a DB migration was written, confirm it applies cleanly:
   ```bash
   supabase db push   # or equivalent migration runner
   ```

### 6. Update Progress

Append to `progress.txt`:

```
## [Date] - Task: [Task Name]

### What was done:
[changes made]

### Testing:
[how it was tested]
```

### 7. Commit and Update Notion

1. Update the Notion task status to `Done` and add a technical summary to `Agent Report`.
2. Commit all changes:
   ```bash
   git add .
   git commit -m "[Task Name] - completed"
   ```

---

## Blocking Issues

If a task cannot be completed:

1. Update Notion task status to `Blocked`
2. Write the blocking reason into `Agent Report`
3. Append the reason to `progress.txt`
4. **Do NOT commit incomplete code**
5. If blocked due to missing frontend/backend work, request Claude Code to resolve it first

---

## Project Structure

```
/
├── progress.txt              # Session progress log
├── init.sh                   # Environment setup script
├── supabase/migrations/      # SQL migration files (this agent's output)
└── <your-app>/               # Application directory — discovered at runtime
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
2. **Research before implementing** — Always consult Context7, AWS Knowledge, or GitHub MCP before writing schemas or IaC.
3. **Never touch frontend/backend code** — Delegate React components, API routes, and business logic to Claude Code.
4. **RLS on every table** — All new Supabase tables must have explicit Row Level Security policies.
5. **Test migrations before committing** — Run migrations against a local/test environment first.
6. **Document in progress.txt** — Append a summary after each task.
7. **One commit per task** — All changes in a single commit.
8. **Never skip Notion updates** — Status transitions (`To Do` → `In Progress` → `Done`/`Blocked`) are mandatory.
9. **Stop if blocked** — Do not commit; update Notion to `Blocked` and output blocking info.
10. **Headless mode** — When invoked with `TASK_CONTEXT:`, skip Notion fetch and use the injected `name`, `id`, and `description` directly. Still update Notion at the end using the injected page ID.

---

## Orchestrator Mode (`dispatch-agent-tasks` skill)

When the `dispatch-agent-tasks` VS Code Agent Skill is triggered (say "dispatch the
next agent task" in Copilot Chat), this agent acts as the **dispatcher**:

### Routing Logic

| `Agent` field | Keyword match in name/description | → CLI invoked |
|---|---|---|
| `Claude Code` | — | `claude --dangerously-skip-permissions -p "TASK_CONTEXT: ..."` |
| `GitHub Copilot` | — | `copilot -p "TASK_CONTEXT: ..."` |
| `Any` | docker, terraform, aws, kubernetes, k8s, ci/cd, cicd, pipeline, database, migration, rls, supabase, cloud, s3, lambda, ecs, nginx, deployment, infrastructure, helm, vpc, iam, devops | `copilot -p "TASK_CONTEXT: ..."` |
| `Any` | *(no match — default)* | `claude --dangerously-skip-permissions -p "TASK_CONTEXT: ..."` |

### Dispatch Workflow

1. `notion_query_database` → Status=`To Do`, take first task
2. Read `Agent` field + description → apply routing table above
3. `notion_update_page` → Status: `In Progress`
4. Run `dispatch.sh`:
   ```bash
   bash .github/skills/dispatch-agent-tasks/scripts/dispatch.sh \
     "<task_name>" "<page_id>" "<description>" "<claude|copilot>"
   ```
5. On exit 0 → `notion_update_page` → Status: `Done`
6. On non-zero exit → `notion_update_page` → Status: `Blocked`, write error to `Agent Report`

### Headless Prompt Format (injected into each agent)

```
TASK_CONTEXT: name=<task> | id=<page_id> | description=<desc>

You are operating in headless dispatch mode. Follow your agent instructions file
exactly. The task is already In Progress. Skip Notion fetch. Update Notion at the end.
```

### CLI Prerequisites

| Agent | CLI | Install |
|-------|-----|---------|
| Claude Code | `claude` | https://claude.ai/code |
| GitHub Copilot | `copilot` | `npm install -g @github/copilot-cli` |
