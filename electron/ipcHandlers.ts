// ipcHandlers.ts

import { ipcMain, shell, dialog } from "electron"
import { randomBytes } from "crypto"
import { IIpcHandlerDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { conversationManager } from "./ConversationManager"
import { monitorHelper } from "./MonitorHelper"

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  console.log("Initializing IPC handlers")
  
  // Conversation handlers
  ipcMain.handle("conversation-create", async (_event, context, problemId) => {
    try {
      const session = conversationManager.createSession(context, problemId);
      return { success: true, session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("conversation-send-message", async (_event, sessionId, message) => {
    try {
      const response = await conversationManager.sendMessage(sessionId, message);
      return response;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("conversation-get", (_event, sessionId) => {
    try {
      const session = conversationManager.getSession(sessionId);
      return { success: true, session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("conversation-list", () => {
    try {
      const sessions = conversationManager.listSessions();
      const activeSessionId = conversationManager.getActiveSessionId();
      return { success: true, sessions, activeSessionId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("conversation-delete", (_event, sessionId) => {
    try {
      const result = conversationManager.deleteSession(sessionId);
      return { success: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("conversation-set-active", (_event, sessionId) => {
    try {
      const result = conversationManager.setActiveSession(sessionId);
      return { success: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("conversation-get-active", () => {
    try {
      const session = conversationManager.getActiveSession();
      const sessionId = conversationManager.getActiveSessionId();
      return { success: true, session, sessionId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("conversation-cleanup", (_event, maxSessions = 50) => {
    try {
      conversationManager.cleanupOldSessions(maxSessions);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Configuration handlers
  ipcMain.handle("get-config", () => {
    return configHelper.loadConfig();
  })

  ipcMain.handle("update-config", (_event, updates) => {
    return configHelper.updateConfig(updates);
  })

  ipcMain.handle("check-api-key", () => {
    return configHelper.hasApiKey();
  })
  
  ipcMain.handle("validate-api-key", async (_event, apiKey) => {
    // First check the format
    if (!configHelper.isValidApiKeyFormat(apiKey)) {
      return { 
        valid: false, 
        error: "Invalid API key format. OpenAI API keys start with 'sk-'" 
      };
    }
    
    // Then test the API key with OpenAI
    const result = await configHelper.testApiKey(apiKey);
    return result;
  })

  // Credits handlers
  ipcMain.handle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // Set the credits in a way that ensures atomicity
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      console.error("Error setting initial credits:", error)
      throw error
    }
  })

  ipcMain.handle("decrement-credits", async () => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      const currentCredits = await mainWindow.webContents.executeJavaScript(
        "window.__CREDITS__"
      )
      if (currentCredits > 0) {
        const newCredits = currentCredits - 1
        await mainWindow.webContents.executeJavaScript(
          `window.__CREDITS__ = ${newCredits}`
        )
        mainWindow.webContents.send("credits-updated", newCredits)
      }
    } catch (error) {
      console.error("Error decrementing credits:", error)
    }
  })

  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path)
  })

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path)
  })

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    // Check for API key before processing
    if (!configHelper.hasApiKey()) {
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
      }
      return;
    }
    
    await deps.processingHelper?.processScreenshots()
  })

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = []
      const currentView = deps.getView()

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue()
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      } else {
        const extraQueue = deps.getExtraScreenshotQueue()
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      }

      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot()
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        console.error("Error triggering screenshot:", error)
        return { error: "Failed to trigger screenshot" }
      }
    }
    return { error: "No main window available" }
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      const preview = await deps.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      return { error: "Failed to take screenshot" }
    }
  })

  // Auth-related handlers removed

  ipcMain.handle("open-external-url", (event, url: string) => {
    shell.openExternal(url)
  })
  
  // Open external URL handler
  ipcMain.handle("openLink", (event, url: string) => {
    try {
      console.log(`Opening external URL: ${url}`);
      shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error(`Error opening URL ${url}:`, error);
      return { success: false, error: `Failed to open URL: ${error}` };
    }
  })

  // Settings portal handler
  ipcMain.handle("open-settings-portal", async () => {
    try {
      const { createSettingsWindow } = require("./main");
      await createSettingsWindow();
      return { success: true };
    } catch (error) {
      console.error("Error opening settings window:", error);
      return { success: false, error: "Failed to open settings window" };
    }
  })

  // Close settings window handler
  ipcMain.handle("close-settings-window", () => {
    try {
      const { state } = require("./main");
      if (state.settingsWindow && !state.settingsWindow.isDestroyed()) {
        state.settingsWindow.close();
      }
      return { success: true };
    } catch (error) {
      console.error("Error closing settings window:", error);
      return { success: false, error: "Failed to close settings window" };
    }
  })

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      console.error("Error toggling window:", error)
      return { error: "Failed to toggle window" }
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      console.error("Error resetting queues:", error)
      return { error: "Failed to reset queues" }
    }
  })

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }
      
      await deps.processingHelper?.processScreenshots()
      return { success: true }
    } catch (error) {
      console.error("Error processing screenshots:", error)
      return { error: "Failed to process screenshots" }
    }
  })

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests()

      // Clear all queues immediately
      deps.clearQueues()

      // Reset view to queue
      deps.setView("queue")

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }

      return { success: true }
    } catch (error) {
      console.error("Error triggering reset:", error)
      return { error: "Failed to trigger reset" }
    }
  })

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      console.error("Error moving window left:", error)
      return { error: "Failed to move window left" }
    }
  })

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      console.error("Error moving window right:", error)
      return { error: "Failed to move window right" }
    }
  })

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      console.error("Error moving window up:", error)
      return { error: "Failed to move window up" }
    }
  })

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      console.error("Error moving window down:", error)
      return { error: "Failed to move window down" }
    }
  })
  
  // Delete last screenshot handler
  ipcMain.handle("delete-last-screenshot", async () => {
    try {
      const queue = deps.getView() === "queue" 
        ? deps.getScreenshotQueue() 
        : deps.getExtraScreenshotQueue()
      
      if (queue.length === 0) {
        return { success: false, error: "No screenshots to delete" }
      }
      
      // Get the last screenshot in the queue
      const lastScreenshot = queue[queue.length - 1]
      
      // Delete it
      const result = await deps.deleteScreenshot(lastScreenshot)
      
      // Notify the renderer about the change
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-deleted", { path: lastScreenshot })
      }
      
      return result
    } catch (error) {
      console.error("Error deleting last screenshot:", error)
      return { success: false, error: "Failed to delete last screenshot" }
    }
  })

  // Window position handlers for dragging
  ipcMain.handle("get-window-position", () => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { x: 0, y: 0 }
    }
    const [x, y] = mainWindow.getPosition()
    return { x, y }
  })

  ipcMain.handle("set-window-position", (_event, x: number, y: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window not available" }
    }
    
    try {
      mainWindow.setPosition(Math.round(x), Math.round(y))
      return { success: true }
    } catch (error) {
      console.error("Error setting window position:", error)
      return { success: false, error: "Failed to set window position" }
    }
  })

  // Window bounds handlers for resizing
  ipcMain.handle("get-window-bounds", () => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return null
    }
    return mainWindow.getBounds()
  })

  ipcMain.handle("set-window-bounds", (_event, bounds: { x: number; y: number; width: number; height: number }) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window not available" }
    }
    
    try {
      mainWindow.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height)
      })
      return { success: true }
    } catch (error) {
      console.error("Error setting window bounds:", error)
      return { success: false, error: "Failed to set window bounds" }
    }
  })
  
  // Monitor management handlers
  ipcMain.handle("get-monitors", () => {
    try {
      const monitors = monitorHelper.getMonitors();
      return { success: true, monitors };
    } catch (error) {
      console.error("Error getting monitors:", error);
      return { success: false, error: "Failed to get monitors" };
    }
  })
  
  ipcMain.handle("get-monitor-settings", () => {
    try {
      const screenshotMonitorId = configHelper.getScreenshotMonitorId();
      const displayMonitorId = configHelper.getDisplayMonitorId();
      return { 
        success: true, 
        screenshotMonitorId,
        displayMonitorId
      };
    } catch (error) {
      console.error("Error getting monitor settings:", error);
      return { success: false, error: "Failed to get monitor settings" };
    }
  })
  
  ipcMain.handle("set-monitor-settings", (_event, { screenshotMonitorId, displayMonitorId }) => {
    try {
      if (screenshotMonitorId !== undefined) {
        configHelper.setScreenshotMonitorId(screenshotMonitorId);
      }
      if (displayMonitorId !== undefined) {
        configHelper.setDisplayMonitorId(displayMonitorId);
      }
      
      // Notify main window of monitor change
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("monitor-settings-changed", {
          screenshotMonitorId,
          displayMonitorId
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error("Error setting monitor settings:", error);
      return { success: false, error: "Failed to set monitor settings" };
    }
  })
  
  // Listen for monitor changes and notify renderer
  monitorHelper.on('monitors-changed', (monitors) => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("monitors-changed", monitors);
    }
  });
}
