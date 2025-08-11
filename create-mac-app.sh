#!/bin/bash
# Creates a macOS .app bundle for stealth launching

APP_NAME="InvisibleAssistant"
APP_DIR="$APP_NAME.app"

# Create app structure
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Create the main executable
cat > "$APP_DIR/Contents/MacOS/$APP_NAME" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/../../.."

# Create directories
mkdir -p ~/Library/Application\ Support/interview-coder-v1/{temp,cache,screenshots,extra_screenshots} 2>/dev/null

# Build if needed
if [ ! -d "dist-electron" ]; then
    npm run build >/dev/null 2>&1
fi

# Launch silently
export NODE_ENV=production
exec npx electron ./dist-electron/main.js >/dev/null 2>&1
EOF

chmod +x "$APP_DIR/Contents/MacOS/$APP_NAME"

# Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.invisible.assistant</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
EOF

echo "Created $APP_DIR - double-click to launch invisibly!"
echo "To install to Applications: mv $APP_DIR /Applications/"