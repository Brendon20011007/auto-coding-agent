---
name: cloud-infra-review
description: Enterprise-level review of all infrastructure, cloud, and database changes. ALWAYS uses GitHub Copilot CLI only — never Gemini. Covers Terraform, AWS CDK, CloudFormation, Kubernetes, SQL, Supabase, and Docker. Must return ✅ APPROVED before any terraform apply, cdk deploy, supabase db push, or kubectl apply is executed.
---

# Cloud Infra / Service Review

Performs an enterprise-grade review of all infrastructure, cloud, and database changes using **GitHub Copilot CLI only**. No routing to Gemini — these changes carry production risk and require the highest level of analysis.

## When to Use This Skill

Invoke this skill whenever `git diff --name-only` includes ANY of:

| File pattern | Change type |
|---|---|
| `*.tf`, `*.tfvars` | Terraform |
| Files in `infra/`, `cdk/`, `lib/` with CDK imports | AWS CDK |
| `*.yaml` / `*.json` containing `AWSTemplateFormatVersion` | CloudFormation |
| `*.yaml` containing `kind:` field | Kubernetes |
| `*.sql`, `supabase/migrations/`, filenames matching `*migration*` | SQL / Supabase |
| `Dockerfile`, `docker-compose*.yml`, `compose.yml` | Docker |

## When NOT to Use This Skill

- For application code (React, API routes, Python logic) — use `agent-skills-code-review-router-main` instead
- For documentation-only changes
- When reviewing external/third-party IaC you don't control

## CRITICAL: Copilot CLI Only

> **This skill NEVER falls back to Gemini CLI.** Infrastructure changes carry production, security, and data-loss risk. Only Copilot CLI's enterprise-level analysis is used. If Copilot CLI is unavailable, **STOP** and report — do not substitute another tool.

---

## Step 0: Environment Check

Verify we're in a git repository:

```bash
git rev-parse --git-dir 2>/dev/null || echo "NOT_A_GIT_REPO"
```

**If not a git repo:** Stop and inform the user. Do not proceed.

---

## Step 1: Verify Copilot CLI

```bash
gh copilot --version || echo "COPILOT_NOT_FOUND"
```

**If Copilot CLI is not found:**

```
❌ GitHub Copilot CLI is required for infrastructure review but was not found.

Install it with:
  gh extension install github/gh-copilot

Then authenticate:
  gh auth login

Do NOT fall back to Gemini. Infrastructure review cannot proceed without Copilot CLI.
```

**Stop execution.** Do not continue with Gemini or any other tool.

---

## Step 2: Detect Change Types

```bash
git --no-pager diff --name-only HEAD 2>/dev/null || git --no-pager diff --name-only
```

For each changed file, classify it:

| Detected category | File patterns |
|---|---|
| **Terraform** | `*.tf`, `*.tfvars` |
| **AWS CDK** | `*.ts` / `*.py` in `infra/`, `cdk/`, `lib/` |
| **CloudFormation** | `*.yaml` / `*.json` (check content for `AWSTemplateFormatVersion`) |
| **Kubernetes** | `*.yaml` (check content for `kind:` field) |
| **Supabase / SQL** | `*.sql`, `supabase/migrations/**`, `*migration*` |
| **Docker** | `Dockerfile*`, `docker-compose*.yml`, `compose.yml` |

Build a list of matched categories — you will run the appropriate static validators for each.

---

## Step 3: Static Validation

Run whichever tools are available. Skip unavailable tools and note them in the output.

### Terraform

```bash
# Check if terraform binary exists first
which terraform || echo "TERRAFORM_NOT_FOUND"

# Format check (no files modified, read-only)
terraform fmt -check -recursive

# Validate configuration syntax
terraform validate

# Advanced linting (if available)
which tflint && tflint --recursive

# Security scanning (use first one found)
which checkov && checkov -d . --framework terraform
which tfsec && tfsec .
```

### AWS CDK

```bash
# Synthesize without deploying (read-only)
npx cdk synth 2>&1 | head -100
```

### CloudFormation

```bash
# Lint CloudFormation templates (if cfn-lint available)
which cfn-lint && find . -name "*.yaml" -o -name "*.json" | xargs cfn-lint
```

### Kubernetes

```bash
# Dry-run validation (if kubectl available)
which kubectl && find . -name "*.yaml" | xargs kubectl apply --dry-run=client -f 2>&1 | head -100
# Or kubeval if available
which kubeval && find . -name "*.yaml" | xargs kubeval
```

### Supabase / SQL

```bash
# SQL linting (if sqlfluff available)
which sqlfluff && sqlfluff lint --dialect ansi supabase/migrations/ 2>/dev/null

# Supabase diff (syntax validation, no push)
which supabase && supabase db diff 2>/dev/null | head -100
```

### Docker

```bash
# Validate compose file syntax
which docker && docker compose config --quiet 2>&1 | head -50
```

**Collect all tool outputs.** Note any failures or warnings. Proceed to Step 4 regardless of individual tool availability.

---

## Step 4: Copilot CLI Enterprise Review

Pipe the full infrastructure diff to Copilot CLI with the enterprise infra prompt:

