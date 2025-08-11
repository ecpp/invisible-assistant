// ProcessingHelper.ts
import fs from "node:fs"
import path from "node:path"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import { app, BrowserWindow, dialog } from "electron"
import { configHelper } from "./ConfigHelper"
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai"
import { conversationManager } from "./ConversationManager"
export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private geminiClient: GoogleGenAI | null = null

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    
    // Initialize AI client based on config
    this.initializeAIClient();
    
    // Listen for config changes to re-initialize the AI client
    configHelper.on('config-updated', () => {
      this.initializeAIClient();
    });
  }
  
  /**
   * Get MIME type from file path
   */
  private getMimeTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/png'; // Default to PNG
    }
  }
  
  /**
   * Initialize or reinitialize the Gemini client with current config
   */
  private initializeAIClient(): void {
    try {
      const config = configHelper.loadConfig();
      
      if (config.apiKey) {
        this.geminiClient = new GoogleGenAI({
          apiKey: config.apiKey
        });
        console.log("Gemini client initialized successfully");
      } else {
        this.geminiClient = null;
        console.warn("No API key available, Gemini client not initialized");
      }
    } catch (error) {
      console.error("Failed to initialize Gemini client:", error);
      this.geminiClient = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999 // Unlimited credits as fallback
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }
      
      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }
      
      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig();
    
    // First verify we have a valid Gemini client
    if (!this.geminiClient) {
      this.initializeAIClient();
      
      if (!this.geminiClient) {
        console.error("Gemini client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)
      
      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64'),
                mimeType: this.getMimeTypeFromPath(path)
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(validScreenshots, signal)

        if (!result.success) {
          console.log("Processing failed:", result.error)
          if (result.error?.includes("API Key") || result.error?.includes("Gemini")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error")
          this.deps.setView("queue")
          return
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing")
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        )
        console.error("Processing error:", error)
        if (this.currentProcessingAbortController?.signal.aborted) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          )
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)
      
      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        
        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }
      
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
        ];
        
        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }
              
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64'),
                mimeType: this.getMimeTypeFromPath(path)
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )
        
        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }
        
        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
        )

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal
        )

        if (result.success) {
          // Create or update conversation session for debugging
          let conversationSession = conversationManager.getActiveSession();
          
          if (!conversationSession) {
            const problemInfo = this.deps.getProblemInfo();
            const language = await this.getLanguage();
            
            // Create new debug conversation session
            conversationSession = conversationManager.createSession({
              problemStatement: problemInfo?.problem_statement || "Debug session",
              originalCode: result.data.code || "// Debug mode",
              language: language,
              debugContext: result.data.debug_analysis,
              sessionType: 'debugging'
            }, `debug_${Date.now()}`);
            
            conversationManager.setActiveSession(conversationSession.id);
          }
          
          this.deps.setHasDebugged(true)
          
          // Send debug result with conversation session ID
          const responseData = {
            ...result.data,
            conversationSessionId: conversationSession.id
          };
          
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            responseData
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        if (this.currentExtraProcessingAbortController?.signal.aborted) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string; mimeType: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();
      
      // Verify Gemini client
      if (!this.geminiClient) {
        this.initializeAIClient();
        
        if (!this.geminiClient) {
          return {
            success: false,
            error: "Gemini API key not configured or invalid. Please check your settings."
          };
        }
      }
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20
        });
      }

      try {
        // Create parts for multi-image request
        const contentParts = [
          `You are a coding challenge interpreter. Analyze the screenshots of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text. Preferred coding language we gonna use for this problem is ${language}.`,
          ...screenshots.map(screenshot => ({
            inlineData: {
              mimeType: screenshot.mimeType,
              data: screenshot.data,
            },
          }))
        ];

        const response = await this.geminiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: createUserContent(contentParts),
          config: {
            temperature: 0.2,
            maxOutputTokens: 4000,
            thinkingConfig: {
              thinkingBudget: 0, // Disables thinking for faster response
            },
          }
        });

        if (!response.text) {
          throw new Error("Empty response from Gemini API");
        }

        // Parse the response
        const responseText = response.text;
        const jsonText = responseText.replace(/```json|```/g, '').trim();
        const problemInfo = JSON.parse(jsonText);
        
        // Update the user on progress
        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Problem analyzed successfully. Preparing to generate solution...",
            progress: 40
          });
        }

        // Store problem info in AppState
        this.deps.setProblemInfo(problemInfo);

        // Send first success event
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
            problemInfo
          );

          // Generate solutions after successful extraction
          const solutionsResult = await this.generateSolutionsHelper(signal);
          if (solutionsResult.success) {
            // Clear any existing extra screenshots before transitioning to solutions view
            this.screenshotHelper.clearExtraScreenshotQueue();
            
            // Final progress update
            mainWindow.webContents.send("processing-status", {
              message: "Solution generated successfully",
              progress: 100
            });
            
            // Create conversation session after successful solution generation
            const conversationSession = conversationManager.createSession({
              problemStatement: problemInfo.problem_statement,
              originalCode: solutionsResult.data.code,
              language: language,
              solutionSummary: `Generated solution with ${solutionsResult.data.thoughts.length} key insights. Time complexity: ${solutionsResult.data.time_complexity}. Space complexity: ${solutionsResult.data.space_complexity}.`,
              sessionType: 'problem-solving'
            }, `problem_${Date.now()}`);
            
            // Set as active session
            conversationManager.setActiveSession(conversationSession.id);
            
            // Send solution with conversation session ID
            const responseData = {
              ...solutionsResult.data,
              conversationSessionId: conversationSession.id
            };
            
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
              responseData
            );
            return { success: true, data: responseData };
          } else {
            throw new Error(
              solutionsResult.error || "Failed to generate solutions"
            );
          }
        }

        return { success: false, error: "Failed to process screenshots" };
      } catch (error: any) {
        console.error("Error using Gemini API:", error);
        return {
          success: false,
          error: "Failed to process with Gemini API. Please check your API key or try again later."
        };
      }
    } catch (error: any) {
      // If the request was cancelled, don't retry
      if (signal.aborted) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      console.error("API Error Details:", error);
      return { 
        success: false, 
        error: error.message || "Failed to process screenshots. Please try again." 
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Verify Gemini client
      if (!this.geminiClient) {
        return {
          success: false,
          error: "Gemini API key not configured. Please check your settings."
        };
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Creating optimal solution with detailed explanations...",
          progress: 60
        });
      }

      // Create prompt for solution generation
      const promptText = `
Generate a detailed solution for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

I need the response in the following format:
1. Code: A clean, optimized implementation in ${language}
2. Your Thoughts: A list of key insights and reasoning behind your approach
3. Time complexity: O(X) with a detailed explanation (at least 2 sentences)
4. Space complexity: O(X) with a detailed explanation (at least 2 sentences)

For complexity explanations, please be thorough. For example: "Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution." or "Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size."

Your solution should be efficient, well-commented, and handle edge cases.
`;

      try {
        const response = await this.geminiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: createUserContent([
            `You are an expert coding interview assistant. Provide a clear, optimal solution with detailed explanations for this problem:\n\n${promptText}`
          ]),
          config: {
            temperature: 0.2,
            maxOutputTokens: 4000,
            thinkingConfig: {
              thinkingBudget: 0, // Disables thinking for faster response
            },
          }
        });

        if (!response.text) {
          throw new Error("Empty response from Gemini API");
        }

        const responseContent = response.text;
        
        // Extract parts from the response
        const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1].trim() : responseContent;
        
        // Extract thoughts, looking for bullet points or numbered lists
        const thoughtsRegex = /(?:Thoughts:|Key Insights:|Reasoning:|Approach:)([\s\S]*?)(?:Time complexity:|$)/i;
        const thoughtsMatch = responseContent.match(thoughtsRegex);
        let thoughts: string[] = [];
        
        if (thoughtsMatch && thoughtsMatch[1]) {
          // Extract bullet points or numbered items
          const bulletPoints = thoughtsMatch[1].match(/(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.*)/g);
          if (bulletPoints) {
            thoughts = bulletPoints.map(point => 
              point.replace(/^\s*(?:[-*•]|\d+\.)\s*/, '').trim()
            ).filter(Boolean);
          } else {
            // If no bullet points found, split by newlines and filter empty lines
            thoughts = thoughtsMatch[1].split('\n')
              .map((line) => line.trim())
              .filter(Boolean);
          }
        }
        
        // Extract complexity information
        const timeComplexityPattern = /Time complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|$))/i;
        const spaceComplexityPattern = /Space complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i;
        
        let timeComplexity = "O(n) - Linear time complexity because we only iterate through the array once. Each element is processed exactly one time, and the hashmap lookups are O(1) operations.";
        let spaceComplexity = "O(n) - Linear space complexity because we store elements in the hashmap. In the worst case, we might need to store all elements before finding the solution pair.";
        
        const timeMatch = responseContent.match(timeComplexityPattern);
        if (timeMatch && timeMatch[1]) {
          timeComplexity = timeMatch[1].trim();
          if (!timeComplexity.match(/O\([^)]+\)/i)) {
            timeComplexity = `O(n) - ${timeComplexity}`;
          } else if (!timeComplexity.includes('-') && !timeComplexity.includes('because')) {
            const notationMatch = timeComplexity.match(/O\([^)]+\)/i);
            if (notationMatch) {
              const notation = notationMatch[0];
              const rest = timeComplexity.replace(notation, '').trim();
              timeComplexity = `${notation} - ${rest}`;
            }
          }
        }
        
        const spaceMatch = responseContent.match(spaceComplexityPattern);
        if (spaceMatch && spaceMatch[1]) {
          spaceComplexity = spaceMatch[1].trim();
          if (!spaceComplexity.match(/O\([^)]+\)/i)) {
            spaceComplexity = `O(n) - ${spaceComplexity}`;
          } else if (!spaceComplexity.includes('-') && !spaceComplexity.includes('because')) {
            const notationMatch = spaceComplexity.match(/O\([^)]+\)/i);
            if (notationMatch) {
              const notation = notationMatch[0];
              const rest = spaceComplexity.replace(notation, '').trim();
              spaceComplexity = `${notation} - ${rest}`;
            }
          }
        }

        const formattedResponse = {
          code: code,
          thoughts: thoughts.length > 0 ? thoughts : ["Solution approach based on efficiency and readability"],
          time_complexity: timeComplexity,
          space_complexity: spaceComplexity
        };

        return { success: true, data: formattedResponse };
      } catch (error: any) {
        console.error("Error using Gemini API for solution:", error);
        return {
          success: false,
          error: "Failed to generate solution with Gemini API. Please check your API key or try again later."
        };
      }
    } catch (error: any) {
      if (signal.aborted) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      console.error("Solution generation error:", error);
      return { success: false, error: error.message || "Failed to generate solution" };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string; mimeType: string }>,
    signal: AbortSignal
  ) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Verify Gemini client
      if (!this.geminiClient) {
        return {
          success: false,
          error: "Gemini API key not configured. Please check your settings."
        };
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        });
      }

      try {
        const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).
