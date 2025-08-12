import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { ChatInterface } from './ChatInterface';
import { useConversation } from '../../contexts/ConversationContext';

interface CollapsibleChatProps {
  className?: string;
}

export function CollapsibleChat({ className = '' }: CollapsibleChatProps) {
  const { activeSession } = useConversation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem('chatPanelCollapsed');
    return saved === 'true';
  });

  // Save state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('chatPanelCollapsed', isCollapsed.toString());
    // Trigger storage event for other components
    window.dispatchEvent(new Event('storage'));
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  // Don't show if there's no active session
  if (!activeSession) {
    return null;
  }

  return (
    <div 
      className={`fixed right-0 top-0 h-full bg-black/95 border-l border-white/20 transition-all duration-300 z-40 ${className} ${
        isCollapsed ? 'w-12' : 'w-96'
      }`}
    >
      {/* Collapse/Expand Button */}
      <Button
        onClick={toggleCollapse}
        variant="ghost"
        size="sm"
        className={`absolute top-4 z-50 text-white/60 hover:text-white hover:bg-white/10 ${
          isCollapsed ? 'left-2' : 'left-2'
        }`}
        title={isCollapsed ? 'Expand chat' : 'Collapse chat'}
      >
        {isCollapsed ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>

      {/* Collapsed State - Show icon */}
      {isCollapsed && (
        <div className="flex flex-col items-center justify-center h-full">
          <MessageCircle className="h-5 w-5 text-white/60" />
          <span 
            className="text-white/60 text-xs mt-2"
            style={{ 
              writingMode: 'vertical-rl',
              textOrientation: 'mixed'
            }}
          >
            Chat
          </span>
        </div>
      )}

      {/* Expanded State - Show chat */}
      {!isCollapsed && (
        <div className="h-full pl-10">
          <ChatInterface className="h-full" />
        </div>
      )}
    </div>
  );
}