#!/bin/bash

echo "🔄 Initializing environment..."

# ─── Project Detection ───────────────────────────────────────────────────────
# Find the app directory: look for a recognised config file in subdirectories,
# or fall back to the current directory if config is at the root.

detect_project_dir() {
  for dir in */ .; do
    dir="${dir%/}"
    if [ -f "$dir/package.json" ] || \
       [ -f "$dir/pyproject.toml" ] || \
       [ -f "$dir/setup.py" ] || \
       [ -f "$dir/requirements.txt" ] || \
       [ -f "$dir/go.mod" ] || \
       [ -f "$dir/Cargo.toml" ] || \
       [ -f "$dir/Makefile" ]; then
      echo "$dir"
      return
    fi
  done
  echo "."
}

PROJECT_DIR=$(detect_project_dir)
echo "📁 Project directory detected: $PROJECT_DIR"
cd "$PROJECT_DIR" || { echo "❌ Cannot enter project directory: $PROJECT_DIR"; exit 1; }

# ─── Install Dependencies ─────────────────────────────────────────────────────

if [ -f "package.json" ]; then
  echo "📦 Node.js project — installing dependencies..."
  npm install
elif [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
  echo "📦 Python project — installing dependencies..."
  pip install -e . --quiet
elif [ -f "requirements.txt" ]; then
  echo "📦 Python project — installing from requirements.txt..."
  pip install -r requirements.txt --quiet
elif [ -f "go.mod" ]; then
  echo "📦 Go project — downloading modules..."
  go mod download
elif [ -f "Cargo.toml" ]; then
  echo "📦 Rust project — fetching crates..."
  cargo fetch
elif [ -f "Makefile" ] && grep -q "^install:" Makefile 2>/dev/null; then
  echo "📦 Makefile project — running make install..."
  make install
else
  echo "ℹ️  No recognised dependency manifest found — skipping install step."
fi
echo "✅ Dependencies ready."

# ─── Obsidian Vault Setup ─────────────────────────────────────────────────────
OBSIDIAN_VAULT_PATH="[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]"

if [ -n "$OBSIDIAN_VAULT_PATH" ] && [ "$OBSIDIAN_VAULT_PATH" != "[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]" ]; then
    if [ -d "$OBSIDIAN_VAULT_PATH" ]; then
        echo "📚 Setting up Obsidian vault structure..."
        mkdir -p "$OBSIDIAN_VAULT_PATH/Architecture"
        mkdir -p "$OBSIDIAN_VAULT_PATH/Troubleshooting"
        echo "✅ Obsidian vault directories ready: $OBSIDIAN_VAULT_PATH"
    else
        echo "⚠️  Obsidian vault path not found: $OBSIDIAN_VAULT_PATH"
        echo "   Open Obsidian and create a vault at that path, or update OBSIDIAN_VAULT_PATH above."
    fi
else
    echo "ℹ️  Obsidian vault path not configured. Edit OBSIDIAN_VAULT_PATH in init.sh to enable."
fi

echo "✅ Environment initialization complete."
