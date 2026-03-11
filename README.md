# create-notion-agent

> Scaffold a Notion-integrated autonomous AI agent workflow into any project — for **Claude Code**, **Gemini CLI**, or **GitHub Copilot**.

```bash
npx create-notion-agent
```

---

## What It Does

`create-notion-agent` is a zero-dependency CLI that copies a battle-tested autonomous agent workflow into your project directory. The agent reads tasks from a **Notion database**, implements them one at a time, tests the output, commits the code, and updates Notion — all without human intervention.

```
Your Notion Database  →  AI Agent  →  Code committed to Git
     (task queue)         (Claude / Gemini / Copilot)
          +
   Obsidian Vault
 (architecture rules
  & bug learnings)
```

The workflow was built and validated over a 10-hour unattended coding session that produced a full-stack Next.js application with Supabase, AI image generation, and video generation — with every single commit authored by the agent.

---

## Dual-Agent Architecture

Starting from v1.5.0, `create-notion-agent` supports a **two-agent system** where Claude Code and GitHub Copilot divide responsibilities and pick up tasks from the same Notion board without stepping on each other.

| Agent | Domain | Toolchain |
|-------|--------|-----------|
| **Claude Code** | Frontend UI, Backend API, business logic, browser testing & self-debugging | Filesystem, terminal, Playwright MCP |
| **GitHub Copilot Agent** | Database schemas & migrations, cloud infrastructure, external API research | Notion MCP, GitHub MCP, AWS/CDK MCP, Context7 MCP |

### Task Routing

Each Notion task has an **`Agent`** property (select field). When an agent session starts, it fetches **all** `To Do` tasks at once and classifies every task before picking one up:

| `Agent` value | Keyword in task name or description | → Assigned to |
|---------------|-------------------------------------|---------------|
| `Claude Code` | — | Claude Code |
| `GitHub Copilot` | — | GitHub Copilot Agent |
| `Any` | DevOps/DB keyword (see below) | GitHub Copilot Agent |
| `Any` | *(no keyword match — default)* | Claude Code |

**DevOps/DB keywords** (case-insensitive): `docker`, `terraform`, `aws`, `kubernetes`, `k8s`, `ci/cd`, `pipeline`, `database`, `migration`, `rls`, `supabase`, `cloud`, `s3`, `lambda`, `ecs`, `nginx`, `deployment`, `infrastructure`, `helm`, `vpc`, `iam`, `devops`

Before picking up a task each agent fetches all tasks, sorts them by Phase priority, and prints a full classification summary:

```
📋 Task Queue — 4 tasks pending (sorted by Phase priority)

Phase              | Task Name                          | Agent Field    | Assigned To
-------------------|------------------------------------|----------------|-------------------
Bug Fix            | Fix login redirect bug             | Any            | → Claude Code
Sprint 1           | Set up Supabase RLS policies       | GitHub Copilot | → GitHub Copilot
Sprint 1           | Add user profile page              | Claude Code    | → Claude Code
Sprint 2           | Add orders DB migration            | Any            | → GitHub Copilot

Claude Code (2):    Fix login redirect bug, Add user profile page
GitHub Copilot (2): Set up Supabase RLS policies, Add orders DB migration
```

**Phase priority order:** `ADR` → `Bug Fix` → `Sprint 1` → `Sprint 2` → `Sprint 3` → ... → tasks with no Phase

Each agent then picks only the **first task assigned to itself from the sorted list** and sets it to `In Progress`.

### Running Both Agents in Parallel

Because each agent classifies the full queue and picks only its own tasks, you can run Claude Code and GitHub Copilot Agent simultaneously against the same Notion database safely. They will never claim the same task.

### Delegation Rule

If Claude Code encounters a task that requires a database schema change or cloud infrastructure change, it **pauses and delegates** to GitHub Copilot Agent before continuing with the implementation.

---

## Quick Start

### 1. Run the installer

```bash
npx create-notion-agent
```

You will be prompted for:

