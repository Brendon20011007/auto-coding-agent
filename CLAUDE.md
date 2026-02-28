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
| **Notion Database ID** | [在这里填入你的_Database_ID] |
| **Obsidian Vault Path** | [YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH] |
| Task Statuses | `To Do`, `In Progress`, `Done`, `Blocked` |
| Target Properties | `Task Name`, `Status`, `Description`, `Agent Report` |

---

# Project Context

A video processing application with Next.js frontend.

> Note: Detailed project requirements are managed dynamically via a Notion Database.

---

# MANDATORY: Agent Workflow

Every new agent session MUST follow this workflow strictly in order:

### Step 1: Initialize Environment

Run `./init.sh`

This will install dependencies, start the development server (`http://localhost:3000`), and ensure the Obsidian vault directory structure exists. DO NOT skip this step.

### Step 2: Fetch Task from Notion

1. Use the Notion MCP tool `notion_query_database` to query the Target Database.
2. Filter the query strictly for items where `Status` is `To Do`.
3. Pick the FIRST task in the list. If there are no `To Do` tasks, output "No pending tasks found in Notion. Waiting..." and STOP execution.
4. IMMEDIATELY use `notion_update_page` to change the selected task's `Status` to `In Progress`.
5. Read the `Description` property carefully to understand the requirement.

### Step 3: Knowledge Retrieval (Obsidian RAG)

**Before writing any code**, search the Obsidian vault for relevant context:

1. Search `[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]/Architecture/` for design rules and conventions related to the current task's feature area.
2. Search `[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]/Troubleshooting/` for past bug reports related to the same feature or component.
3. Read any relevant files found and apply those learnings to your implementation plan.

If the vault path is not configured or no relevant files exist, continue to Step 4.

### Step 4: Implement & Test

**Implementation:**
- Implement the functionality to satisfy all requirements in the Notion task description.
- Follow existing code patterns, conventions, and any Architecture notes retrieved in Step 3.

**Testing (MANDATORY — all checks must pass):**
- **Major UI Changes**: MUST be tested in the browser using the MCP Playwright tool. Verify rendering, clicks, and form submissions.
- **Minor Changes**: Validate via unit tests or lint/build.
- **Strict Checks**:
  - `npm run lint` passes with 0 errors.
  - `npm run build` succeeds.
  - No TypeScript errors.

### Step 5: Document Post-Mortem (Obsidian) & Update Progress

**Obsidian Post-Mortem** (only if bugs or non-obvious design decisions were encountered):

> **CRITICAL:** Do NOT use the `obsidian` CLI command. It has known GUI pop-up bugs and silent failures in headless environments. Use standard filesystem file-writing tools only.

Write to: `[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]/Troubleshooting/YYYY-MM-DD-[Task-Name].md`

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
├── start-work.sh      # Trigger script
├── progress.txt       # Progress log
├── init.sh            # Initialization script
└── hello-nextjs/      # Next.js application
    ├── src/app/       # App Router pages
    ├── src/components/
    └── ...
```

## Commands

```bash
# In hello-nextjs/
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run linter
```

## Coding Conventions

- TypeScript strict mode
- Functional components with hooks
- Tailwind CSS for styling
- Write tests for new features

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
