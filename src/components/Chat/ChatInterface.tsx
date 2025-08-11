import React, { useState, useRef, useEffect } from 'react';
import { useConversation } from '../../contexts/ConversationContext';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ConversationMessage } from '../../types/conversation';

interface ChatInterfaceProps {
  className?: string;
}

export function ChatInterface({ className = '' }: ChatInterfaceProps) {
  const {
    activeSession,
    isLoading,
    error,
    sendMessage,
    clearError,
  } = useConversation();

  const [messageInput, setMessageInput] = useState('');
  const [isMessageSending, setIsMessageSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages]);

  // Focus input when session becomes active
  useEffect(() => {
    if (activeSession && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeSession]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageInput.trim() || isMessageSending || !activeSession) {
      return;
    }

    const message = messageInput.trim();
    setMessageInput('');
    setIsMessageSending(true);
    
    // Clear any existing errors
    clearError();

    try {
      await sendMessage(message);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsMessageSending(false);
      inputRef.current?.focus();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!activeSession) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <MessageCircle className="mx-auto h-12 w-12 text-white/40 mb-4" />
          <p className="text-white/60">No conversation selected</p>
          <p className="text-white/40 text-sm mt-1">
            Generate a solution first to start chatting
          </p>
        </div>
      </div>
    );
  }

  // Filter out system messages for display
  const displayMessages = activeSession.messages.filter(msg => msg.role !== 'system');

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-white" />
          <h3 className="text-white font-medium">
            {activeSession.context.sessionType === 'debugging' ? 'Debug Chat' : 'Solution Chat'}
          </h3>
        </div>
        <p className="text-white/60 text-sm mt-1 truncate">
          {activeSession.context.problemStatement || 'Coding assistance'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {displayMessages.map((message: ConversationMessage) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white border border-white/20'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>
              <div
                className={`text-xs mt-2 opacity-70 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-white/50'
                }`}
              >
                {formatTimestamp(message.timestamp)}
                {message.metadata?.processingTime && (
                  <span className="ml-2">
                    ({Math.round(message.metadata.processingTime / 1000)}s)
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {(isLoading || isMessageSending) && (
          <div className="flex justify-start">
            <div className="bg-white/10 text-white border border-white/20 rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-white/10">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Ask a follow-up question..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            disabled={isMessageSending || isLoading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!messageInput.trim() || isMessageSending || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            {isMessageSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-white/40 text-xs mt-2">
          Press Enter to send • {displayMessages.length} messages in this conversation
        </p>
      </div>
    </div>
  );
}