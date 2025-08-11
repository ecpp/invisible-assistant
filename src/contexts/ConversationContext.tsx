import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ConversationMessage, ConversationSession } from '../types/conversation';

interface ConversationContextType {
  // Current active session
  activeSession: ConversationSession | null;
  activeSessionId: string | null;
  
  // All sessions
  sessions: ConversationSession[];
  
  // Chat state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createSession: (context: any, problemId?: string) => Promise<ConversationSession | null>;
  sendMessage: (message: string) => Promise<ConversationMessage | null>;
  loadSession: (sessionId: string) => Promise<ConversationSession | null>;
  switchSession: (sessionId: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  refreshSessions: () => Promise<void>;
  clearError: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<ConversationSession | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load sessions on mount
  useEffect(() => {
    refreshSessions();
    loadActiveSession();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadActiveSession = useCallback(async () => {
    try {
      const result = await window.electronAPI.conversationGetActive();
      
      if (result.success && result.session) {
        setActiveSession(result.session);
        setActiveSessionId(result.sessionId || result.session.id);
      } else {
        setActiveSession(null);
        setActiveSessionId(null);
      }
    } catch (err) {
      console.error('Failed to load active session:', err);
      setActiveSession(null);
      setActiveSessionId(null);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const result = await window.electronAPI.conversationList();
      if (result.success) {
        setSessions(result.sessions || []);
        if (result.activeSessionId) {
          setActiveSessionId(result.activeSessionId);
        }
      } else {
        setError(result.error || 'Failed to load conversations');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    }
  }, []);

  const createSession = useCallback(async (context: any, problemId?: string): Promise<ConversationSession | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.conversationCreate(context, problemId);
      
      if (result.success && result.session) {
        const newSession = result.session;
        
        // Update sessions list
        setSessions(prev => [newSession, ...prev]);
        
        // Set as active session
        setActiveSession(newSession);
        setActiveSessionId(newSession.id);
        
        // Set as active in backend
        await window.electronAPI.conversationSetActive(newSession.id);
        
        return newSession;
      } else {
        setError(result.error || 'Failed to create conversation');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create conversation');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (message: string): Promise<ConversationMessage | null> => {
    if (!activeSessionId) {
      setError('No active conversation session');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.conversationSendMessage(activeSessionId, message);
      
      if (result.success && result.message && result.sessionUpdated) {
        const assistantMessage = result.message;
        const updatedSession = result.sessionUpdated;
        
        // Update active session
        setActiveSession(updatedSession);
        
        // Update sessions list
        setSessions(prev => 
          prev.map(session => 
            session.id === updatedSession.id ? updatedSession : session
          )
        );
        
        return assistantMessage;
      } else {
        setError(result.error || 'Failed to send message');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId]);

  const loadSession = useCallback(async (sessionId: string): Promise<ConversationSession | null> => {
    try {
      const result = await window.electronAPI.conversationGet(sessionId);
      
      if (result.success && result.session) {
        return result.session;
      } else {
        setError(result.error || 'Failed to load conversation');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation');
      return null;
    }
  }, []);

  const switchSession = useCallback(async (sessionId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Load the session
      const session = await loadSession(sessionId);
      if (!session) {
        return false;
      }

      // Set as active
      const result = await window.electronAPI.conversationSetActive(sessionId);
      
      if (result.success) {
        setActiveSession(session);
        setActiveSessionId(sessionId);
        return true;
      } else {
        setError(result.error || 'Failed to switch conversation');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to switch conversation');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadSession]);

  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.conversationDelete(sessionId);
      
      if (result.success) {
        // Update sessions list
        setSessions(prev => prev.filter(session => session.id !== sessionId));
        
        // Clear active session if it was deleted
        if (activeSessionId === sessionId) {
          setActiveSession(null);
          setActiveSessionId(null);
        }
        
        return true;
      } else {
        setError(result.error || 'Failed to delete conversation');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete conversation');
      return false;
    }
  }, [activeSessionId]);

  const value: ConversationContextType = {
    activeSession,
    activeSessionId,
    sessions,
    isLoading,
    error,
    createSession,
    sendMessage,
    loadSession,
    switchSession,
    deleteSession,
    refreshSessions,
    clearError,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}