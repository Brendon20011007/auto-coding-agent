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

echo "✅ Environment initialization complete."
