import React, { useState } from 'react';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ChatInterface } from './ChatInterface';
import { useConversation } from '../../contexts/ConversationContext';

interface ChatToggleProps {
  className?: string;
}

export function ChatToggle({ className = '' }: ChatToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { activeSession } = useConversation();

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      setIsMinimized(false);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
  };

  // Don't show the chat toggle if there's no active session
  if (!activeSession) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {!isOpen ? (
        // Floating chat button
        <Button
          onClick={handleToggle}
          className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-2 border-white/20"
        >
          <MessageCircle className="h-6 w-6" />
          {/* Notification badge for unread messages */}
          {activeSession.messages.filter(m => m.role !== 'system').length > 2 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
          )}
        </Button>
      ) : (
        // Chat window
        <div
          className={`bg-black/90 border border-white/20 rounded-lg shadow-2xl backdrop-blur-sm transition-all duration-200 ${
            isMinimized
              ? 'w-80 h-12'
              : 'w-96 h-96 sm:w-[450px] sm:h-[500px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">
                {activeSession.context.sessionType === 'debugging' ? 'Debug Chat' : 'Solution Chat'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={isMinimized ? handleRestore : handleMinimize}
                className="w-6 h-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                className="w-6 h-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Chat content */}
          {!isMinimized && (
            <div className="h-[calc(100%-49px)]">
              <ChatInterface />
            </div>
          )}
        </div>
      )}
    </div>
  );
}