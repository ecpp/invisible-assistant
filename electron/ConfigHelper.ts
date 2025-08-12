// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"

interface Config {
  apiKey: string;
  apiProvider: "gemini";  // Only Gemini supported
  language: string;
  opacity: number;
  screenshotMonitorId?: string;  // Monitor ID for taking screenshots
  displayMonitorId?: string;     // Monitor ID for displaying main window
  extractionModel?: string;      // Model for extracting problems from screenshots
  solutionModel?: string;         // Model for generating solutions
  debuggingModel?: string;        // Model for debugging code
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    apiKey: "",
    apiProvider: "gemini", // Only Gemini supported
    language: "python",
    opacity: 1.0,
    screenshotMonitorId: undefined,
    displayMonitorId: undefined
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }
    
    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed Gemini models are used
   */

  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Ensure apiProvider is Gemini (only supported provider)
        config.apiProvider = "gemini";
        
        return {
          ...this.defaultConfig,
          ...config
        };
      }
      
      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (err) {
      console.error("Error loading config:", err);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      let provider = updates.apiProvider || currentConfig.apiProvider;
      
      // Force provider to Gemini (only supported provider)
      if (updates.apiKey) {
        provider = "gemini";
        updates.apiProvider = provider;
        console.log("Using Gemini API (only supported provider)");
      }
      
      // Always use Gemini (only supported provider)
      updates.apiProvider = "gemini";
      
      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);
      
      // Only emit update event for changes other than opacity
      // This prevents re-initializing the AI client when only opacity changes
      if (updates.apiKey !== undefined || updates.language !== undefined) {
        this.emit('config-updated', newConfig);
      }
      
      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Check if the API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return !!config.apiKey && config.apiKey.trim().length > 0;
  }
  
  /**
   * Validate the API key format for Gemini
   */
  public isValidApiKeyFormat(apiKey: string): boolean {
    // Basic format validation for Gemini API keys (usually alphanumeric with no specific prefix)
    return apiKey.trim().length >= 10; // Assuming Gemini keys are at least 10 chars
  }
  
  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }  
  
  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
  
  /**
   * Get the monitor ID for screenshots
   */
  public getScreenshotMonitorId(): string | undefined {
    const config = this.loadConfig();
    return config.screenshotMonitorId;
  }
  
  /**
   * Set the monitor ID for screenshots
   */
  public setScreenshotMonitorId(monitorId: string | undefined): void {
    this.updateConfig({ screenshotMonitorId: monitorId });
  }
  
  /**
   * Get the monitor ID for displaying main window
   */
  public getDisplayMonitorId(): string | undefined {
    const config = this.loadConfig();
    return config.displayMonitorId;
  }
  
  /**
   * Set the monitor ID for displaying main window
   */
  public setDisplayMonitorId(monitorId: string | undefined): void {
    this.updateConfig({ displayMonitorId: monitorId });
  }
  
  /**
   * Test Gemini API key
   */
  public async testApiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    return this.testGeminiKey(apiKey);
  }
  
  
  /**
   * Test Gemini API key
   */
  private async testGeminiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // Basic format validation for Gemini API keys
      if (apiKey && apiKey.trim().length >= 10) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Gemini API key format.' };
    } catch (error: any) {
      console.error('Gemini API key test failed:', error);
      let errorMessage = 'Unknown error validating Gemini API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }

}

// Export a singleton instance
export const configHelper = new ConfigHelper();
