#!/usr/bin/env node

/**
 * Creates a desktop shortcut for stealth launching
 * Run: node create-desktop-shortcut.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const desktopPath = path.join(os.homedir(), 'Desktop');

if (process.platform === 'win32') {
    // Create Windows shortcut (.lnk requires additional tools, so we use .bat)
    const shortcutPath = path.join(desktopPath, 'InvisibleAssistant.bat');
    const content = `@echo off
start /min wscript.exe "${path.join(__dirname, 'stealth-launcher.vbs')}"
exit`;
    
    fs.writeFileSync(shortcutPath, content);
    console.log(`Created shortcut: ${shortcutPath}`);
    
} else if (process.platform === 'darwin') {
    // Create macOS alias
    const shortcutPath = path.join(desktopPath, 'InvisibleAssistant.command');
    const content = `#!/bin/bash
cd "${__dirname}"
./stealth-launcher.command`;
    
    fs.writeFileSync(shortcutPath, content);
    fs.chmodSync(shortcutPath, '755');
    console.log(`Created shortcut: ${shortcutPath}`);
    
} else {
    // Create Linux desktop entry
    const shortcutPath = path.join(desktopPath, 'invisible-assistant.desktop');
    const content = `[Desktop Entry]
Type=Application
Name=Invisible Assistant
Exec=node ${path.join(__dirname, 'stealth-launcher.js')}
Path=${__dirname}
Terminal=false
Icon=${path.join(__dirname, 'icon.png')}
Categories=Utility;`;
    
    fs.writeFileSync(shortcutPath, content);
    fs.chmodSync(shortcutPath, '755');
    console.log(`Created shortcut: ${shortcutPath}`);
}

console.log('Double-click the shortcut on your desktop to launch invisibly!');