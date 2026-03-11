---
name: code-review-router
description: Intelligently routes code reviews between Gemini CLI and Copilot CLI based on tech stack, complexity, and change characteristics. Use when you want an automated code review of your current changes.
---

# Code Review Router

Routes code reviews to the optimal CLI (Gemini or Copilot) based on change characteristics.

## When NOT to Use This Skill

- For non-code reviews (documentation proofreading, prose editing)
- When reviewing external/third-party code you don't control
- For commit message generation (use a dedicated commit skill)
- When you need a specific reviewer (use that CLI directly)

## Step 0: Environment Check

Verify we're in a git repository:

```bash
git rev-parse --git-dir 2>/dev/null || echo "NOT_A_GIT_REPO"
```

**If not a git repo:** Stop and inform the user: "This directory is not a git repository. Initialize with `git init` or navigate to a repo."

## Step 1: Prerequisites Check

Verify both CLIs are available:

```bash
# Check for Gemini CLI
which gemini || echo "GEMINI_NOT_FOUND"

# Check for Copilot CLI (via GitHub CLI)
gh copilot --version || echo "COPILOT_NOT_FOUND"
```

**If neither CLI is found:** Stop and inform the user they need to install at least one:
- Gemini: `npm install -g @google/gemini-cli`
- Copilot: Install [GitHub CLI](https://cli.github.com/) then run `gh copilot`

**If only one CLI is available:** Use that CLI (no routing needed).

**If both are available:** Proceed with routing analysis.

## Step 2: Analyze Git Diff

Run these commands to gather diff statistics:

```bash
# Get diff stats (staged + unstaged)
git --no-pager diff --stat HEAD 2>/dev/null || git --no-pager diff --stat

# Get full diff for pattern analysis
git --no-pager diff HEAD 2>/dev/null || git --no-pager diff

# Count changed files
git --no-pager diff --name-only HEAD 2>/dev/null | wc -l

# Count total changed lines
git --no-pager diff --numstat HEAD 2>/dev/null | awk '{added+=$1; removed+=$2} END {print added+removed}'
```

**If no changes detected:** Report "Nothing to review - no uncommitted changes found." and stop.

## Step 3: Calculate Complexity Score

Initialize `complexity_score = 0`, then add points:

| Condition | Points | Detection Method |
|-----------|--------|------------------|
| Files changed > 10 | +2 | `git diff --name-only \| wc -l` |
| Files changed > 20 | +3 | (additional, total +5) |
| Lines changed > 300 | +2 | `git diff --numstat` sum |
| Lines changed > 500 | +3 | (additional, total +5) |
| Multiple directories touched | +1 | Count unique dirs in changed files |
| Test files included | +1 | Files matching `*test*`, `*spec*` |
| Config files changed | +1 | Files: `*.config.*`, `*.json`, `*.yaml`, `*.yml`, `*.toml` |
| Database/schema changes | +2 | Files: `*migration*`, `*schema*`, `*.sql`, `prisma/*` |
| API route changes | +2 | Files in `api/`, `routes/`, containing `endpoint`, `handler` |
| Service layer changes | +2 | Files in `services/`, `*service*`, `*provider*` |

## Step 4: Detect Language & Framework

Analyze file extensions and content patterns:

### Primary Language Detection
```
.ts, .tsx     → TypeScript
.js, .jsx     → JavaScript
.py           → Python
.go           → Go
.rs           → Rust
.java         → Java
.rb           → Ruby
.php          → PHP
.cs           → C#
.swift        → Swift
.kt           → Kotlin
```

### Framework Detection (check imports/file patterns)
```
React/Next.js    → "import React", "from 'react'", "next.config", pages/, app/
Vue              → ".vue" files, "import Vue", "from 'vue'"
Angular          → "angular.json", "@angular/core"
Django           → "django", "models.py", "views.py", "urls.py"
FastAPI          → "from fastapi", "FastAPI("
Express          → "express()", "from 'express'"
NestJS           → "@nestjs/", "*.module.ts", "*.controller.ts"
Rails            → "Gemfile" with rails, app/controllers/
Spring           → "springframework", "@RestController"
```

### Security-Sensitive Patterns

Detect by **file path** OR **code content**:

**File paths:**
```
**/auth/**
**/security/**
**/*authentication*
**/*authorization*
**/middleware/auth*
```

**Code patterns (in diff content):**
```
password\s*=
api_key\s*=
secret\s*=
Bearer\s+
JWT
\.env
credentials
private_key
access_token
```

**Config files:**
```
.env*
*credentials*
*secrets*
*.pem
*.key
```

## Step 5: Apply Routing Decision Tree

**Routing Priority Order** (evaluate top-to-bottom, first match wins):

### Priority 1: Pattern-Based Rules (Hard Rules)

| Pattern | Route | Reason |
|---------|-------|--------|
| Terraform / IaC files (`*.tf`, `*.tfvars`, CDK, CloudFormation, Kubernetes) | **Copilot** ⚠️ | IaC changes — also invoke `agent-skills-cloud-infra-review` before any apply/deploy |
| Security-sensitive files/code detected | **Copilot** | Requires careful security analysis |
| Files > 20 OR lines > 500 | **Copilot** | Large changeset needs thorough review |
| Database migrations or schema changes | **Copilot** | Architectural risk |
| API/service layer modifications | **Copilot** | Backend architectural changes |
| Changes span 3+ top-level directories | **Copilot** | Multi-service impact |
| Complex TypeScript (generics, type utilities) | **Copilot** | Type system complexity |
| Pure frontend only (jsx/tsx/vue/css/html) | **Gemini** | Simpler, visual-focused review |
| Python ecosystem (py, Django, FastAPI) | **Gemini** | Strong Python support |
| Documentation only (md/txt/rst) | **Gemini** | Simple text review |

### Priority 2: Complexity Score (if no pattern matched)

| Score | Route | Reason |
|-------|-------|--------|
| ≥ 6 | **Copilot** | High complexity warrants deeper analysis |
| < 6 | **Gemini** | Moderate complexity, prefer speed |

### Priority 3: Default

→ **Gemini** (faster feedback loop for unclear cases)

## Step 6: Execute Review

### Explain Routing Decision

Before executing, output:

```
## Code Review Routing

**Changes detected:**
- Files: [X] files changed
- Lines: [Y] lines modified
- Primary language: [language]
- Framework: [framework or "none detected"]

**Complexity score:** [N]/10
- [List contributing factors]

**Routing decision:** [Gemini/Copilot]
- Reason: [primary reason for choice]

**Executing review...**
```

### CLI Commands

> **Note:** Gemini receives the diff via stdin (piped), while Copilot CLI uses a prompt-based approach with tool access for git context. If debugging, check that `git diff HEAD` produces output before running either CLI.

**For Gemini:**
```bash
# Pipe diff to Gemini with review prompt
git --no-pager diff HEAD | gemini -p "Review this code diff for: 1) Code quality issues, 2) Best practices violations, 3) Potential bugs, 4) Security concerns, 5) Performance issues. Provide specific, actionable feedback."
```

**For Copilot:**
```bash
# Pipe diff to Copilot CLI with review prompt and shell tool access
git --no-pager diff HEAD | gh copilot -p "Review this code diff for: 1) Code quality issues, 2) Best practices violations, 3) Potential bugs, 4) Security concerns, 5) Performance issues. Provide specific, actionable feedback." --allow-tool "shell(git)"
```

## Step 7: Handle Failures with Fallback

If the chosen CLI fails (non-zero exit or error output):

1. **Report the failure:**
   ```
   [Primary CLI] failed: [error message]
   Attempting fallback to [other CLI]...
   ```

2. **Try the alternative CLI**

3. **If fallback also fails:**
   ```
   Both review CLIs failed.
   - Gemini error: [error]
   - Copilot error: [error]

   Please check CLI installations and try manually.
   ```

## Step 8: Format Output

Present the review results clearly:

```
## Code Review Results

**Reviewed by:** [Gemini/Copilot]
**Routing:** [brief reason]

---

[CLI output here]

---

**Review complete.** [X files, Y lines analyzed]

**Verdict:** *(use exactly one of these tokens — callers key off this)*
- `✅ APPROVED` — no issues; proceed to commit
- `⚠️ CHANGES REQUESTED` — [list of required fixes; caller must fix all and re-invoke until APPROVED]
- `❌ REJECTED` — [critical issue; do NOT commit; trigger Blocking Protocol]

> ⚠️ **If Terraform / IaC files were changed:** also invoke `agent-skills-cloud-infra-review` before running any `terraform apply`, `cdk deploy`, `supabase db push`, or `kubectl apply`.
```

## Quick Reference

| Change Type | Route | Reason |
|-------------|-------|--------|
| React component styling | Gemini | Pure frontend |
| Django view update | Gemini | Python ecosystem |
| Single bug fix < 50 lines | Gemini | Simple change |
| New API endpoint + tests | Copilot | Architectural |
| Auth system changes | Copilot | Security-sensitive |
| Database migration | Copilot | Schema change |
| Multi-service refactor | Copilot | High complexity |
| TypeScript type overhaul | Copilot | Complex types |
