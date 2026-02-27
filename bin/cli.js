#!/usr/bin/env node

'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ─── Helpers ────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const CYAN  = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM   = '\x1b[2m';

function print(msg) { process.stdout.write(msg + '\n'); }
function bold(s)  { return BOLD + s + RESET; }
function cyan(s)  { return CYAN + s + RESET; }
function green(s) { return GREEN + s + RESET; }
function yellow(s){ return YELLOW + s + RESET; }
function dim(s)   { return DIM + s + RESET; }

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function copyFileWithReplacements(src, dest, replacements) {
  let content = fs.readFileSync(src, 'utf8');
  for (const [from, to] of Object.entries(replacements)) {
    content = content.split(from).join(to);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function makeExecutable(filePath) {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch (_) {
    // Windows — silently skip
  }
}

function mergeJson(filePath, patch) {
  let existing = {};
  if (fs.existsSync(filePath)) {
    try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) {}
  }
  const merged = deepMerge(existing, patch);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
}

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// ─── Templates directory (relative to this file) ────────────────────────────

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const TARGET_DIR    = process.cwd();

// ─── MCP Configs ─────────────────────────────────────────────────────────────

function claudeMcpConfig(token) {
  return {
    mcpServers: {
      notion: {
        command: 'npx',
        args: ['-y', '@notionhq/notion-mcp-server'],
        env: {
          OPENAPI_MCP_HEADERS: JSON.stringify({
            Authorization: `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
          }),
        },
      },
    },
  };
}

function geminiMcpConfig(token) {
  return {
    mcpServers: {
      notion: {
        httpUrl: 'https://mcp.notion.com/sse',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  };
}

// ─── Install functions ───────────────────────────────────────────────────────

function installClaude(dbId, token) {
  const replacements = { '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]' };

  copyFileWithReplacements(
    path.join(TEMPLATES_DIR, 'claude', 'CLAUDE.md'),
    path.join(TARGET_DIR, 'CLAUDE.md'),
    replacements
  );

  const initDest       = path.join(TARGET_DIR, 'init.sh');
  const startWorkDest  = path.join(TARGET_DIR, 'start-work.sh');
  copyFile(path.join(TEMPLATES_DIR, 'claude', 'init.sh'),       initDest);
  copyFile(path.join(TEMPLATES_DIR, 'claude', 'start-work.sh'), startWorkDest);
  makeExecutable(initDest);
  makeExecutable(startWorkDest);

  print(green('  ✔ CLAUDE.md'));
  print(green('  ✔ init.sh'));
  print(green('  ✔ start-work.sh'));

  if (token) {
    const settingsPath = path.join(TARGET_DIR, '.claude', 'settings.json');
    mergeJson(settingsPath, claudeMcpConfig(token));
    print(green('  ✔ .claude/settings.json  (Notion MCP configured)'));
  }
}

function installGemini(dbId, token) {
  const replacements = { '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]' };

  copyFileWithReplacements(
    path.join(TEMPLATES_DIR, 'gemini', 'GEMINI.md'),
    path.join(TARGET_DIR, 'GEMINI.md'),
    replacements
  );
  print(green('  ✔ GEMINI.md'));

  if (token) {
    // Project-level Gemini MCP config
    const settingsPath = path.join(TARGET_DIR, '.gemini', 'settings.json');
    mergeJson(settingsPath, geminiMcpConfig(token));
    print(green('  ✔ .gemini/settings.json  (Notion MCP configured)'));
  }
}

function installCopilot(dbId) {
  const replacements = { '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]' };

  copyFileWithReplacements(
    path.join(TEMPLATES_DIR, 'copilot', 'copilot-instructions.md'),
    path.join(TARGET_DIR, '.github', 'copilot-instructions.md'),
    replacements
  );
  print(green('  ✔ .github/copilot-instructions.md'));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  print('');
  print(bold(cyan('╔══════════════════════════════════════════╗')));
  print(bold(cyan('║      create-notion-agent  v1.0.0         ║')));
  print(bold(cyan('║  Notion-powered autonomous agent setup   ║')));
  print(bold(cyan('╚══════════════════════════════════════════╝')));
  print('');
  print(dim('Sets up a Notion-integrated AI agent workflow in the current directory.'));
  print(dim(`Target: ${TARGET_DIR}`));
  print('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── Step 1: Pick CLI(s) ──
  print(bold('Which AI CLI are you using?'));
  print('  1) Claude Code');
  print('  2) Gemini CLI');
  print('  3) GitHub Copilot');
  print('  4) All three');
  print('');
  const cliChoice = (await ask(rl, yellow('Enter choice [1-4]: '))).trim();

  const targets = new Set();
  if (cliChoice === '1') targets.add('claude');
  else if (cliChoice === '2') targets.add('gemini');
  else if (cliChoice === '3') targets.add('copilot');
  else if (cliChoice === '4') { targets.add('claude'); targets.add('gemini'); targets.add('copilot'); }
  else {
    print(yellow('Invalid choice — defaulting to Claude Code.'));
    targets.add('claude');
  }

  // ── Step 2: Notion Database ID ──
  print('');
  print(bold('Notion Database ID'));
  print(dim('  Found in your Notion database URL after the workspace name.'));
  print(dim('  Example: notion.so/myworkspace/[DATABASE_ID]?v=...'));
  print(dim('  Leave blank to fill in CLAUDE.md / GEMINI.md manually later.'));
  const dbId = (await ask(rl, yellow('Database ID (or Enter to skip): '))).trim();

  // ── Step 3: Notion API Token ──
  print('');
  print(bold('Notion API Token  (for MCP auto-configuration)'));
  print(dim('  Create one at https://www.notion.so/profile/integrations'));
  print(dim('  Leave blank to configure MCP manually later.'));
  const token = (await ask(rl, yellow('API Token (or Enter to skip): '))).trim();

  rl.close();

  // ── Step 4: Install ──
  print('');
  print(bold('Installing files...'));

  try {
    if (targets.has('claude'))  installClaude(dbId, token);
    if (targets.has('gemini'))  installGemini(dbId, token);
    if (targets.has('copilot')) installCopilot(dbId);
  } catch (err) {
    print('\n\x1b[31mError: ' + err.message + RESET);
    process.exit(1);
  }

  // ── Step 5: Next steps ──
  print('');
  print(bold(green('✅  Done!')));
  print('');
  print(bold('Next steps:'));

  if (targets.has('claude')) {
    print('');
    print(bold('  Claude Code:'));
    if (!dbId) print('  1. Open CLAUDE.md and replace [YOUR_NOTION_DATABASE_ID]');
    if (!token) {
      print(`  ${dbId ? '1' : '2'}. Add the Notion MCP server to Claude Code:`);
      print(dim('     claude mcp add notion-api -- npx -y @notionhq/notion-mcp-server'));
      print(dim('     (then set OPENAPI_MCP_HEADERS with your Notion token)'));
    }
    print(`  ${(!dbId || !token) ? ((!dbId && !token) ? '3' : '2') : '1'}. Run: chmod +x init.sh start-work.sh`);
    print(dim('     Then: ./start-work.sh'));
  }

  if (targets.has('gemini')) {
    print('');
    print(bold('  Gemini CLI:'));
    if (!dbId) print('  1. Open GEMINI.md and replace [YOUR_NOTION_DATABASE_ID]');
    if (!token) {
      print('  Configure Notion MCP in ~/.gemini/settings.json if not done automatically.');
    }
  }

  if (targets.has('copilot')) {
    print('');
    print(bold('  GitHub Copilot:'));
    print('  The workflow instructions are in .github/copilot-instructions.md');
    print(dim('  Copilot will automatically use these as workspace instructions.'));
  }

  print('');
  print(dim('Docs: https://github.com/Brendon20011007/auto-coding-agent'));
  print('');
}

main().catch(err => {
  process.stderr.write('Fatal: ' + err.message + '\n');
  process.exit(1);
});