| Prompt | Description |
|--------|-------------|
| **Which AI CLI?** | Claude Code / Gemini CLI / GitHub Copilot / All three |
| **Notion Database ID** | From your Notion database URL (can be filled in later) |
| **Notion API Token** | From [notion.so/profile/integrations](https://www.notion.so/profile/integrations) — used to auto-configure the MCP server (optional) |
| **Obsidian Vault Path** | Absolute path to your local Obsidian vault — the installer verifies the path is a real vault (has `.obsidian/` folder) and offers to create it if not |

### 2. Make scripts executable

```bash
chmod +x init.sh start-work.sh
```

### 3. Initialize the environment

```bash
./init.sh
```

### 4. Start the agent

```bash
./start-work.sh        # Claude Code
# or launch Gemini CLI / Copilot manually (see below)
```

### Updating an Existing Installation

If you already have `create-notion-agent` set up and want to pull the latest instruction files and skills without re-running the full installer:

```bash
npx create-notion-agent update
```

This command:
- Auto-detects which agents you have installed (Claude Code, Gemini, Copilot)
- Recovers your existing Notion Database ID and Obsidian vault path from current files
- **Overwrites** `CLAUDE.md`, `GEMINI.md`, `copilot-instructions.md`, and all skill files with the latest versions
- **Removes** any skill directories that exist on disk but are no longer present in the current templates (e.g. skills removed in a new version)
- **Preserves** `settings.json` (MCP config), `init.sh`, `start-work.sh`, and `progress.txt`
- Asks for confirmation before making any changes

Also available as:

```bash
npx create-notion-agent upgrade
```

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js ≥ 16** | Required to run the installer |
| **A Notion account** | Free tier is sufficient |
| **Notion Integration** | Create one at [notion.so/profile/integrations](https://www.notion.so/profile/integrations) |
| **An AI CLI** | At least one of: Claude Code, Gemini CLI, GitHub Copilot CLI |

---

## Notion Database Setup

The agent expects a Notion database with these exact properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `Task Name` | Title | The name of the task |
| `Status` | Select | One of: `To Do`, `In Progress`, `Done`, `Blocked` |
| `Description` | Text | Full task requirements — the agent reads this |
| `Agent Report` | Text | Written by the agent after completing or blocking |
| `Agent` | Select | One of: `Claude Code`, `GitHub Copilot`, `Any` — controls which agent picks up the task |
| `Phase` | Select | Sprint/phase identifier (e.g., `ADR`, `Bug Fix`, `Sprint 1`, `Sprint 2`) — used for task prioritization |

> **New in v1.5.0:** You must add the `Agent` select property to your Notion database and set its allowed values to `Claude Code`, `GitHub Copilot`, and `Any`. Existing tasks without an `Agent` value will not be picked up by either agent until a value is assigned — set them to `Any` to let the next available agent claim them.

> **New in v1.7.4:** The `Phase` property enables priority-based task sorting. Tasks are picked in this order: `ADR` → `Bug Fix` → `Sprint 1` → `Sprint 2` → `Sprint 3` → ... → tasks with no Phase. This ensures critical fixes and architecture decisions are handled before feature work.

### Status Lifecycle

```
To Do  →  In Progress  →  Done
                       ↘  Blocked  (if something goes wrong)
```

### Task Assignment Workflow

When you use the `add-coding-task` skill (see [Agent Skills](#agent-skills)) to create a new task, you will be asked which agent should handle it:

```
Which agent should handle this task?
  1) Claude Code   — frontend, backend, business logic
  2) GitHub Copilot — database, cloud infra, research
  3) Any           — either agent, whoever runs next
```

The skill sets the `Agent` property automatically when it creates the Notion page.

### Getting Your Database ID

Your Notion database URL looks like:

```
https://www.notion.so/myworkspace/[DATABASE_ID]?v=...
```

Copy the `DATABASE_ID` segment (32-character UUID).

---

## Architecture Review (`analyze-arch.sh`)

After installing with Claude Code selected, you will have an `analyze-arch.sh` script in your project root. Run it any time to generate a comprehensive `architecture.md`:

```bash
./analyze-arch.sh
```

Claude Code scans the entire project and writes `architecture.md` with these six sections:

| Section | What's documented |
|---------|-------------------|
| **Tech Stack & Dependencies** | Core technologies, key libraries, versions |
| **Directory & File Structure** | Annotated directory tree (2–3 levels deep) |
| **Data Models & DB Schema** | Tables, columns, types, constraints, enums |
| **API Routes & Endpoints** | Every HTTP endpoint with method, path, and description |
| **Key Components & Flows** | End-to-end user flows and important reusable modules |
| **Environment Variables** | Every env var name and description (no values) |

If `architecture.md` already exists it is overwritten. Re-run the script after major refactors or when onboarding new contributors.

> **Requirements:** Claude Code must be installed and authenticated. The script uses `--dangerously-skip-permissions` so Claude can read all files and write `architecture.md` without interactive prompts.

---

## What Gets Installed

### Claude Code

```
your-project/
├── CLAUDE.md           ← Agent workflow instructions
├── init.sh             ← Install deps + start dev server
├── start-work.sh       ← Launch Claude Code in autonomous mode
├── analyze-arch.sh     ← Scan project and write architecture.md
└── .claude/
    ├── settings.json   ← Notion MCP server config (if token provided)
    └── agents/         ← Specialized agent roles (see below)
        ├── task-runner.md
        ├── test-runner.md
        ├── code-reviewer.md
        ├── tech-lead.md
        ├── bug-fixer.md
        └── cloud-devops-engineer.md
```

**`CLAUDE.md`** contains the full SOP the agent follows:
1. Run `init.sh` to set up the environment + create Obsidian vault directories
2. **Scan the project** for config files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, etc.) to auto-detect the stack and derive lint / test / build commands
3. Fetch **all** `To Do` tasks from Notion → classify by agent ownership → print summary table → pick first task for this agent → set to `In Progress`
4. Search Obsidian vault (`Architecture/` + `Troubleshooting/`) for relevant context
5. Implement the task following conventions and Obsidian learnings
6. Run the **lint gate**, **test gate**, and **build gate** (all auto-detected — zero errors required)
7. Test UI changes in the browser via Playwright MCP (UI projects only)
8. Write a post-mortem to Obsidian `Troubleshooting/` if bugs were encountered (filesystem tools only — never `obsidian` CLI)
9. Append a summary to `progress.txt`
10. Update Notion status to `Done` + write `Agent Report`
11. Commit everything in one atomic commit

**`start-work.sh`** invokes Claude with `--dangerously-skip-permissions` so the agent runs fully autonomously.

**`analyze-arch.sh`** invokes Claude Code in non-interactive mode with a structured prompt that scans the entire codebase and writes (or overwrites) `architecture.md` in the project root. See [Architecture Review](#architecture-review-analyze-archsh) for details.

### Claude Code Agents

The installer includes **6 specialized agent roles** in `.claude/agents/`. Each agent has a focused responsibility and can be invoked from Claude Code using the `/agents` command.

| Agent | File | Description |
|-------|------|-------------|
| **task-runner** | [task-runner.md](.claude/agents/task-runner.md) | Fetches Notion tasks, implements features, tests, and commits |
| **test-runner** | [test-runner.md](.claude/agents/test-runner.md) | Runs lint/build/type checks + browser testing; read-only |
| **code-reviewer** | [code-reviewer.md](.claude/agents/code-reviewer.md) | Reviews code quality with structured checklist; read-only |
| **tech-lead** | [tech-lead.md](.claude/agents/tech-lead.md) | Plans architecture, breaks down tasks, makes design decisions |
| **bug-fixer** | [bug-fixer.md](.claude/agents/bug-fixer.md) | Diagnoses issues systematically, applies minimal fixes |
| **cloud-devops-engineer** | [cloud-devops-engineer.md](.claude/agents/cloud-devops-engineer.md) | Manages Supabase, migrations, env vars, CI/CD, Docker, monitoring, and deployment |

#### When to Use Each Agent

```
┌─────────────────────────────────────────────────────────────────────┐
│  Planning Phase                                                     │
│  ├── tech-lead        → Break down a feature, design the approach   │
│  └── cloud-devops-engineer → Infrastructure, CI/CD, Docker, monitoring │
├─────────────────────────────────────────────────────────────────────┤
│  Implementation Phase                                               │
│  └── task-runner      → Pick up a Notion task and implement it      │
├─────────────────────────────────────────────────────────────────────┤
│  Verification Phase                                                 │
│  ├── test-runner      → Run all checks, browser-test UI changes     │
│  └── code-reviewer    → Review code quality before committing       │
├─────────────────────────────────────────────────────────────────────┤
│  Maintenance Phase                                                  │
│  └── bug-fixer        → Diagnose and fix failing tests or bugs      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Invoking an Agent

In Claude Code, use the `/agents` slash command and select the role you need:

```
/agents task-runner     # Start working on the next Notion task
/agents test-runner     # Run all quality checks
/agents code-reviewer   # Review recent changes
/agents tech-lead       # Plan a complex feature
/agents bug-fixer       # Diagnose and fix a bug
/agents cloud-devops-engineer  # Work on infrastructure & DevOps
```

Each agent follows its own structured workflow with specific output formats, making it easy to chain them together (e.g., `tech-lead` → `task-runner` → `test-runner` → `code-reviewer`).

### Gemini CLI

```
your-project/
├── GEMINI.md           ← Same workflow adapted for Gemini CLI
└── .gemini/
    └── settings.json   ← Notion MCP SSE config (if token provided)
```

The `GEMINI.md` file follows the same workflow but is adapted for Gemini's conventions. Gemini CLI uses the Notion MCP server via SSE (Server-Sent Events) transport.

### GitHub Copilot

```
your-project/
└── .github/
    ├── copilot-instructions.md  ← Workspace-level agent instructions
    └── skills/
        ├── run-next-task/       ← Agent Skill: run the coding loop
        └── add-coding-task/     ← Agent Skill: queue a new task in Notion
```

GitHub Copilot reads `.github/copilot-instructions.md` automatically as workspace instructions. The Copilot Agent is configured as the **database, infrastructure, and research** specialist in the dual-agent system.

#### GitHub Copilot MCP Servers

The Copilot Agent leverages VS Code's connected MCP servers for deep research and infrastructure work:

| MCP Server | Used for |
|------------|----------|
| **Notion MCP** | Fetching and updating tasks on the Notion board |
| **GitHub MCP** | Reading issues, PRs, and repository context |
| **AWS Knowledge MCP** | AWS service documentation and architecture guidance |
| **CDK MCP** | CDK construct patterns and IaC generation |
| **Context7 MCP** | Up-to-date library documentation and code examples |

The Copilot Agent follows a **research-first** workflow: it queries Context7 and AWS Knowledge before writing any infrastructure code, then validates changes with `supabase db push` or equivalent before marking a task `Done`.

### Agent Skills

Two [Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) are installed alongside every platform target. Copilot (and Claude Code) load them automatically and invoke them when your message matches their description:

| Skill | Trigger phrases | What it does |
|-------|----------------|--------------|
| **`run-next-task`** | "start working", "run the next task", "pick up a task from Notion", "execute the agent loop" | Fetches **all** `To Do` tasks from Notion, prints a full classification table showing which tasks belong to which agent, then picks up the first task assigned to the current agent — implements it, passes all quality gates, commits, and marks it `Done` |
| **`add-coding-task`** | "add a task", "I want to implement X", "put this in the backlog", "schedule this for the agent" | Gathers title, description, acceptance criteria, and **which agent should handle it**, then creates a `To Do` page in your Notion database with the `Agent` property set |

> **v1.7.0 change:** `run-next-task` now fetches all `To Do` tasks and classifies them by agent ownership before picking one up. Each agent session prints a full queue summary (Claude Code tasks vs GitHub Copilot tasks) so you always know the full state of the backlog at a glance.

Skills are stored in both `.github/skills/` (read by Copilot) and `.claude/skills/` (read by Claude Code) — installed once, works in both. The Notion Database ID is substituted at install time.

---

## MCP Auto-Configuration

When you provide a Notion API Token, the installer writes the MCP server configuration automatically.

### Claude Code — `.claude/settings.json`

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer YOUR_TOKEN\", \"Notion-Version\": \"2022-06-28\"}"
      }
    }
  }
}
```

The `@notionhq/notion-mcp-server` package is fetched on first use via `npx` — nothing to install manually.

### Gemini CLI — `.gemini/settings.json`

```json
{
  "mcpServers": {
    "notion": {
      "httpUrl": "https://mcp.notion.com/sse",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### Manual MCP Setup (if you skipped the token)

**Claude Code:**
```bash
claude mcp add notion-api -- npx -y @notionhq/notion-mcp-server
```
Then edit `.claude/settings.json` to add your token to `OPENAPI_MCP_HEADERS`.

**Gemini CLI:**
Edit `~/.gemini/settings.json` and add the `mcpServers.notion` block shown above.

---

## Agent Workflow (Detail)

Every agent session follows this exact sequence:

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1  Initialize & Scan Project                           │
│         Run ./init.sh → auto-install deps                   │
│         Scan config files → detect stack + commands         │
│         Create Obsidian Architecture/ + Troubleshooting/    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 2  Fetch & Classify All Tasks                          │
│         notion_query_database → ALL Status = "To Do" tasks  │
│         Classify each by Agent field + DevOps/DB keywords   │
│         Print full classification table (Task | Assigned To)│
│         Pick first task for this agent → set "In Progress"  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 3  Knowledge Retrieval (Obsidian RAG)                  │
│         Read Architecture/ for design rules                 │
│         Read Troubleshooting/ for past bug learnings        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 4  Implement & Test (MANDATORY)                        │
│         Write code → follow conventions + Obsidian notes    │
│         Lint gate   → 0 errors  (auto-detected command)      │
│         Test gate   → all pass  (auto-detected command)      │
│         Build gate  → succeeds  (auto-detected command)      │
│         Browser test → UI/API changes (Playwright MCP)      │
│           └─ Self-debug loop: navigate → verify → fix       │
│              (max 3 iterations before escalating Blocked)   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 5  Document Post-Mortem (Obsidian) + Progress          │
│         If bugs: write Troubleshooting/YYYY-MM-DD-[Task].md │
│         (filesystem tools only — NEVER `obsidian` CLI)      │
│         Append summary to progress.txt                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 6  Commit & Update Notion (atomic)                     │
│         notion_update_page → Status = "Done"                │
│         git add . && git commit -m "[Task] - completed"     │
└─────────────────────────────────────────────────────────────┘
```

### Blocking Protocol

If the agent hits an unrecoverable error (missing env vars, external service down, bug after 3 retries):

1. Sets Notion task to **`Blocked`**
2. Writes the exact error to `Agent Report`
3. Appends the reason to `progress.txt`
4. **Stops without committing**

This prevents broken code from being committed and makes failures visible in your Notion board.

---

## Obsidian Integration (Knowledge Base)

The workflow uses a local Obsidian vault as the agent's long-term memory. The agent reads from it before implementing and writes post-mortems back to it after completing tasks that involved bugs or unexpected complexity.

### Expected Vault Structure

```
YourVault/
├── Architecture/          ← Design rules, tech decisions, API patterns
│   └── *.md
└── Troubleshooting/       ← Post-mortems written by the agent after bugs
    └── YYYY-MM-DD-*.md
```

`init.sh` creates these directories automatically on every run (via `mkdir -p` — safe to run repeatedly).

### How the Agent Uses It

| When | Action |
|------|--------|
| Before writing any code | Reads `Architecture/` and `Troubleshooting/` for the current task's feature area |
| After encountering a bug | Writes a post-mortem to `Troubleshooting/YYYY-MM-DD-[Task-Name].md` |

### Important: Never Use the `obsidian` CLI

The `obsidian` CLI tool triggers GUI pop-ups and silently fails in headless/automated environments. The agent **always** writes Obsidian files using standard filesystem tools (native file writing), never the `obsidian` CLI.

### Setting It Up

During `npx create-notion-agent`, provide the absolute path to your vault when prompted. The installer will:
- Verify the path contains a `.obsidian/` folder (confirming it is a real vault)
- Offer to create the directory structure if the vault doesn't exist yet
- Inject the path into `CLAUDE.md` and `init.sh` automatically

To update the path manually afterward:
- In `CLAUDE.md`: replace `[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]`
- In `init.sh`: update the `OBSIDIAN_VAULT_PATH=` variable

---

## Running Multiple Tasks (Automation Loop)

After installing, you can run the agent in a loop to process all `To Do` tasks back-to-back:

```bash
# Run Claude Code 10 times (each run = one Notion task)
for i in $(seq 1 10); do ./start-work.sh; done
```

Or, if you have a `run-automation.sh` in your project:

```bash
./run-automation.sh 10
```

> **Warning:** Unattended automation bypasses all human review checkpoints. Monitor `progress.txt` and your Notion board between runs. Do not use on production-critical systems without understanding the risks.

---

## Customizing the Workflow

After installation, edit the files directly to adapt the workflow to your project:

| File | What to customize |
|------|-------------------|
| `CLAUDE.md` / `GEMINI.md` | Add project-specific conventions or override commands; Obsidian vault path is auto-injected during install |
| `init.sh` | Add env var checks, database seed commands, or update `OBSIDIAN_VAULT_PATH` |
| `start-work.sh` | Adjust the system prompt passed to the agent |
| `analyze-arch.sh` | Extend the architecture prompt, add custom sections |
| `.claude/settings.json` | Add additional MCP servers (Playwright, GitHub, etc.) |

### Recommended Additional MCP Servers

**Playwright** (browser testing — strongly recommended for UI projects):
```bash
claude mcp add playwright -- npx -y @playwright/mcp
```

**GitHub** (for PR creation, issue tracking):
```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```

---

## Project Structure Reference

After running `npx create-notion-agent` with all three CLI targets selected:

```
your-project/
├── CLAUDE.md                          # Claude Code workflow
├── GEMINI.md                          # Gemini CLI workflow
├── init.sh                            # Environment initialization
├── start-work.sh                      # Claude Code launcher
├── analyze-arch.sh                    # Architecture review script
├── progress.txt                       # Agent session log (auto-generated)
├── .claude/
│   ├── settings.json                  # Claude Code MCP config
│   ├── agents/                        # Specialized agent roles
│   │   ├── task-runner.md
│   │   ├── test-runner.md
│   │   ├── code-reviewer.md
│   │   ├── tech-lead.md
│   │   ├── bug-fixer.md
│   │   └── cloud-devops-engineer.md
│   └── skills/                        # Agent Skills (Claude Code)
│       ├── run-next-task/
│       └── add-coding-task/
├── .gemini/
│   └── settings.json                  # Gemini CLI MCP config
└── .github/
    ├── copilot-instructions.md        # GitHub Copilot instructions
    └── skills/                        # Agent Skills (Copilot)
        ├── run-next-task/
        └── add-coding-task/
```

---

## Frequently Asked Questions

**Q: Does the agent commit code automatically?**
Yes. `start-work.sh` runs Claude with `--dangerously-skip-permissions`, which means it executes `git commit` without asking for confirmation. Review `progress.txt` and git log after each session.

**Q: Can I use this with any language or stack?**
Yes. The workflow is fully stack-agnostic. After installation, `init.sh` auto-detects your project type by scanning for `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, or `Makefile`. The agent derives lint, test, and build commands from those files at runtime — no manual configuration needed.

**Q: What if I don't have a Notion token yet?**
Skip it during installation. The workflow files are still copied with a `[YOUR_NOTION_DATABASE_ID]` placeholder. Add the MCP config manually later using the snippets in the MCP section above.

**Q: Does this work on Windows?**
The `bin/cli.js` installer works on Windows. The `init.sh` and `start-work.sh` shell scripts require WSL, Git Bash, or a Unix-like shell.

**Q: Can I run multiple agents in parallel?**
Yes — with the dual-agent system introduced in v1.5.0. Claude Code and GitHub Copilot Agent each filter tasks by their own `Agent` identity, so they will never claim the same task. Run them simultaneously against the same Notion database safely. Running **two instances of the same agent** in parallel (e.g., two Claude Code sessions) is still not recommended, as they may pick the same task before either marks it `In Progress`.

**Q: How do I add the `Agent` property to my existing Notion database?**
Open your Notion database, click `+` to add a property, select **Select**, name it `Agent`, and add three options: `Claude Code`, `GitHub Copilot`, `Any`. Then set existing `To Do` tasks to `Any` so they are picked up by the next available agent.

**Q: What is the browser self-debugging loop?**
For any UI or API change, Claude Code automatically opens the app in a browser (via Playwright MCP), verifies the change works, reads any console errors, and applies fixes — all without human intervention. It retries up to 3 times before escalating the task to `Blocked`.

---

## License

MIT

---

## Related Links

- [Claude Code documentation](https://docs.anthropic.com/claude-code)
- [Gemini CLI documentation](https://github.com/google-gemini/gemini-cli)
- [Notion MCP server](https://www.npmjs.com/package/@notionhq/notion-mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io)
