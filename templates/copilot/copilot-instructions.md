# GitHub Copilot Workspace Instructions

## Project Context

A video processing application with Next.js frontend.
Tasks are managed via Notion Database ID: {{DB_ID}}

---

## Agent Workflow

When working on tasks in this project, follow these steps:

### 1. Initialize Environment

Before starting any work, ensure the development server is running:

```bash
./init.sh
```

This installs dependencies and starts the dev server at `http://localhost:3000`.

### 2. Find Your Task

Check the Notion database for tasks with status `To Do`. Work on ONE task at a time:
- Pick the first `To Do` item
- Update its status to `In Progress` before starting work
- Read the `Description` field for full requirements

### 3. Implement

- Follow existing TypeScript/React code patterns in `hello-nextjs/src/`
- Use Tailwind CSS for styling
- Keep changes focused on the task requirements

### 4. Test

Before marking a task complete:

- Run `npm run lint` — must pass with 0 errors
- Run `npm run build` — must succeed
- For UI changes: verify in the browser that rendering and interactions work correctly

### 5. Update Progress

Append to `progress.txt`:

```
## [Date] - Task: [Task Name]

### What was done:
[changes made]

### Testing:
[how it was tested]
```

### 6. Commit and Update Notion

1. Update the Notion task status to `Done` and add a summary to `Agent Report`.
2. Commit all changes in a single commit:

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
4. Do NOT commit incomplete code

---

## Project Structure

```
/
├── hello-nextjs/        # Next.js app (TypeScript + Tailwind)
│   ├── src/app/         # App Router pages and API routes
│   └── src/components/  # Reusable components
├── progress.txt         # Session progress log
└── init.sh              # Environment setup script
```

## Commands

```bash
cd hello-nextjs
npm run dev      # Start development server
npm run build    # Production build check
npm run lint     # Lint check
```
