#!/bin/bash

echo "🔄 Initializing environment..."

cd hello-nextjs || { echo "Directory hello-nextjs not found! Exiting."; exit 1; }

echo "📦 Checking and installing dependencies..."
npm install

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Development server is already running on port 3000."
else
    echo "🚀 Starting development server in the background..."
    npm run dev > dev.log 2>&1 &
    sleep 5
    echo "✅ Development server started."
fi

# --- Obsidian Vault Setup ---
OBSIDIAN_VAULT_PATH="[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]"

if [ -n "$OBSIDIAN_VAULT_PATH" ] && [ "$OBSIDIAN_VAULT_PATH" != "[YOUR_OBSIDIAN_VAULT_ABSOLUTE_PATH]" ]; then
    if [ -d "$OBSIDIAN_VAULT_PATH" ]; then
        echo "📚 Setting up Obsidian vault structure..."
        mkdir -p "$OBSIDIAN_VAULT_PATH/Architecture"
        mkdir -p "$OBSIDIAN_VAULT_PATH/Troubleshooting"
        echo "✅ Obsidian vault directories ready."
    else
        echo "⚠️  Obsidian vault path not found: $OBSIDIAN_VAULT_PATH"
        echo "   Create the directory or update OBSIDIAN_VAULT_PATH in init.sh."
    fi
else
    echo "ℹ️  Obsidian vault path not configured. Edit OBSIDIAN_VAULT_PATH in init.sh to enable."
fi

echo "✅ Environment initialization complete."