`;

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Analyzing code and generating debug feedback with Gemini...",
            progress: 60
          });
        }

        // Create parts for multi-image request
        const contentParts = [
          debugPrompt,
          ...screenshots.map(screenshot => ({
            inlineData: {
              mimeType: screenshot.mimeType,
              data: screenshot.data,
            },
          }))
        ];

        const response = await this.geminiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: createUserContent(contentParts),
          config: {
            temperature: 0.2,
            maxOutputTokens: 4000,
            thinkingConfig: {
              thinkingBudget: 0, // Disables thinking for faster response
            },
          }
        });

        if (!response.text) {
          throw new Error("Empty response from Gemini API");
        }

        const debugContent = response.text;
        
        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Debug analysis complete",
            progress: 100
          });
        }

        let extractedCode = "// Debug mode - see analysis below";
        const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
        if (codeMatch && codeMatch[1]) {
          extractedCode = codeMatch[1].trim();
        }

        let formattedDebugContent = debugContent;
        
        if (!debugContent.includes('# ') && !debugContent.includes('## ')) {
          formattedDebugContent = debugContent
            .replace(/issues identified|problems found|bugs found/i, '## Issues Identified')
            .replace(/code improvements|improvements|suggested changes/i, '## Code Improvements')
            .replace(/optimizations|performance improvements/i, '## Optimizations')
            .replace(/explanation|detailed analysis/i, '## Explanation');
        }

        const bulletPoints = formattedDebugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
        const thoughts = bulletPoints 
          ? bulletPoints.map(point => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5)
          : ["Debug analysis based on your screenshots"];
        
        const result = {
          code: extractedCode,
          debug_analysis: formattedDebugContent,
          thoughts: thoughts,
          time_complexity: "N/A - Debug mode",
          space_complexity: "N/A - Debug mode"
        };

        return { success: true, data: result };
      } catch (error: any) {
        console.error("Error using Gemini API for debugging:", error);
        return {
          success: false,
          error: "Failed to process debug request with Gemini API. Please check your API key or try again later."
        };
      }
    } catch (error: any) {
      if (signal.aborted) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      console.error("Debug processing error:", error);
      return { success: false, error: error.message || "Failed to process debug request" };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    this.deps.setHasDebugged(false)

    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}
