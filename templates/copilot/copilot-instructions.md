# GitHub Copilot Workspace Instructions

## Project Context

This workflow is **stack-agnostic** and works with any language or framework.
Tasks are managed via Notion Database ID: {{DB_ID}}

The agent detects your project type at runtime by scanning config files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, etc.) to determine install, lint, test, and build commands automatically.

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

- Scan the project root for config files to understand the stack and conventions
- Read `CONTRIBUTING.md`, `.editorconfig`, and linter configs before writing code
- Match existing code style, naming patterns, and idioms
- Keep changes focused on the task requirements

### 4. Test

Before marking a task complete, run all three quality gates:

1. **Lint** — run the lint command for your stack (e.g. `npm run lint`, `ruff check .`, `go vet ./...`). Zero errors required.
2. **Tests** — run the test command for your stack (e.g. `npm test`, `pytest`, `go test ./...`). All tests must pass.
3. **Build** — run the build command if applicable (e.g. `npm run build`, `go build ./...`, `cargo build`). Must succeed.
4. **Browser** (UI projects only) — for major visual changes, verify rendering and interactions in the browser.

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
├── progress.txt         # Session progress log
├── init.sh              # Environment setup script
└── <your-app>/          # Application directory — discovered at runtime
```

The application directory is detected automatically from config files. No fixed structure is assumed.

## Command Discovery

Commands are derived from project config files at runtime:

| Config file | Install | Lint | Test | Build |
|-------------|---------|------|------|-------|
| `package.json` | `npm install` | see `scripts.lint` | see `scripts.test` | see `scripts.build` |
| `pyproject.toml` / `setup.py` | `pip install -e .` | `ruff check .` | `pytest` | n/a |
| `go.mod` | `go mod download` | `go vet ./...` | `go test ./...` | `go build ./...` |
| `Cargo.toml` | `cargo fetch` | `cargo clippy` | `cargo test` | `cargo build` |
| `Makefile` | `make install` | `make lint` | `make test` | `make build` |
