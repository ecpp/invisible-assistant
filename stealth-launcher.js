#!/usr/bin/env node

/**
 * Cross-platform stealth launcher
 * Run with: node stealth-launcher.js
 * Or make executable: chmod +x stealth-launcher.js && ./stealth-launcher.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine app data directory based on platform
function getAppDataPath() {
    switch (process.platform) {
        case 'win32':
            return path.join(process.env.APPDATA, 'codeinterviewassist');
        case 'darwin':
            return path.join(os.homedir(), 'Library', 'Application Support', 'interview-coder-v1');
        default:
            return path.join(os.homedir(), '.config', 'codeinterviewassist');
    }
}

// Create required directories
function createDirectories() {
    const appDataPath = getAppDataPath();
    const dirs = ['temp', 'cache', 'screenshots', 'extra_screenshots'];
    
    dirs.forEach(dir => {
        const fullPath = path.join(appDataPath, dir);
        fs.mkdirSync(fullPath, { recursive: true });
    });
}

// Build the application silently
function buildApp() {
    return new Promise((resolve, reject) => {
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const build = spawn(npm, ['run', 'build'], {
            stdio: 'ignore',
            cwd: __dirname
        });
        
        build.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Build failed with code ${code}`));
            }
        });
    });
}

// Launch the application invisibly
function launchApp() {
    const electron = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const electronPath = path.join(__dirname, 'dist-electron', 'main.js');
    
    const app = spawn(electron, ['electron', electronPath], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, NODE_ENV: 'production' },
        cwd: __dirname
    });
    
    app.unref();
}

// Main execution
async function main() {
    try {
        // Create directories
        createDirectories();
        
        // Clean old builds
        const distPath = path.join(__dirname, 'dist');
        const distElectronPath = path.join(__dirname, 'dist-electron');
        
        if (fs.existsSync(distPath)) {
            fs.rmSync(distPath, { recursive: true, force: true });
        }
        if (fs.existsSync(distElectronPath)) {
            fs.rmSync(distElectronPath, { recursive: true, force: true });
        }
        
        // Build and launch
        await buildApp();
        launchApp();
        
        // Exit this launcher
        process.exit(0);
    } catch (error) {
        // Silent failure - no console output
        process.exit(1);
    }
}

// Run
main();