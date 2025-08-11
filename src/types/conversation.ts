// Conversation types for chat functionality

export interface ConversationMessage {
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

export interface ConversationSession {
  id: string;
  problemId?: string; // Reference to the original problem
  messages: ConversationMessage[];
  context: ConversationContext;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface ConversationContext {
  problemStatement?: string;
  originalCode?: string;
  language: string;
  solutionSummary?: string;
  debugContext?: string;
  sessionType: 'problem-solving' | 'debugging' | 'general';
}

export interface ConversationRequest {
  sessionId: string;
  message: string;
  includeContext?: boolean;
}

export interface ConversationResponse {
  success: boolean;
  message?: ConversationMessage;
  error?: string;
  sessionUpdated?: ConversationSession;
}

export interface ConversationListResponse {
  sessions: ConversationSession[];
  activeSessionId?: string;
}

// Events for IPC communication
export interface ConversationEvents {
  CREATE_CONVERSATION: 'create-conversation';
  SEND_MESSAGE: 'send-message';
  GET_CONVERSATION: 'get-conversation';
  LIST_CONVERSATIONS: 'list-conversations';
  DELETE_CONVERSATION: 'delete-conversation';
  SET_ACTIVE_CONVERSATION: 'set-active-conversation';
  CONVERSATION_MESSAGE: 'conversation-message';
  CONVERSATION_ERROR: 'conversation-error';
  CONVERSATION_UPDATED: 'conversation-updated';
}