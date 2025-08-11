import { screen, Display } from "electron";
import { EventEmitter } from "events";

export interface MonitorInfo {
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

export class MonitorHelper extends EventEmitter {
  private monitors: Map<string, MonitorInfo> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  
  constructor() {
    super();
    // Don't initialize here - wait for app to be ready
  }
  
  /**
   * Initialize the monitor helper after app is ready
   */
  public initialize(): void {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    this.detectMonitors();
    this.startMonitoring();
  }
  
  /**
   * Start monitoring for display changes
   */
  private startMonitoring(): void {
    // Listen for display events
    screen.on('display-added', () => {
      console.log('Display added detected');
      this.detectMonitors();
      this.emit('monitors-changed', this.getMonitors());
    });
    
    screen.on('display-removed', () => {
      console.log('Display removed detected');
      this.detectMonitors();
      this.emit('monitors-changed', this.getMonitors());
    });
    
    screen.on('display-metrics-changed', () => {
      console.log('Display metrics changed');
      this.detectMonitors();
      this.emit('monitors-changed', this.getMonitors());
    });
    
    // Also poll periodically as a fallback (every 5 seconds)
    this.updateInterval = setInterval(() => {
      const previousCount = this.monitors.size;
      this.detectMonitors();
      const currentCount = this.monitors.size;
      
      if (previousCount !== currentCount) {
        this.emit('monitors-changed', this.getMonitors());
      }
    }, 5000);
  }
  
  /**
   * Stop monitoring for display changes
   */
  public stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Detect all connected monitors
   */
  private detectMonitors(): void {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const newMonitors = new Map<string, MonitorInfo>();
    
    displays.forEach((display: Display, index: number) => {
      const monitorId = this.generateMonitorId(display);
      const isPrimary = display.id === primaryDisplay.id;
      
      const monitorInfo: MonitorInfo = {
        id: monitorId,
        name: `Display ${index + 1}${isPrimary ? ' (Primary)' : ''}`,
        isPrimary,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor
      };
      
      newMonitors.set(monitorId, monitorInfo);
    });
    
    this.monitors = newMonitors;
    console.log(`Detected ${this.monitors.size} monitor(s)`);
  }
  
  /**
   * Generate a stable ID for a monitor based on its properties
   */
  private generateMonitorId(display: Display): string {
    // Use position and size to create a stable ID
    // This handles the case where Electron display IDs might change
    return `${display.bounds.x}_${display.bounds.y}_${display.bounds.width}_${display.bounds.height}`;
  }
  
  /**
   * Get all detected monitors
   */
  public getMonitors(): MonitorInfo[] {
    if (!this.isInitialized) {
      console.warn('MonitorHelper not initialized yet');
      return [];
    }
    return Array.from(this.monitors.values());
  }
  
  /**
   * Get a specific monitor by ID
   */
  public getMonitor(monitorId: string): MonitorInfo | undefined {
    if (!this.isInitialized) {
      console.warn('MonitorHelper not initialized yet');
      return undefined;
    }
    return this.monitors.get(monitorId);
  }
  
  /**
   * Get the primary monitor
   */
  public getPrimaryMonitor(): MonitorInfo | undefined {
    if (!this.isInitialized) {
      console.warn('MonitorHelper not initialized yet');
      return undefined;
    }
    return Array.from(this.monitors.values()).find(m => m.isPrimary);
  }
  
  /**
   * Validate if a monitor ID still exists
   */
  public isMonitorValid(monitorId: string): boolean {
    if (!this.isInitialized) {
      console.warn('MonitorHelper not initialized yet');
      return false;
    }
    return this.monitors.has(monitorId);
  }
  
  /**
   * Get display object for a monitor ID (for screenshot capture)
   */
  public getDisplayForMonitor(monitorId?: string): Display {
    // If not initialized or no specific monitor requested, return primary
    if (!this.isInitialized || !monitorId) {
      return screen.getPrimaryDisplay();
    }
    
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      console.warn(`Monitor ${monitorId} not found, using primary display`);
      return screen.getPrimaryDisplay();
    }
    
    // Find the display that matches our monitor bounds
    const displays = screen.getAllDisplays();
    const matchingDisplay = displays.find(d => 
      d.bounds.x === monitor.bounds.x &&
      d.bounds.y === monitor.bounds.y &&
      d.bounds.width === monitor.bounds.width &&
      d.bounds.height === monitor.bounds.height
    );
    
    return matchingDisplay || screen.getPrimaryDisplay();
  }
  
  /**
   * Get the best fallback monitor when a monitor is unplugged
   */
  public getFallbackMonitor(preferredMonitorId?: string): MonitorInfo {
    // If the preferred monitor exists, use it
    if (preferredMonitorId && this.monitors.has(preferredMonitorId)) {
      return this.monitors.get(preferredMonitorId)!;
    }
    
    // Otherwise, use the primary monitor
    const primary = this.getPrimaryMonitor();
    if (primary) {
      return primary;
    }
    
    // As a last resort, use the first available monitor
    const firstMonitor = this.getMonitors()[0];
    if (firstMonitor) {
      return firstMonitor;
    }
    
    // This should never happen, but create a default monitor info
    console.error('No monitors detected! Creating default monitor info');
    return {
      id: 'default',
      name: 'Default Display',
      isPrimary: true,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1
    };
  }
  
  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.monitors.clear();
  }
}

// Export singleton instance
export const monitorHelper = new MonitorHelper();