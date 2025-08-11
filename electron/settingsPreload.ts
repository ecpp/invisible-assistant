import { contextBridge, ipcRenderer } from "electron"

const settingsAPI = {
  // Configuration management
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateConfig: (config: { 
    apiKey?: string; 
    language?: string; 
    opacity?: number;
  }) => ipcRenderer.invoke("update-config", config),
  
  // API key validation
  validateApiKey: (apiKey: string) => ipcRenderer.invoke("validate-api-key", apiKey),
  
  // Window control
  closeWindow: () => ipcRenderer.invoke("close-settings-window")
}

// Expose the settings API to the renderer
contextBridge.exposeInMainWorld("settingsAPI", settingsAPI)

console.log("Settings preload script loaded")