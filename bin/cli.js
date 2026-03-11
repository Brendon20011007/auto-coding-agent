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

function copyDirWithReplacements(srcDir, destDir, replacements) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath  = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirWithReplacements(srcPath, destPath, replacements);
    } else if (entry.name.endsWith('.md')) {
      copyFileWithReplacements(srcPath, destPath, replacements);
    } else {
      copyFile(srcPath, destPath);
      if (entry.name.endsWith('.sh')) makeExecutable(destPath);
    }
  }
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

  installSkills(dbId, vaultPath);
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

  installSkills(dbId, vaultPath);
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

  installSkills(dbId, vaultPath);
}

function installSkills(dbId, vaultPath) {
  const replacements = {
    '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]',
    '{{OBSIDIAN_VAULT}}': vaultPath || '[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]',
  };

  const skillsTemplateDir = path.join(TEMPLATES_DIR, 'skills');
  if (!fs.existsSync(skillsTemplateDir)) return;

  const skillNames = fs.readdirSync(skillsTemplateDir).filter(f =>
    fs.statSync(path.join(skillsTemplateDir, f)).isDirectory()
  );

  for (const skillName of skillNames) {
    const srcSkillDir = path.join(skillsTemplateDir, skillName);
    for (const prefix of ['.github', '.claude']) {
      copyDirWithReplacements(
        srcSkillDir,
        path.join(TARGET_DIR, prefix, 'skills', skillName),
        replacements
      );
    }
    print(green(`  ✔ .github/skills/${skillName}/  (+ .claude/skills/${skillName}/)`));
  }
}

// ─── Sync helpers ─────────────────────────────────────────────────────────────

/** Copy a file only if the destination does not already exist. Returns 'installed' or 'skipped'. */
function copyFileIfMissing(src, dest, replacements) {
  if (fs.existsSync(dest)) return 'skipped';
  if (replacements) {
    copyFileWithReplacements(src, dest, replacements);
  } else {
    copyFile(src, dest);
  }
  return 'installed';
}

/** Recursively copy a directory, skipping files that already exist. */
function copyDirIfMissing(srcDir, destDir, replacements) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath  = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirIfMissing(srcPath, destPath, replacements);
    } else if (entry.name.endsWith('.md')) {
      copyFileIfMissing(srcPath, destPath, replacements);
    } else {
      const status = copyFileIfMissing(srcPath, destPath, null);
      if (status === 'installed' && entry.name.endsWith('.sh')) makeExecutable(destPath);
    }
  }
}

/**
 * Detect which agent configs are already installed in TARGET_DIR.
 * Returns a Set containing 'claude', 'gemini', and/or 'copilot'.
 */
function detectInstalledTargets() {
  const found = new Set();
  if (fs.existsSync(path.join(TARGET_DIR, 'CLAUDE.md'))) found.add('claude');
  if (fs.existsSync(path.join(TARGET_DIR, 'GEMINI.md'))) found.add('gemini');
  if (fs.existsSync(path.join(TARGET_DIR, '.github', 'copilot-instructions.md'))) found.add('copilot');
  return found;
}

/**
 * Try to extract dbId and vaultPath from an already-installed config file.
 * Returns { dbId, vaultPath } — either may be null if not found or still a placeholder.
 */
