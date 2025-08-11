// Test script to verify monitor detection functionality
const { app, BrowserWindow, screen } = require('electron');

function testMonitorDetection() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  
  console.log('\n=== MONITOR DETECTION TEST ===\n');
  console.log(`Total monitors detected: ${displays.length}`);
  console.log(`Primary display ID: ${primaryDisplay.id}`);
  console.log('\nMonitor Details:');
  
  displays.forEach((display, index) => {
    const isPrimary = display.id === primaryDisplay.id;
    console.log(`\nMonitor ${index + 1}${isPrimary ? ' (PRIMARY)' : ''}:`);
    console.log(`  ID: ${display.id}`);
    console.log(`  Bounds: ${JSON.stringify(display.bounds)}`);
    console.log(`  Work Area: ${JSON.stringify(display.workArea)}`);
    console.log(`  Scale Factor: ${display.scaleFactor}`);
    console.log(`  Rotation: ${display.rotation}`);
    console.log(`  Internal: ${display.internal}`);
  });
  
  // Test monitor ID generation like in our MonitorHelper
  console.log('\n=== GENERATED MONITOR IDs ===\n');
  displays.forEach((display, index) => {
    const generatedId = `${display.bounds.x}_${display.bounds.y}_${display.bounds.width}_${display.bounds.height}`;
    console.log(`Monitor ${index + 1}: ${generatedId}`);
  });
  
  // Listen for display changes
  console.log('\n=== LISTENING FOR MONITOR CHANGES ===');
  console.log('Try connecting/disconnecting a monitor to see events...\n');
  
  screen.on('display-added', (event, newDisplay) => {
    console.log('📺 DISPLAY ADDED:', newDisplay.id);
    console.log('   Bounds:', newDisplay.bounds);
  });
  
  screen.on('display-removed', (event, oldDisplay) => {
    console.log('❌ DISPLAY REMOVED:', oldDisplay.id);
  });
  
  screen.on('display-metrics-changed', (event, display, changedMetrics) => {
    console.log('📏 DISPLAY METRICS CHANGED:', display.id);
    console.log('   Changed:', changedMetrics);
  });
  
  // Create test window on each monitor
  console.log('\n=== CREATING TEST WINDOWS ===\n');
  
  displays.forEach((display, index) => {
    setTimeout(() => {
      const testWindow = new BrowserWindow({
        width: 400,
        height: 200,
        x: display.bounds.x + 50,
        y: display.bounds.y + 50,
        title: `Test Window - Monitor ${index + 1}`,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      testWindow.loadURL(`data:text/html,
        <html>
          <body style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: Arial; padding: 20px;">
            <h1>Monitor ${index + 1}</h1>
            <p>ID: ${display.id}</p>
            <p>Resolution: ${display.bounds.width} x ${display.bounds.height}</p>
            <p>Position: (${display.bounds.x}, ${display.bounds.y})</p>
            <p>Scale: ${display.scaleFactor}x</p>
            ${display.id === primaryDisplay.id ? '<p><strong>PRIMARY DISPLAY</strong></p>' : ''}
          </body>
        </html>
      `);
      
      console.log(`Created test window on Monitor ${index + 1}`);
      
      // Close window after 10 seconds
      setTimeout(() => {
        if (!testWindow.isDestroyed()) {
          testWindow.close();
          console.log(`Closed test window on Monitor ${index + 1}`);
        }
      }, 10000);
    }, index * 500); // Stagger window creation
  });
  
  // Keep app running for 15 seconds to allow testing
  setTimeout(() => {
    console.log('\n=== TEST COMPLETE ===');
    app.quit();
  }, 15000);
}

app.whenReady().then(() => {
  testMonitorDetection();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});