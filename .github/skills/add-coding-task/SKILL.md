---
name: add-coding-task
description: Creates a new coding task in the Notion backlog from a description the user
  provides. Collects the task title, plain-language description, and acceptance criteria,
  then creates a Notion page with Status set to To Do. Use when the user says things like
  "add a task", "create a new task", "I want to implement X", "add this to the backlog",
  "put this feature in Notion", "schedule this for the agent", "queue up a task", or
  "I need the agent to build X".
allowed-tools: mcp__notionhq__notion__create_a_page
---

# add-coding-task

You are adding a new task to the Notion coding backlog. The autonomous coding agent will
pick it up in the next run.

---

## Workflow

### 1. Gather Task Details

If the user's message does not already include all of the following, **ask for them** before
proceeding:

| Field | Question to ask |
|-------|----------------|
| **Title** | "What should this task be called? (short, action-oriented — e.g. 'Add dark mode toggle')" |
| **Description** | "Describe what needs to be implemented. Include context, constraints, and any technical notes." |
| **Acceptance criteria** | "How will the agent know when this task is done? List 2–5 specific, verifiable conditions." |
| **Agent** | "Which agent should handle this task? Reply `1` for **Claude Code** (UI/frontend/backend), `2` for **GitHub Copilot** (DB/infra/research), or `3` for **Any**." |

Do not invent or guess missing information. Ask the user for each missing field.

Agent mapping:
- `1` / `claude` / `frontend` / `backend` → `Claude Code`
- `2` / `copilot` / `github` / `db` / `infra` / `database` / `cloud` / `research` → `GitHub Copilot`
- `3` / `any` / `both` → `Any`

---

### 2. Format the Task

Once you have all four fields, structure the task content:

```
Title: [user's title]

Description:
[user's description]

Acceptance Criteria:
- [ ] [criterion 1]
- [ ] [criterion 2]
- [ ] [criterion 3]
```

---

### 3. Create the Notion Page

Use the `create_a_page` Notion MCP tool to create a new page in database `[YOUR_NOTION_DATABASE_ID]`:

**Properties to set:**
- `Task Name` (title): the task title
- `Status` (select): `To Do`
- `Agent` (select): one of `Claude Code`, `GitHub Copilot`, or `Any`
- `Description` (rich_text): the full description + acceptance criteria block above

---

### 4. Confirm

After the page is created, reply with:

```
✅ Task added to Notion backlog:
   Title: [title]
   Status: To Do
   URL: [notion page URL]

The coding agent will pick it up on the next run.
Run the "run-next-task" skill (or say "start working") to start it now.
```

---

## Notes

- Always set `Status` to `To Do` — never `In Progress` or `Done`
- Always set `Agent` to one of `Claude Code`, `GitHub Copilot`, or `Any` — never leave it blank
- **Claude Code** handles: React/Next.js components, API routes, business logic, browser testing
- **GitHub Copilot** handles: SQL migrations, Supabase/RLS, AWS/Terraform, Docker, external API research
- **Any** — either agent may pick it up (use sparingly)
- If the Notion MCP tool is not available, instruct the user to add the task manually and provide the formatted content to paste
- Write acceptance criteria as checkboxes so the agent can verify completion
