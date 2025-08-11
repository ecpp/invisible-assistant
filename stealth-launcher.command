#!/bin/bash
# Silent launcher for macOS - double-click to run

# Get script directory
cd "$(dirname "$0")"

# Create required directories silently
mkdir -p ~/Library/Application\ Support/interview-coder-v1/temp 2>/dev/null
mkdir -p ~/Library/Application\ Support/interview-coder-v1/cache 2>/dev/null
mkdir -p ~/Library/Application\ Support/interview-coder-v1/screenshots 2>/dev/null
mkdir -p ~/Library/Application\ Support/interview-coder-v1/extra_screenshots 2>/dev/null

# Clean and build silently
rm -rf dist dist-electron 2>/dev/null
rm -f .env 2>/dev/null
npm run build >/dev/null 2>&1

# Launch invisibly and close terminal
export NODE_ENV=production
nohup npx electron ./dist-electron/main.js >/dev/null 2>&1 &
osascript -e 'tell application "Terminal" to quit' &
exit