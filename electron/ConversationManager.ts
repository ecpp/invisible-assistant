import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { EventEmitter } from "events";
import { GoogleGenAI, createUserContent } from "@google/genai";
import { configHelper } from "./ConfigHelper";

// Import types (we'll need to make sure they're accessible from electron)
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    tokenCount?: number;
    processingTime?: number;
  };
}

interface ConversationSession {
  id: string;
  problemId?: string;
  messages: ConversationMessage[];
  context: ConversationContext;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

interface ConversationContext {
  problemStatement?: string;
  originalCode?: string;
  language: string;
  solutionSummary?: string;
  debugContext?: string;
  sessionType: 'problem-solving' | 'debugging' | 'general';
}

interface ConversationRequest {
  sessionId: string;
  message: string;
  includeContext?: boolean;
}

interface ConversationResponse {
  success: boolean;
  message?: ConversationMessage;
  error?: string;
  sessionUpdated?: ConversationSession;
}

export class ConversationManager extends EventEmitter {
  private sessionsPath: string;
  private sessions: Map<string, ConversationSession> = new Map();
  private geminiClient: GoogleGenAI | null = null;
  private activeSessionId: string | null = null;

  constructor() {
    super();
    
    // Setup storage path
    try {
      this.sessionsPath = path.join(app.getPath('userData'), 'conversations');
      console.log('Conversations path:', this.sessionsPath);
    } catch (err) {
      console.warn('Could not access user data path for conversations, using fallback');
      this.sessionsPath = path.join(process.cwd(), 'conversations');
    }

    // Ensure conversations directory exists
    this.ensureConversationsDirectory();
    
    // Load existing sessions
    this.loadSessions();
    
    // Initialize Gemini client
    this.initializeGeminiClient();
    
    // Listen for config changes
    configHelper.on('config-updated', () => {
      this.initializeGeminiClient();
    });
  }

  /**
   * Initialize Gemini client
   */
  private initializeGeminiClient(): void {
    try {
      const config = configHelper.loadConfig();
      
      if (config.apiKey) {
        this.geminiClient = new GoogleGenAI({
          apiKey: config.apiKey
        });
        console.log("Gemini client initialized for conversations");
      } else {
        this.geminiClient = null;
        console.warn("No API key available, Gemini client not initialized for conversations");
      }
    } catch (error) {
      console.error("Failed to initialize Gemini client for conversations:", error);
      this.geminiClient = null;
    }
  }

  /**
   * Ensure conversations directory exists
   */
  private ensureConversationsDirectory(): void {
    try {
      if (!fs.existsSync(this.sessionsPath)) {
        fs.mkdirSync(this.sessionsPath, { recursive: true });
      }
    } catch (err) {
      console.error("Error creating conversations directory:", err);
    }
  }

  /**
   * Load existing conversation sessions from disk
   */
  private loadSessions(): void {
    try {
      if (fs.existsSync(this.sessionsPath)) {
        const files = fs.readdirSync(this.sessionsPath);
        let mostRecentSession: ConversationSession | null = null;
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(this.sessionsPath, file);
              const sessionData = fs.readFileSync(filePath, 'utf8');
              const session: ConversationSession = JSON.parse(sessionData);
              
              // Validate session structure
              if (session.id && session.messages && Array.isArray(session.messages)) {
                this.sessions.set(session.id, session);
                
                // Track the most recent session to set as active
                if (!mostRecentSession || session.updatedAt > mostRecentSession.updatedAt) {
                  mostRecentSession = session;
                }
              }
            } catch (err) {
              console.error(`Error loading conversation session ${file}:`, err);
            }
          }
        }
        
        // Set the most recent session as active if we have any sessions
        if (mostRecentSession) {
          this.activeSessionId = mostRecentSession.id;
          console.log(`Set most recent session as active: ${mostRecentSession.id}`);
        }
        