```bash
git --no-pager diff HEAD | gh copilot suggest -t shell "
You are performing an enterprise-level infrastructure and security review. Review this diff and check for ALL of the following:

SECURITY:
- Hardcoded secrets, API keys, passwords, tokens, or credentials in any file
- IAM wildcard permissions (Action: '*' or Resource: '*') that could grant excessive access
- Overly permissive security groups or firewall rules (ingress 0.0.0.0/0 on sensitive ports)
- Public S3 bucket or storage container exposure
- Missing encryption at rest or in transit

DESTRUCTIVE OPERATIONS (flag each one explicitly):
- Resource deletions or renames that will force re-creation (Terraform 'forces replacement')
- DROP TABLE, DROP DATABASE, DELETE CASCADE, TRUNCATE without backup instructions
- Schema changes that remove or rename columns with existing data
- Kubernetes deployment changes that cause pod restarts with data loss risk
- State backend changes or remote state moves

COMPLIANCE AND GOVERNANCE:
- Missing required resource tags (environment, project, owner, cost-center)
- Missing Row Level Security (RLS) on new Supabase/PostgreSQL tables
- Resources created outside of approved regions or VPCs
- Missing audit logging or CloudTrail coverage for new resources

RELIABILITY:
- Single points of failure (no multi-AZ, no redundancy)
- Missing health checks, readiness/liveness probes
- Hardcoded resource sizes with no auto-scaling
- Missing backup or disaster recovery configuration for stateful resources

COST:
- Unexpectedly expensive resource types (e.g., large instance sizes, NAT gateways in every AZ)
- On-demand pricing where Reserved Instances or Savings Plans would apply
- Resources that will incur charges immediately upon apply

STATIC ANALYSIS RESULTS:
$(cat /tmp/static-analysis-results.txt 2>/dev/null || echo 'No static analysis results available')

For each finding:
1. State the file and line number
2. Classify as: BLOCKER (must fix before apply) | WARNING (should fix) | INFO (note for awareness)
3. Describe the risk
4. Provide the exact fix

At the end, emit EXACTLY ONE of:
✅ APPROVED - no blockers found
⚠️ CHANGES REQUESTED - [number] blocker(s) and/or [number] warning(s) found (list them)
❌ REJECTED - critical security or data-loss risk found (describe it)
"
```

> **If the diff is large (> 500 lines):** Split by category (Terraform files, SQL files, etc.) and run multiple passes, one per category. Collect all results and issue one combined verdict.

---

## Step 5: Format Output

Present results in this structure:

```
## Cloud Infra Review Results

**Reviewed by:** GitHub Copilot CLI (enterprise)
**Change types detected:** [Terraform / CDK / CloudFormation / K8s / SQL / Docker]

### Static Validation
| Tool | Result |
|------|--------|
| terraform fmt | [PASS / FAIL / NOT INSTALLED] |
| terraform validate | [PASS / FAIL / NOT INSTALLED] |
| tflint | [PASS / N findings / NOT INSTALLED] |
| checkov / tfsec | [PASS / N findings / NOT INSTALLED] |
| [other tools] | [...] |

### Copilot CLI Review

---
[Copilot CLI output here]
---

### Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | [N] |
| WARNING  | [N] |
| INFO     | [N] |

**Verdict:** *(use exactly one of the following tokens)*
- `✅ APPROVED` — no blockers; proceed with apply/deploy
- `⚠️ CHANGES REQUESTED` — [list of all BLOCKER items; caller must fix all and re-invoke until APPROVED]
- `❌ REJECTED` — [critical security or data-loss issue; do NOT apply; trigger Blocking Protocol]
```

---

## Step 6: Gate Enforcement

### If `✅ APPROVED`

Inform the caller:

```
✅ APPROVED — Cloud infra review passed.

It is now safe to proceed with:
- terraform plan && terraform apply
- cdk deploy
- supabase db push
- kubectl apply
- docker compose up -d

Reminder: git push still requires explicit user permission (ask the user before pushing).
```

### If `⚠️ CHANGES REQUESTED`

```
⚠️ CHANGES REQUESTED — Do NOT apply/deploy yet.

The following blockers must be resolved:
[list each BLOCKER item with file, line, risk, and fix]

After fixing, re-invoke agent-skills-cloud-infra-review.
Iterate until ✅ APPROVED. There is no iteration cap.
```

### If `❌ REJECTED`

```
❌ REJECTED — Critical issue found. Apply/deploy is BLOCKED.

[Describe the critical finding]

Trigger the Blocking Protocol:
1. Do NOT run terraform apply, cdk deploy, supabase db push, or any apply command.
2. Do NOT commit these changes.
3. Update Notion task status to Blocked.
4. Write the exact issue into Agent Report.
5. Request human intervention.
```

---

## Quick Reference

| Change Type | Static Tool | Copilot Prompt Focus |
|---|---|---|
| Terraform | `terraform validate`, `tflint`, `checkov` | IAM, destructive ops, tags, secrets |
| AWS CDK | `cdk synth` | IAM, resource exposure, costs |
| CloudFormation | `cfn-lint` | Security groups, IAM, outputs |
| Kubernetes | `kubectl --dry-run` | RBAC, image sources, resource limits |
| SQL / Supabase | `sqlfluff`, `supabase db diff` | DROP ops, missing RLS, data loss |
| Docker | `docker compose config` | Exposed ports, secrets, base images |
