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
```

The workflow was built and validated over a 10-hour unattended coding session that produced a full-stack Next.js application with Supabase, AI image generation, and video generation — with every single commit authored by the agent.

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

### Status Lifecycle

```
To Do  →  In Progress  →  Done
                       ↘  Blocked  (if something goes wrong)
```

### Getting Your Database ID

Your Notion database URL looks like:

```
https://www.notion.so/myworkspace/[DATABASE_ID]?v=...
```

Copy the `DATABASE_ID` segment (32-character UUID).

---

## What Gets Installed

### Claude Code

```
your-project/
├── CLAUDE.md           ← Agent workflow instructions
├── init.sh             ← Install deps + start dev server
├── start-work.sh       ← Launch Claude Code in autonomous mode
└── .claude/
    └── settings.json   ← Notion MCP server config (if token provided)
```

**`CLAUDE.md`** contains the full SOP the agent follows:
1. Run `init.sh` to set up the environment
2. Query Notion for the first `To Do` task → set to `In Progress`
3. Implement the task following existing code conventions
4. Run `npm run lint` and `npm run build` (zero errors required)
5. Test UI changes in the browser via Playwright MCP
6. Append a summary to `progress.txt`
7. Update Notion status to `Done` + write `Agent Report`
8. Commit everything in one atomic commit

**`start-work.sh`** invokes Claude with `--dangerously-skip-permissions` so the agent runs fully autonomously.

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
    └── copilot-instructions.md  ← Workspace-level agent instructions
```

GitHub Copilot reads `.github/copilot-instructions.md` automatically as workspace instructions. Since Copilot does not yet support MCP servers, the MCP setup step is skipped and the init/start scripts are not included.

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
│ Step 1  Initialize                                          │
│         Run ./init.sh → install deps → start dev server     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 2  Fetch Task                                          │
│         notion_query_database → filter Status = "To Do"     │
│         notion_update_page   → set Status = "In Progress"   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 3  Implement                                           │
│         Read Description → write code → follow conventions  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 4  Test (MANDATORY)                                    │
│         npm run lint  → 0 errors                            │
│         npm run build → must succeed                        │
│         Browser test  → for UI changes (Playwright MCP)     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Step 5  Document                                            │
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
| `CLAUDE.md` / `GEMINI.md` | Add project-specific conventions, tech stack details, test commands |
| `init.sh` | Change the port, add env var checks, seed a database |
| `start-work.sh` | Adjust the system prompt passed to the agent |
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
├── progress.txt                       # Agent session log (auto-generated)
├── .claude/
│   └── settings.json                  # Claude Code MCP config
├── .gemini/
│   └── settings.json                  # Gemini CLI MCP config
└── .github/
    └── copilot-instructions.md        # GitHub Copilot instructions
```

---

## Frequently Asked Questions

**Q: Does the agent commit code automatically?**
Yes. `start-work.sh` runs Claude with `--dangerously-skip-permissions`, which means it executes `git commit` without asking for confirmation. Review `progress.txt` and git log after each session.

**Q: Can I use this without a Next.js project?**
Yes. The workflow files are framework-agnostic. Edit `CLAUDE.md` to replace the Next.js-specific test commands (`npm run lint`, `npm run build`) with whatever your project uses.

**Q: What if I don't have a Notion token yet?**
Skip it during installation. The workflow files are still copied with a `[YOUR_NOTION_DATABASE_ID]` placeholder. Add the MCP config manually later using the snippets in the MCP section above.

**Q: Does this work on Windows?**
The `bin/cli.js` installer works on Windows. The `init.sh` and `start-work.sh` shell scripts require WSL, Git Bash, or a Unix-like shell.

**Q: Can I run multiple agents in parallel?**
Not recommended against the same Notion database. The agent picks the first `To Do` task and immediately marks it `In Progress`. Running two agents simultaneously may cause them to pick the same task.

---

## License

MIT

---

## Related Links

- [Claude Code documentation](https://docs.anthropic.com/claude-code)
- [Gemini CLI documentation](https://github.com/google-gemini/gemini-cli)
- [Notion MCP server](https://www.npmjs.com/package/@notionhq/notion-mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io)