function extractConfig(filePath) {
  let dbId = null;
  let vaultPath = null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Match a 32-char hex Notion DB ID (with optional hyphens)
    const dbMatch = content.match(/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i);
    if (dbMatch) dbId = dbMatch[1];

    // Match an absolute path: Windows C:\... or C:/...  or Unix /seg1/seg2/seg3+
    const vaultMatch = content.match(/([A-Za-z]:[\\\/][^\s"'`\[\]]{4,}|\/(?:[^\/\s"'`\[\]]+\/){2,}[^\/\s"'`\[\]]*)/);
    if (vaultMatch && !vaultMatch[1].includes('{{')) vaultPath = vaultMatch[1];
  } catch (_) {}
  return { dbId, vaultPath };
}

/** Install only missing Claude workflow files. */
function installClaudeMissing(dbId, token, vaultPath) {
  const replacements = {
    '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]',
    '{{OBSIDIAN_VAULT}}': vaultPath || '[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]',
  };

  const files = [
    { src: path.join(TEMPLATES_DIR, 'claude', 'init.sh'),        dest: path.join(TARGET_DIR, 'init.sh'),        reps: replacements, exe: true },
    { src: path.join(TEMPLATES_DIR, 'claude', 'start-work.sh'),  dest: path.join(TARGET_DIR, 'start-work.sh'),  reps: null,         exe: true },
    { src: path.join(TEMPLATES_DIR, 'claude', 'analyze-arch.sh'),dest: path.join(TARGET_DIR, 'analyze-arch.sh'),reps: null,         exe: true },
  ];

  for (const f of files) {
    const status = copyFileIfMissing(f.src, f.dest, f.reps);
    if (status === 'installed' && f.exe) makeExecutable(f.dest);
    const label = path.basename(f.dest);
    print(status === 'installed' ? green(`  ✔ ${label}`) : dim(`  ↩ ${label}  (already exists — skipped)`));
  }

  // Agent definitions
  const agentsTemplateDir = path.join(TEMPLATES_DIR, 'claude', 'agents');
  const agentsTargetDir   = path.join(TARGET_DIR, '.claude', 'agents');
  if (fs.existsSync(agentsTemplateDir)) {
    const agentFiles = fs.readdirSync(agentsTemplateDir).filter(f => f.endsWith('.md'));
    for (const file of agentFiles) {
      const dest   = path.join(agentsTargetDir, file);
      const status = copyFileIfMissing(path.join(agentsTemplateDir, file), dest, null);
      const name   = path.basename(file, '.md');
      print(status === 'installed'
        ? green(`  ✔ .claude/agents/${file}  (${name} agent)`)
        : dim(`  ↩ .claude/agents/${file}  (already exists — skipped)`));
    }
  }

  // MCP settings — only write if file doesn't already exist
  if (token) {
    const settingsPath = path.join(TARGET_DIR, '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      mergeJson(settingsPath, claudeMcpConfig(token));
      print(green('  ✔ .claude/settings.json  (Notion MCP configured)'));
    } else {
      print(dim('  ↩ .claude/settings.json  (already exists — skipped)'));
    }
  }

  installSkillsMissing(dbId, vaultPath);
}

/** Install only missing Gemini workflow files. */
function installGeminiMissing(dbId, token, vaultPath) {
  const replacements = {
    '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]',
    '{{OBSIDIAN_VAULT}}': vaultPath || '[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]',
  };

  if (token) {
    const settingsPath = path.join(TARGET_DIR, '.gemini', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      mergeJson(settingsPath, geminiMcpConfig(token));
      print(green('  ✔ .gemini/settings.json  (Notion MCP configured)'));
    } else {
      print(dim('  ↩ .gemini/settings.json  (already exists — skipped)'));
    }
  }

  installSkillsMissing(dbId, vaultPath);
}

/** Install only missing Copilot workflow files. */
function installCopilotMissing(dbId, vaultPath) {
  installSkillsMissing(dbId, vaultPath);
}

/** Install skills, skipping any skill files that already exist. */
function installSkillsMissing(dbId, vaultPath) {
  const replacements = {
    '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]',
    '{{OBSIDIAN_VAULT}}': vaultPath || '[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]',
  };

  const skillsTemplateDir = path.join(TEMPLATES_DIR, 'skills');
  if (!fs.existsSync(skillsTemplateDir)) return;

  const skillNames = fs.readdirSync(skillsTemplateDir).filter(f =>
    fs.statSync(path.join(skillsTemplateDir, f)).isDirectory()
  );

  for (const skillName of skillNames) {
    const srcSkillDir = path.join(skillsTemplateDir, skillName);
    let anyInstalled = false;
    for (const prefix of ['.github', '.claude']) {
      const destDir = path.join(TARGET_DIR, prefix, 'skills', skillName);
      // Check if skill dir already fully exists
      const mainSkillFile = path.join(destDir, 'SKILL.md');
      if (!fs.existsSync(mainSkillFile)) {
        copyDirIfMissing(srcSkillDir, destDir, replacements);
        anyInstalled = true;
      }
    }
    print(anyInstalled
      ? green(`  ✔ .github/skills/${skillName}/  (+ .claude/skills/${skillName}/)`)
      : dim(`  ↩ skills/${skillName}/  (already exists — skipped)`));
  }
}

// ─── Update Main ─────────────────────────────────────────────────────────────

/**
 * `npx create-notion-agent update`
 *
 * Force-overwrites all instruction & skill files with the latest versions from
 * the bundled templates while preserving existing MCP settings, shell scripts,
 * and anything else the user may have customised.
 *
 * Files UPDATED (overwritten):
 *   CLAUDE.md, GEMINI.md, .github/copilot-instructions.md
 *   .claude/agents/*.md
 *   .github/skills/**  and  .claude/skills/**
 *
 * Files PRESERVED (never touched):
 *   .claude/settings.json, .gemini/settings.json
 *   init.sh, start-work.sh, analyze-arch.sh
 */
async function updateMain() {
  const VERSION = '1.7.3';

  print('');
  print(bold(cyan('╔══════════════════════════════════════════╗')));
  print(bold(cyan(`║      create-notion-agent  v${VERSION}        ║`)));
  print(bold(cyan('║   update — refresh instruction files     ║')));
  print(bold(cyan('╚══════════════════════════════════════════╝')));
  print('');
  print(dim('Overwrites CLAUDE.md / copilot-instructions.md / GEMINI.md and all skill'));
  print(dim('files with the latest bundled templates.  MCP settings are never touched.'));
  print(dim(`Target: ${TARGET_DIR}`));
  print('');

  // ── Detect installed targets ──
  const targets = detectInstalledTargets();
  if (targets.size === 0) {
    print(red('✖  No agent config found in this directory.'));
    print(dim('   Run npx create-notion-agent first to do a full setup.'));
    print('');
    process.exit(1);
  }

  print(bold('Detected agent configs:'));
  for (const t of targets) print(green(`  ✔ ${t}`));
  print('');

  // ── Recover existing DB ID and vault path ──
  let dbId = null;
  let vaultPath = null;

  const configCandidates = [
    path.join(TARGET_DIR, 'CLAUDE.md'),
    path.join(TARGET_DIR, 'GEMINI.md'),
    path.join(TARGET_DIR, '.github', 'copilot-instructions.md'),
  ];
  for (const f of configCandidates) {
    if (fs.existsSync(f)) {
      const extracted = extractConfig(f);
      if (!dbId && extracted.dbId) dbId = extracted.dbId;
      if (!vaultPath && extracted.vaultPath) vaultPath = extracted.vaultPath;
    }
  }

  if (dbId)      print(dim(`  DB ID recovered:     ${dbId}`));
  else           print(yellow('  ⚠  Notion DB ID not found — placeholders will be used'));
  if (vaultPath) print(dim(`  Vault path recovered: ${vaultPath}`));
  else           print(yellow('  ⚠  Obsidian vault path not found — placeholders will be used'));
  print('');

  const replacements = {
    '{{DB_ID}}': dbId || '[YOUR_NOTION_DATABASE_ID]',
    '{{OBSIDIAN_VAULT}}': vaultPath || '[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]',
  };

  // ── Confirm ──
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  print(bold(yellow('⚠  This will overwrite your current instruction files with the latest templates.')));
  print(dim('   Shell scripts (init.sh, start-work.sh) and MCP settings.json are NOT touched.'));
  print('');
  const confirm = (await ask(rl, yellow('Proceed? [y/N]: '))).trim().toLowerCase();
  rl.close();

  if (confirm !== 'y' && confirm !== 'yes') {
    print(yellow('\nAborted — no files were changed.'));
    print('');
    process.exit(0);
  }

  print('');
  print(bold('Updating files...'));

  let updatedCount = 0;

  function overwrite(src, dest, reps) {
    if (!fs.existsSync(src)) return;
    if (reps) {
      copyFileWithReplacements(src, dest, reps);
    } else {
      copyFile(src, dest);
    }
    print(green(`  ✔ ${path.relative(TARGET_DIR, dest)}`));
    updatedCount++;
  }

  function overwriteDir(srcDir, destDir, reps) {
    if (!fs.existsSync(srcDir)) return;
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath  = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        overwriteDir(srcPath, destPath, reps);
      } else if (entry.name.endsWith('.md')) {
        overwrite(srcPath, destPath, reps);
      } else {
        // non-md files (scripts etc.) in skill subdirs — overwrite as-is
        copyFile(srcPath, destPath);
        if (entry.name.endsWith('.sh')) makeExecutable(destPath);
        print(green(`  ✔ ${path.relative(TARGET_DIR, destPath)}`));
        updatedCount++;
      }
    }
  }

  try {
    // ── Claude instruction file + agents ──
    if (targets.has('claude')) {
      overwrite(
        path.join(TEMPLATES_DIR, 'claude', 'CLAUDE.md'),
        path.join(TARGET_DIR, 'CLAUDE.md'),
        replacements
      );

      const agentsTemplateDir = path.join(TEMPLATES_DIR, 'claude', 'agents');
      const agentsTargetDir   = path.join(TARGET_DIR, '.claude', 'agents');
      if (fs.existsSync(agentsTemplateDir)) {
        for (const file of fs.readdirSync(agentsTemplateDir).filter(f => f.endsWith('.md'))) {
          overwrite(
            path.join(agentsTemplateDir, file),
            path.join(agentsTargetDir, file),
            null
          );
        }
      }
    }

    // ── Gemini instruction file ──
    if (targets.has('gemini')) {
      overwrite(
        path.join(TEMPLATES_DIR, 'gemini', 'GEMINI.md'),
        path.join(TARGET_DIR, 'GEMINI.md'),
        replacements
      );
    }

    // ── Copilot instruction file ──
    if (targets.has('copilot')) {
      overwrite(
        path.join(TEMPLATES_DIR, 'copilot', 'copilot-instructions.md'),
        path.join(TARGET_DIR, '.github', 'copilot-instructions.md'),
        replacements
      );
    }

    // ── Skills (all detected targets share the same skill templates) ──
    const skillsTemplateDir = path.join(TEMPLATES_DIR, 'skills');
    if (fs.existsSync(skillsTemplateDir)) {
      const skillNames = fs.readdirSync(skillsTemplateDir).filter(f =>
        fs.statSync(path.join(skillsTemplateDir, f)).isDirectory()
      );
      for (const skillName of skillNames) {
        const srcSkillDir = path.join(skillsTemplateDir, skillName);
        for (const prefix of ['.github', '.claude']) {
          overwriteDir(
            srcSkillDir,
            path.join(TARGET_DIR, prefix, 'skills', skillName),
            replacements
          );
        }
      }

      // ── Remove obsolete skill directories no longer present in templates ──
      const currentSkillNames = new Set(skillNames);
      for (const prefix of ['.github', '.claude']) {
        const skillsDir = path.join(TARGET_DIR, prefix, 'skills');
        if (!fs.existsSync(skillsDir)) continue;
        for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (!currentSkillNames.has(entry.name)) {
            fs.rmSync(path.join(skillsDir, entry.name), { recursive: true, force: true });
            print(yellow(`  ✖ ${prefix}/skills/${entry.name}/  (removed — no longer in current templates)`));
            updatedCount++;
          }
        }
      }
    }
  } catch (err) {
    print('\n' + red('Error: ' + err.message));
    process.exit(1);
  }

  print('');
  print(bold(green(`✅  Update complete!  (${updatedCount} file${updatedCount !== 1 ? 's' : ''} refreshed)`)));
  print(dim('   Run `npx create-notion-agent sync` to fill in any newly added scaffold files.'));
  print('');
}

// ─── Sync Main ───────────────────────────────────────────────────────────────

async function syncMain() {
  print('');
  print(bold(cyan('╔══════════════════════════════════════════╗')));
  print(bold(cyan('║      create-notion-agent  v1.7.3         ║')));
  print(bold(cyan('║         sync — fill in missing files     ║')));
  print(bold(cyan('╚══════════════════════════════════════════╝')));
  print('');
  print(dim('Detects existing agent config and installs any missing workflow files + skills.'));
  print(dim(`Target: ${TARGET_DIR}`));
  print('');

  // ── Detect installed targets ──
  const targets = detectInstalledTargets();
  if (targets.size === 0) {
    print(red('✖  No agent config found in this directory.'));
    print(dim('   Run npx create-notion-agent first to do a full setup.'));
    print('');
    process.exit(1);
  }

  print(bold('Detected agent configs:'));
  for (const t of targets) print(green(`  ✔ ${t}`));
  print('');

  // ── Extract existing config ──
  let dbId = null;
  let vaultPath = null;

  const configCandidates = [
    path.join(TARGET_DIR, 'CLAUDE.md'),
    path.join(TARGET_DIR, 'GEMINI.md'),
    path.join(TARGET_DIR, '.github', 'copilot-instructions.md'),
  ];
  for (const f of configCandidates) {
    if (fs.existsSync(f)) {
      const extracted = extractConfig(f);
      if (!dbId && extracted.dbId) dbId = extracted.dbId;
      if (!vaultPath && extracted.vaultPath) vaultPath = extracted.vaultPath;
    }
  }

  if (dbId)      print(dim(`  DB ID recovered:    ${dbId}`));
  else           print(yellow('  ⚠  Notion DB ID not found in existing files — placeholders will be used'));
  if (vaultPath) print(dim(`  Vault path recovered: ${vaultPath}`));
  else           print(yellow('  ⚠  Obsidian vault path not found in existing files — placeholders will be used'));
  print('');

  // ── Optional: Notion token (can't be recovered from files) ──
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  print(bold('Notion API Token  (optional — only needed to write MCP settings.json)'));
  print(dim('  Leave blank to skip MCP settings (you can configure manually later).'));
  const token = (await ask(rl, yellow('API Token (or Enter to skip): '))).trim();
  rl.close();

  // ── Sync files ──
  print('');
  print(bold('Syncing missing files...'));

  try {
    if (targets.has('claude'))  installClaudeMissing(dbId, token, vaultPath);
    if (targets.has('gemini'))  installGeminiMissing(dbId, token, vaultPath);
    if (targets.has('copilot')) installCopilotMissing(dbId, vaultPath);
  } catch (err) {
    print('\n' + red('Error: ' + err.message));
    process.exit(1);
  }

  print('');
  print(bold(green('✅  Sync complete!')));
  print(dim('   Files marked ↩ already existed and were not modified.'));
  print('');
}


// ─── Force Main ──────────────────────────────────────────────────────────────

async function forceMain() {
  const VERSION = '1.7.3';

  print('');
  print(bold(cyan('╔══════════════════════════════════════════╗')));
  print(bold(cyan(`║      create-notion-agent  v${VERSION}        ║`)));
  print(bold(cyan('║   force — hard reset ALL agent files     ║')));
  print(bold(cyan('╚══════════════════════════════════════════╝')));
  print('');
  print(dim('Overwrites EVERY agent file — including shell scripts and MCP settings.'));
  print(dim('Use this to recover from a broken install or to reset to the latest templates.'));
  print(dim(`Target: ${TARGET_DIR}`));
  print('');

  // ── Detect installed targets ──
  const targets = detectInstalledTargets();
  if (targets.size === 0) {
    print(red('✖  No agent config found in this directory.'));
    print(dim('   Run npx create-notion-agent first to do a full setup.'));
    print('');
    process.exit(1);
  }

  print(bold('Detected agent configs:'));
  for (const t of targets) print(green(`  ✔ ${t}`));
  print('');

  // ── Recover existing config ──
  let dbId = null;
  let vaultPath = null;
  const configCandidates = [
    path.join(TARGET_DIR, 'CLAUDE.md'),
    path.join(TARGET_DIR, 'GEMINI.md'),
    path.join(TARGET_DIR, '.github', 'copilot-instructions.md'),
  ];
  for (const f of configCandidates) {
    if (fs.existsSync(f)) {
      const extracted = extractConfig(f);
      if (!dbId && extracted.dbId) dbId = extracted.dbId;
      if (!vaultPath && extracted.vaultPath) vaultPath = extracted.vaultPath;
    }
  }

  if (dbId)      print(dim(`  DB ID recovered:      ${dbId}`));
  else           print(yellow('  ⚠  Notion DB ID not found — placeholders will be used'));
  if (vaultPath) print(dim(`  Vault path recovered: ${vaultPath}`));
  else           print(yellow('  ⚠  Obsidian vault path not found — placeholders will be used'));
  print('');

  // ── Optional Notion token ──
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  print(bold('Notion API Token  (required to reset MCP settings.json)'));
  print(dim('  Leave blank to skip resetting MCP settings.'));
  const token = (await ask(rl, yellow('API Token (or Enter to skip): '))).trim();

  // ── Confirm ──
  print('');
  print(bold(red('⚠  HARD RESET: This will overwrite ALL files including init.sh, start-work.sh,')));
  print(bold(red('   analyze-arch.sh, and .claude/settings.json / .gemini/settings.json.')));
  print(bold(red('   Any local customisations will be permanently lost.')));
  print('');
  const confirm = (await ask(rl, red('Type "force" to confirm hard reset: '))).trim();
  rl.close();

  if (confirm !== 'force') {
    print(yellow('\nAborted — no files were changed.'));
    print('');
    process.exit(0);
  }

  print('');
  print(bold('Force-resetting all agent files...'));

  try {
    if (targets.has('claude'))  installClaude(dbId, token, vaultPath);
    if (targets.has('gemini'))  installGemini(dbId, token, vaultPath);
    if (targets.has('copilot')) installCopilot(dbId, vaultPath);
  } catch (err) {
    print('\n' + red('Error: ' + err.message));
    process.exit(1);
  }

  print('');
  print(bold(green('✅  Force reset complete! All agent files restored to latest templates.')));
  print(dim('   Run `npx create-notion-agent sync` to fill in any newly added scaffold files.'));
  print('');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  print('');
  print(bold(cyan('╔══════════════════════════════════════════╗')));
  print(bold(cyan('║      create-notion-agent  v1.7.3         ║')));
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
    print('  2. Two Agent Skills installed (.github/skills/ + .claude/skills/):');
    print(dim('       • run-next-task   → say "start working" or "run the next task"'));
    print(dim('       • add-coding-task → say "add a task: [description]"'));
    if (!dbId) print('  3. Open .github/copilot-instructions.md and replace [YOUR_NOTION_DATABASE_ID]');
  }

  print('');
  print(dim('Docs: https://github.com/SamuelQZQ/auto-coding-agent-demo'));
  print('');
}

const subcommand = process.argv[2];
if (subcommand === 'sync') {
  syncMain().catch(err => {
    process.stderr.write('Fatal: ' + err.message + '\n');
    process.exit(1);
  });
} else if (subcommand === 'update' || subcommand === 'upgrade') {
  updateMain().catch(err => {
    process.stderr.write('Fatal: ' + err.message + '\n');
    process.exit(1);
  });
} else if (subcommand === 'force') {
  forceMain().catch(err => {
    process.stderr.write('Fatal: ' + err.message + '\n');
    process.exit(1);
  });
} else {
  main().catch(err => {
    process.stderr.write('Fatal: ' + err.message + '\n');
    process.exit(1);
  });
}