        console.log(`Loaded ${this.sessions.size} conversation sessions`);
      }
    } catch (err) {
      console.error("Error loading conversation sessions:", err);
    }
  }

  /**
   * Save a conversation session to disk
   */
  private saveSession(session: ConversationSession): void {
    try {
      const filePath = path.join(this.sessionsPath, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch (err) {
      console.error(`Error saving conversation session ${session.id}:`, err);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new conversation session
   */
  public createSession(context: ConversationContext, problemId?: string): ConversationSession {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: ConversationSession = {
      id: sessionId,
      problemId,
      messages: [],
      context,
      createdAt: now,
      updatedAt: now,
      isActive: false
    };

    // Add system message with context
    const systemMessage: ConversationMessage = {
      id: this.generateMessageId(),
      role: 'system',
      content: this.buildSystemPrompt(context),
      timestamp: now
    };

    session.messages.push(systemMessage);

    // Store session
    this.sessions.set(sessionId, session);
    this.saveSession(session);

    console.log(`Created new conversation session: ${sessionId}`);
    return session;
  }

  /**
   * Build system prompt based on context
   */
  private buildSystemPrompt(context: ConversationContext): string {
    let prompt = `You are a helpful coding interview assistant specializing in ${context.language} programming. You help users understand coding problems, implement solutions, and debug issues.

SESSION CONTEXT:
- Programming Language: ${context.language}
- Session Type: ${context.sessionType}`;

    if (context.problemStatement) {
      prompt += `\n- Problem: ${context.problemStatement}`;
    }

    if (context.originalCode) {
      prompt += `\n- Current Solution:\n\`\`\`${context.language}\n${context.originalCode}\n\`\`\``;
    }

    if (context.solutionSummary) {
      prompt += `\n- Solution Analysis: ${context.solutionSummary}`;
    }

    if (context.debugContext) {
      prompt += `\n- Debug Information: ${context.debugContext}`;
    }

    prompt += `\n\nIMPORTANT: Always maintain context from this session. When users ask follow-up questions, refer to the problem, solution, and previous discussion. Provide specific, actionable advice related to their coding interview context.`;

    return prompt;
  }

  /**
   * Send a message in a conversation session
   */
  public async sendMessage(sessionId: string, userMessage: string): Promise<ConversationResponse> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: "Conversation session not found"
        };
      }

      // Verify Gemini client
      if (!this.geminiClient) {
        return {
          success: false,
          error: "Gemini client not initialized. Please check your API key."
        };
      }

      const startTime = Date.now();

      // Add user message to session
      const userMessageObj: ConversationMessage = {
        id: this.generateMessageId(),
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      };

      const config = configHelper.loadConfig();

      // Build conversation history for Gemini - need to include system context properly
      const conversationParts = [];
      
      // Add system context first
      const systemContext = session.messages.find(msg => msg.role === 'system');
      if (systemContext) {
        conversationParts.push(`Context: ${systemContext.content}`);
      }
      
      // Add conversation history (excluding system messages - don't need to filter userMessageObj since it's not added yet)
      const previousMessages = session.messages.filter(msg => msg.role !== 'system');
      
      if (previousMessages.length > 0) {
        conversationParts.push("\nPrevious conversation:");
        previousMessages.forEach(msg => {
          const speaker = msg.role === 'user' ? 'User' : 'Assistant';
          conversationParts.push(`${speaker}: ${msg.content}`);
        });
      }
      
      // Add current user message
      conversationParts.push(`\nUser: ${userMessage}`);
      conversationParts.push("\nPlease respond as the Assistant, maintaining context from the previous conversation:");
      
      const fullPrompt = conversationParts.join('\n');

      console.log('Sending to Gemini:', {
        model: "gemini-2.5-flash",
        promptLength: fullPrompt.length,
        messageCount: session.messages.length
      });

      // Generate response with Gemini
      const response = await this.geminiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: createUserContent([fullPrompt]),
        config: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        }
      });

      console.log('Gemini response received:', {
        hasText: !!response.text,
        textLength: response.text?.length || 0
      });

      if (!response.text || response.text.trim() === '') {
        console.error('Empty response from Gemini API. Full response:', response);
        throw new Error("Empty response from Gemini API. Please try again.");
      }

      const processingTime = Date.now() - startTime;

      // Only add user message to session after successful API response
      session.messages.push(userMessageObj);

      // Add assistant response to session
      const assistantMessage: ConversationMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        metadata: {
          model: "gemini-2.5-flash",
          processingTime
        }
      };

      session.messages.push(assistantMessage);
      session.updatedAt = Date.now();
      session.isActive = true;

      // Save updated session
      this.saveSession(session);

      return {
        success: true,
        message: assistantMessage,
        sessionUpdated: session
      };

    } catch (error: any) {
      console.error("Error in conversation:", error);
      
      let errorMessage = "Failed to process conversation message";
      
      if (error.message?.includes("API key")) {
        errorMessage = "Invalid API key. Please check your Gemini API key in settings.";
      } else if (error.message?.includes("quota") || error.message?.includes("limit")) {
        errorMessage = "API quota exceeded. Please try again later.";
      } else if (error.message?.includes("Empty response")) {
        errorMessage = "Received empty response from AI. This might be due to content filtering or API issues. Please try rephrasing your question.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get a conversation session
   */
  public getSession(sessionId: string): ConversationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * List all conversation sessions
   */
  public listSessions(): ConversationSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt); // Sort by most recent
  }

  /**
   * Delete a conversation session
   */
  public deleteSession(sessionId: string): boolean {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return false;
      }

      // Remove from memory
      this.sessions.delete(sessionId);

      // Remove from disk
      const filePath = path.join(this.sessionsPath, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Clear active session if it's the deleted one
      if (this.activeSessionId === sessionId) {
        this.activeSessionId = null;
      }

      console.log(`Deleted conversation session: ${sessionId}`);
      return true;

    } catch (err) {
      console.error(`Error deleting conversation session ${sessionId}:`, err);
      return false;
    }
  }

  /**
   * Set active session
   */
  public setActiveSession(sessionId: string | null): boolean {
    if (sessionId && !this.sessions.has(sessionId)) {
      return false;
    }

    this.activeSessionId = sessionId;
    return true;
  }

  /**
   * Get active session ID
   */
  public getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Get active session
   */
  public getActiveSession(): ConversationSession | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.getSession(this.activeSessionId);
  }

  /**
   * Clean up old sessions (optional - for storage management)
   */
  public cleanupOldSessions(maxSessions: number = 50): void {
    const sessions = this.listSessions();
    
    if (sessions.length > maxSessions) {
      const sessionsToDelete = sessions.slice(maxSessions);
      
      for (const session of sessionsToDelete) {
        this.deleteSession(session.id);
      }
      
      console.log(`Cleaned up ${sessionsToDelete.length} old conversation sessions`);
    }
  }
}

// Export singleton instance
export const conversationManager = new ConversationManager();