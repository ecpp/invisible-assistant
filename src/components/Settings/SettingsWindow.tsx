import React, { useState, useEffect } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Slider } from "../ui/slider"
import { AlertCircle, Check, X, Settings, Key, Eye, Keyboard, Monitor } from "lucide-react"
import { MonitorSelector } from "./MonitorSelector"

interface Config {
  apiKey?: string
  language?: string
  opacity?: number
}

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

export function SettingsWindow() {
  const [config, setConfig] = useState<Config>({})
  const [apiKey, setApiKey] = useState("")
  const [language, setLanguage] = useState("python")
  const [opacity, setOpacity] = useState(1)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [monitors, setMonitors] = useState<MonitorInfo[]>([])
  const [screenshotMonitorId, setScreenshotMonitorId] = useState<string | undefined>()
  const [displayMonitorId, setDisplayMonitorId] = useState<string | undefined>()

  // Load current configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const currentConfig = await window.settingsAPI.getConfig()
        if (currentConfig) {
          setConfig(currentConfig)
          setApiKey(currentConfig.apiKey || "")
          setLanguage(currentConfig.language || "python")
          setOpacity(currentConfig.opacity ?? 1)
        }
        
        // Load monitors
        const monitorsResult = await window.settingsAPI.getMonitors()
        console.log("Loading monitors in SettingsWindow:", monitorsResult)
        if (monitorsResult.success && monitorsResult.monitors) {
          setMonitors(monitorsResult.monitors)
        }
        
        // Load monitor settings
        const monitorSettings = await window.settingsAPI.getMonitorSettings()
        console.log("Loading monitor settings:", monitorSettings)
        if (monitorSettings.success) {
          setScreenshotMonitorId(monitorSettings.screenshotMonitorId)
          setDisplayMonitorId(monitorSettings.displayMonitorId)
        }
      } catch (error) {
        console.error("Failed to load config:", error)
      }
    }
    loadConfig()
  }, [])

  const validateApiKey = async () => {
    if (!apiKey) {
      setValidationResult({ valid: false, error: "Please enter an API key" })
      return
    }

    setIsValidating(true)
    setValidationResult(null)

    try {
      const result = await window.settingsAPI.validateApiKey(apiKey)
      setValidationResult(result)
    } catch (error) {
      setValidationResult({ valid: false, error: "Failed to validate API key" })
    } finally {
      setIsValidating(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await window.settingsAPI.updateConfig({
        apiKey,
        language,
        opacity
      })
      
      // Save monitor settings
      await window.settingsAPI.setMonitorSettings({
        screenshotMonitorId,
        displayMonitorId
      })
      
      // Close the settings window after successful save
      window.settingsAPI.closeWindow()
    } catch (error) {
      console.error("Failed to save settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    window.settingsAPI.closeWindow()
  }

  return (
    <div className="h-screen bg-background text-foreground p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="display" className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Display
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              Shortcuts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>
                  Configure your Gemini API key for AI operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Gemini API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="apiKey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIza..."
                      className="flex-1"
                    />
                    <Button
                      onClick={validateApiKey}
                      disabled={isValidating || !apiKey}
                      variant="secondary"
                    >
                      {isValidating ? "Validating..." : "Validate"}
                    </Button>
                  </div>
                  {validationResult && (
                    <div className={`flex items-center gap-2 text-sm ${validationResult.valid ? "text-green-500" : "text-red-500"}`}>
                      {validationResult.valid ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      <span>{validationResult.valid ? "API key is valid" : validationResult.error}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Default Programming Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                      <SelectItem value="java">Java</SelectItem>
                      <SelectItem value="cpp">C++</SelectItem>
                      <SelectItem value="csharp">C#</SelectItem>
                      <SelectItem value="go">Go</SelectItem>
                      <SelectItem value="rust">Rust</SelectItem>
                      <SelectItem value="ruby">Ruby</SelectItem>
                      <SelectItem value="php">PHP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="display" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Monitor Settings</CardTitle>
                <CardDescription>
                  Configure which monitors to use for different functions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <MonitorSelector
                  label="Screenshot Monitor"
                  description="Select which monitor to capture when taking screenshots"
                  value={screenshotMonitorId}
                  onChange={setScreenshotMonitorId}
                  monitors={monitors}
                />
                
                <MonitorSelector
                  label="Display Monitor"
                  description="Select which monitor to display the application window on"
                  value={displayMonitorId}
                  onChange={setDisplayMonitorId}
                  monitors={monitors}
                />
                
                {monitors.length === 0 && (
                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-500">
                      No monitors detected. Please check your display connections.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
                <CardDescription>
                  Customize the look and feel of the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="opacity">Window Opacity: {Math.round(opacity * 100)}%</Label>
                  <Slider
                    id="opacity"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={[opacity]}
                    onValueChange={([value]) => setOpacity(value)}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Adjust the transparency of the main window
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shortcuts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Keyboard Shortcuts</CardTitle>
                <CardDescription>
                  Reference for available keyboard shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm">Take Screenshot</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">Cmd/Ctrl + Shift + S</kbd>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm">Process Screenshots</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">Cmd/Ctrl + Shift + P</kbd>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm">Toggle Window</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">Cmd/Ctrl + Shift + H</kbd>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm">Reset</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">Cmd/Ctrl + Shift + R</kbd>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm">Move Window</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">Cmd/Ctrl + Arrow Keys</kbd>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  )
}