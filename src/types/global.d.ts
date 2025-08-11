interface MonitorInfo {
  id: string;
  name: string;
  isPrimary: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
}

interface Window {
  __IS_INITIALIZED__: boolean
  __CREDITS__: number
  __LANGUAGE__: string
  __AUTH_TOKEN__: string | null
  supabase: any // Replace with proper Supabase client type if needed
  electron: any // Replace with proper Electron type if needed
  settingsAPI: {
    // Configuration
    getConfig: () => Promise<any>;
    updateConfig: (config: any) => Promise<any>;
    validateApiKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>;
    
    // Monitor management
    getMonitors: () => Promise<{ success: boolean; monitors?: MonitorInfo[]; error?: string }>;
    getMonitorSettings: () => Promise<{ success: boolean; screenshotMonitorId?: string; displayMonitorId?: string; error?: string }>;
    setMonitorSettings: (settings: { screenshotMonitorId?: string; displayMonitorId?: string }) => Promise<{ success: boolean; error?: string }>;
    
    // Window control
    closeWindow: () => Promise<void>;
  };
  electronAPI: {
    // Configuration
    getConfig: () => Promise<any>;
    updateConfig: (config: any) => Promise<any>;
    
    // Monitor management
    getMonitors: () => Promise<{ success: boolean; monitors?: MonitorInfo[]; error?: string }>;
    getMonitorSettings: () => Promise<{ success: boolean; screenshotMonitorId?: string; displayMonitorId?: string; error?: string }>;
    setMonitorSettings: (settings: { screenshotMonitorId?: string; displayMonitorId?: string }) => Promise<{ success: boolean; error?: string }>;
    
    // Event listeners
    on: (channel: string, callback: (...args: any[]) => void) => void;
    off: (channel: string, callback: (...args: any[]) => void) => void;
    
    // Other methods
    openLink: (url: string) => void;
    [key: string]: any; // Allow other properties
  }
}
