#!/bin/bash
# analyze-arch.sh
# Invokes Claude Code to scan the project and write architecture.md
# Usage: ./analyze-arch.sh

echo "========================================"
echo "🔍 Analyzing project architecture..."
echo "========================================"

claude -p "You are a senior software architect. Your job is to analyze this codebase thoroughly and produce a comprehensive, up-to-date 'architecture.md' file in the project root.

## Instructions

Scan the entire project. Read every relevant file needed to understand the system:
- package.json, package-lock.json, any build/config files (next.config.*, tsconfig.json, etc.)
- All source files under src/ (or equivalent) — especially API routes, DB layer, components, and types
- Any migration files, schema files, or SQL files
- .env.example or any file that references environment variable names (do NOT print actual secret values)
- README.md if it exists

After scanning, overwrite (or create) 'architecture.md' in the current directory with the following sections. Use clear Markdown headings. Be specific — use actual file paths and names from the code, not generic descriptions.

---

## 1. Tech Stack & Dependencies

List the core technologies and key third-party libraries. Include versions where relevant.
Format as a Markdown table: | Layer | Technology | Notes |

## 2. Directory & File Structure

Show the actual directory tree of the project (2-3 levels deep). Briefly annotate what each major directory/file is responsible for.

## 3. Data Models & DB Schema

Document every database table or collection:
- Table/collection name
- All columns/fields with types and constraints
- Primary keys, foreign keys, indexes
- Enums or status fields with all possible values

If there are migration files, derive the schema from them precisely.

## 4. API Routes & Endpoints

List every HTTP endpoint in the project:
| Method | Path | Handler file | Description |

For each endpoint note: what it accepts, what it returns, and any auth requirement.

## 5. Key Components & Flows

Describe the main user-facing flows and how the code executes them end-to-end. For each flow:
- Trigger (user action or event)
- Sequence of functions/components/APIs called
- Final outcome

Also list the most important reusable components or modules and what they do.

## 6. Environment Variables

List every environment variable the application reads:
| Variable | Required | Description |

Do NOT print actual values — only names and descriptions inferred from usage in the code.

---

After writing architecture.md, print: 'architecture.md has been written successfully.'" \
  --dangerously-skip-permissions

echo "========================================"
echo "✅ Done! architecture.md is ready."
echo "========================================"
