# Dispatch Routing Rules

## Overview

The dispatcher classifies each Notion task and routes it to one of two CLI agents:

| CLI Agent | Command | Domain |
|-----------|---------|--------|
| **Claude Code CLI** | `claude --dangerously-skip-permissions -p "..."` | Software Engineering, Frontend, Backend, QA |
| **GitHub Copilot CLI** | `copilot -p "..."` | DevOps, Cloud, Database, Infrastructure |

---

## Priority Order

1. **Explicit `Agent` field** — if the task has `Agent: Claude Code` or `Agent: GitHub Copilot`, route directly. Keyword matching is skipped.
2. **Keyword classification** — only applied when `Agent: Any`.
3. **Default** — if `Agent: Any` and no keywords match → route to Claude Code CLI.

---

## Keyword Table (for `Agent: Any` tasks)

If **ANY** of the following words appear in the task **name** or **description**
(case-insensitive), route to **GitHub Copilot CLI**:

| Keyword | Example task |
|---------|-------------|
| `docker` | "Dockerise the API service", "write a Dockerfile" |
| `terraform` | "Terraform module for VPC", "update TF state" |
| `aws` | "Deploy to AWS", "set up IAM roles" |
| `kubernetes` / `k8s` | "Write Helm chart", "configure pod autoscaling" |
| `ci/cd` / `cicd` / `pipeline` | "Set up GitHub Actions workflow" |
| `database` | "Add users table", "optimise slow query" |
| `migration` | "Schema migration, add column", "run db migrate" |
| `rls` | "Row Level Security policy for projects table" |
| `supabase` | "Supabase storage bucket config", "Edge Function" |
| `cloud` | "Cloud storage config", "cloud function setup" |
| `s3` | "S3 bucket policy", "presigned URL generation" |
| `lambda` | "AWS Lambda handler", "Lambda cold start fix" |
| `ecs` | "ECS task definition", "Fargate container config" |
| `nginx` | "Nginx reverse proxy config", "SSL termination" |
| `deployment` | "Production deployment config", "deploy to staging" |
| `infrastructure` | "Infra provisioning", "infrastructure as code" |
| `helm` | "Helm chart values", "Helm release upgrade" |
| `vpc` | "VPC subnet config", "security group rules" |
| `iam` | "IAM roles", "create service account permissions" |
| `devops` | "DevOps tooling", "set up monitoring/alerting" |

If **no keyword matches** → route to **Claude Code CLI** (default).

---

## Overriding Auto-Classification

To force a specific agent regardless of keywords, set the Notion task's `Agent`
field explicitly:

| Notion `Agent` field | Result |
|----------------------|--------|
| `Claude Code` | Always → Claude Code CLI |
| `GitHub Copilot` | Always → Copilot CLI |
| `Any` | Keyword classification applies |

---

## Output Files

- **Claude Code CLI** writes directly to the repository using its file tools.
- **Copilot CLI** streams output to the terminal **and** saves to `copilot-output.md`
  in the project root (created/overwritten each dispatch run).
