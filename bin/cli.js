#!/usr/bin/env node

'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Helpers ────────────────────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const DIM    = '\x1b[2m';

function print(msg) { process.stdout.write(msg + '\n'); }
function bold(s)   { return BOLD + s + RESET; }
function cyan(s)   { return CYAN + s + RESET; }
function green(s)  { return GREEN + s + RESET; }
function yellow(s) { return YELLOW + s + RESET; }
function red(s)    { return RED + s + RESET; }
function dim(s)    { return DIM + s + RESET; }

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// ─── Validations ─────────────────────────────────────────────────────────────

function verifyNotionDatabase(dbId, token) {
  return new Promise(resolve => {
    if (!dbId || !token) {
      resolve({ ok: false, skipped: true });
      return;
    }

    // Strip hyphens — Notion API accepts both formats
    const cleanId = dbId.replace(/-/g, '');
    const options = {
      hostname: 'api.notion.com',
      path: `/v1/databases/${cleanId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    };

    const req = https.request(options, res => {
      resolve({ ok: res.statusCode === 200, status: res.statusCode });
    });
    req.on('error', err => resolve({ ok: false, networkError: err.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, timeout: true }); });
    req.end();
  });
}

async function verifyObsidianVault(vaultPath, rl) {
  if (!vaultPath) return { ok: false, skipped: true };

  const vaultExists  = fs.existsSync(vaultPath);
  const dotObsidian  = vaultExists && fs.existsSync(path.join(vaultPath, '.obsidian'));

  if (vaultExists && dotObsidian) {
    return { ok: true };
  }

  if (!vaultExists) {
    print(yellow(`  ⚠  Vault path does not exist: ${vaultPath}`));
  } else {
    print(yellow(`  ⚠  Path exists but is not an Obsidian vault (.obsidian/ folder missing): ${vaultPath}`));
  }

  const answer = (await ask(rl, yellow('     Create vault directory structure now? [y/N]: '))).trim().toLowerCase();
  if (answer === 'y' || answer === 'yes') {
    fs.mkdirSync(path.join(vaultPath, '.obsidian'), { recursive: true });
    fs.mkdirSync(path.join(vaultPath, 'Architecture'), { recursive: true });
    fs.mkdirSync(path.join(vaultPath, 'Troubleshooting'), { recursive: true });
    print(green(`  ✔  Created vault at ${vaultPath}`));
    return { ok: true, created: true };
  }

  return { ok: false, declined: true };
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

function installClaude(dbId, token, vaultPath) {
  const replacements = {
    '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]',
    '{{OBSIDIAN_VAULT}}': vaultPath || '[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]',
  };

  copyFileWithReplacements(
    path.join(TEMPLATES_DIR, 'claude', 'CLAUDE.md'),
    path.join(TARGET_DIR, 'CLAUDE.md'),
    replacements
  );

  const initDest        = path.join(TARGET_DIR, 'init.sh');
  const startWorkDest   = path.join(TARGET_DIR, 'start-work.sh');
  const analyzeArchDest = path.join(TARGET_DIR, 'analyze-arch.sh');
  copyFileWithReplacements(path.join(TEMPLATES_DIR, 'claude', 'init.sh'),         initDest,        replacements);
  copyFile(path.join(TEMPLATES_DIR, 'claude', 'start-work.sh'),    startWorkDest);
  copyFile(path.join(TEMPLATES_DIR, 'claude', 'analyze-arch.sh'),  analyzeArchDest);
  makeExecutable(initDest);
  makeExecutable(startWorkDest);
  makeExecutable(analyzeArchDest);

  print(green('  ✔ CLAUDE.md'));
  print(green('  ✔ init.sh'));
  print(green('  ✔ start-work.sh'));
  print(green('  ✔ analyze-arch.sh'));

  // Install agent definitions
  const agentsTemplateDir = path.join(TEMPLATES_DIR, 'claude', 'agents');
  const agentsTargetDir   = path.join(TARGET_DIR, '.claude', 'agents');
  if (fs.existsSync(agentsTemplateDir)) {
    const agentFiles = fs.readdirSync(agentsTemplateDir).filter(f => f.endsWith('.md'));
    for (const file of agentFiles) {
      copyFile(
        path.join(agentsTemplateDir, file),
        path.join(agentsTargetDir, file)
      );
      const name = path.basename(file, '.md');
      print(green(`  ✔ .claude/agents/${file}  (${name} agent)`));
    }
  }

  if (token) {
    const settingsPath = path.join(TARGET_DIR, '.claude', 'settings.json');
    mergeJson(settingsPath, claudeMcpConfig(token));
    print(green('  ✔ .claude/settings.json  (Notion MCP configured)'));
  }
}

function installGemini(dbId, token, vaultPath) {
  const replacements = {
    '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]',
    '{{OBSIDIAN_VAULT}}': vaultPath || '[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]',
  };

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

function installCopilot(dbId, vaultPath) {
  const replacements = {
    '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]',
    '{{OBSIDIAN_VAULT}}': vaultPath || '[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]',
  };

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
  print(bold(cyan('║      create-notion-agent  v1.2.0         ║')));
  print(bold(cyan('║  Notion-powered autonomous agent setup   ║')));
  print(bold(cyan('╚══════════════════════════════════════════╝')));
  print('');
  print(dim('Sets up a Notion-integrated AI agent workflow in the current directory.'));
  print(dim(`Target: ${TARGET_DIR}`));
  print('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── Prompt 1: Pick CLI(s) ──
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

  // ── Prompt 2: Notion Database ID ──
  print('');
  print(bold('Notion Database ID'));
  print(dim('  Found in your Notion database URL after the workspace name.'));
  print(dim('  Example: notion.so/myworkspace/[DATABASE_ID]?v=...'));
  print(dim('  Leave blank to fill in the workflow files manually later.'));
  const dbId = (await ask(rl, yellow('Database ID (or Enter to skip): '))).trim();

  // ── Prompt 3: Notion API Token ──
  print('');
  print(bold('Notion API Token  (for MCP auto-configuration)'));
  print(dim('  Create one at https://www.notion.so/profile/integrations'));
  print(dim('  Leave blank to configure MCP manually later.'));
  const token = (await ask(rl, yellow('API Token (or Enter to skip): '))).trim();

  // ── Prompt 4: Obsidian Vault Path ──
  print('');
  print(bold('Obsidian Vault Path  (knowledge base for the agent)'));
  print(dim('  Absolute path to your local Obsidian vault directory.'));
  print(dim('  The agent reads Architecture/ and Troubleshooting/ notes before coding.'));
  print(dim('  Leave blank to configure manually later.'));
  const vaultPath = (await ask(rl, yellow('Vault path (or Enter to skip): '))).trim();

  // ── Validations ──
  print('');
  print(bold('Verifying configuration...'));

  // Validate Notion database
  if (dbId && token) {
    process.stdout.write(`  Checking Notion database... `);
    const notionResult = await verifyNotionDatabase(dbId, token);
    if (notionResult.ok) {
      print(green('✔  Database verified'));
    } else if (notionResult.timeout) {
      print(yellow('⚠  Request timed out — check your internet connection'));
    } else if (notionResult.networkError) {
      print(yellow(`⚠  Network error: ${notionResult.networkError}`));
    } else if (notionResult.status === 401) {
      print(red('✖  Invalid Notion token — MCP won\'t work until fixed'));
      print(dim('     Tip: ensure your integration has access to the database in Notion'));
    } else if (notionResult.status === 404) {
      print(red('✖  Database not found — double-check the Database ID in your Notion URL'));
      print(dim('     Tip: the ID is the 32-character segment before ?v= in the URL'));
    } else {
      print(yellow(`⚠  Unexpected response (HTTP ${notionResult.status}) — continuing anyway`));
    }
  } else if (!dbId || !token) {
    print(dim('  Notion verification skipped (no DB ID or token provided)'));
  }

  // Validate Obsidian vault
  if (vaultPath) {
    process.stdout.write(`  Checking Obsidian vault... `);
    const obsidianResult = await verifyObsidianVault(vaultPath, rl);
    if (obsidianResult.ok && !obsidianResult.created) {
      print(green('✔  Vault verified'));
    } else if (obsidianResult.skipped) {
      // no-op
    } else if (!obsidianResult.ok && obsidianResult.declined) {
      print(yellow('  ⚠  Vault not created — update OBSIDIAN_VAULT_PATH in init.sh after install'));
    }
  } else {
    print(dim('  Obsidian vault verification skipped (no path provided)'));
  }

  rl.close();

  // ── Install files ──
  print('');
  print(bold('Installing files...'));

  try {
    if (targets.has('claude'))  installClaude(dbId, token, vaultPath);
    if (targets.has('gemini'))  installGemini(dbId, token, vaultPath);
    if (targets.has('copilot')) installCopilot(dbId, vaultPath);
  } catch (err) {
    print('\n' + red('Error: ' + err.message));
    process.exit(1);
  }

  // ── Next steps ──
  print('');
  print(bold(green('✅  Done!')));
  print('');
  print(bold('Next steps:'));

  if (targets.has('claude')) {
    print('');
    print(bold('  Claude Code:'));
    let step = 1;
    if (!dbId)    print(`  ${step++}. Open CLAUDE.md and replace [YOUR_NOTION_DATABASE_ID]`);
    if (!vaultPath) print(`  ${step++}. Edit init.sh and set OBSIDIAN_VAULT_PATH to your vault`);
    if (!token) {
      print(`  ${step++}. Add the Notion MCP server:`);
      print(dim('       claude mcp add notion-api -- npx -y @notionhq/notion-mcp-server'));
      print(dim('       Then edit .claude/settings.json and add your token to OPENAPI_MCP_HEADERS'));
    }
    print(`  ${step++}. Run: chmod +x init.sh start-work.sh analyze-arch.sh && ./init.sh`);
    print(`  ${step++}. Start the agent: ./start-work.sh`);
    print(dim('       Or generate architecture docs first: ./analyze-arch.sh'));
  }

  if (targets.has('gemini')) {
    print('');
    print(bold('  Gemini CLI:'));
    let step = 1;
    if (!dbId) print(`  ${step++}. Open GEMINI.md and replace [YOUR_NOTION_DATABASE_ID]`);
    if (!token) print(`  ${step++}. Add Notion MCP to ~/.gemini/settings.json (see README for snippet)`);
    print(`  ${step++}. Run: ./init.sh  (sets up dependencies and Obsidian vault dirs)`);
    print(`  ${step++}. Start Gemini CLI in your project directory and it will follow GEMINI.md`);
  }

  if (targets.has('copilot')) {
    print('');
    print(bold('  GitHub Copilot:'));
    print('  1. Copilot reads .github/copilot-instructions.md automatically as workspace instructions');
    if (!dbId) print('  2. Open .github/copilot-instructions.md and replace [YOUR_NOTION_DATABASE_ID]');
  }

  print('');
  print(dim('Docs: https://github.com/SamuelQZQ/auto-coding-agent-demo'));
  print('');
}

main().catch(err => {
  process.stderr.write('Fatal: ' + err.message + '\n');
  process.exit(1);
});
