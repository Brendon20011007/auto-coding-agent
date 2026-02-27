# Project Context

A video processing application with Next.js frontend.

> Note: Detailed project requirements are managed dynamically via a Notion Database.

## Notion Integration Context

- **Target Database ID**: [在这里填入你的_Database_ID]
- **Task Statuses**: `To Do`, `In Progress`, `Done`, `Blocked`
- **Target Properties**: `Task Name`, `Status`, `Description`, `Agent Report`

---

# MANDATORY: Agent Workflow

Every new agent session MUST follow this workflow strictly in order:

### Step 1: Initialize Environment

Run `./init.sh`

This will install dependencies. Make sure the development server (`http://localhost:3000`) is running. DO NOT skip this step.

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

- **Major UI Changes**: MUST be tested in the browser using the MCP Playwright tool. Verify rendering, clicks, and form submissions.
- **Minor Changes**: Validate via unit tests or lint/build.
- **Strict Checks**:
  - `npm run lint` passes with 0 errors.
  - `npm run build` succeeds.
  - No TypeScript errors.

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
2. **Test before marking complete** — All steps must pass before updating Notion to `Done`.
3. **Browser testing for UI changes** — Major page changes require Playwright browser verification.
4. **Document in progress.txt** — Append a summary after each task.
5. **One commit per task** — Code + progress.txt in a single commit.
6. **Never skip Notion updates** — Status transitions (`To Do` → `In Progress` → `Done`/`Blocked`) are mandatory.
7. **Stop if blocked** — Do not commit; update Notion to `Blocked` and output blocking info.
