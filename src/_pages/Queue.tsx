import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import QueueCommands from "../components/Queue/QueueCommands"
import { Send, MessageCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "../components/ui/button"

import { useToast } from "../contexts/toast"
import { Screenshot } from "../types/screenshots"

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots()
    return existing
  } catch (error) {
    console.error("Error loading screenshots:", error)
    throw error
  }
}

interface QueueProps {
  setView: (view: "queue" | "solutions" | "debug") => void
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}

const Queue: React.FC<QueueProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage
}) => {
  const { showToast } = useToast()

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const [textInput, setTextInput] = useState("")
  const [isProcessingText, setIsProcessingText] = useState(false)
  const [isQuestionPanelCollapsed, setIsQuestionPanelCollapsed] = useState(() => {
    // Load initial state from localStorage, default to collapsed
    const saved = localStorage.getItem('questionPanelCollapsed');
    return saved !== null ? saved === 'true' : true; // Default collapsed
  })
  const contentRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const {
    data: screenshots = [],
    isLoading,
    refetch
  } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false
  })

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch() // Refetch screenshots instead of managing state directly
      } else {
        console.error("Failed to delete screenshot:", response.error)
        showToast("Error", "Failed to delete the screenshot file", "error")
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error)
    }
  }

  useEffect(() => {
    // Height update logic
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onDeleteLastScreenshot(async () => {
        if (screenshots.length > 0) {
          const lastScreenshot = screenshots[screenshots.length - 1];
          await handleDeleteScreenshot(screenshots.length - 1);
          // Toast removed as requested
        } else {
          showToast("No Screenshots", "There are no screenshots to delete", "neutral");
        }
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error processing your screenshots.",
          "error"
        )
        setView("queue") // Revert to queue if processing fails
        console.error("Processing error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no screenshots to process.",
          "neutral"
        )
      }),
      // Removed out of credits handler - unlimited credits in this version
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight, screenshots])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleOpenSettings = () => {
    window.electronAPI.openSettingsPortal();
  };

  // Save question panel state to localStorage
  useEffect(() => {
    localStorage.setItem('questionPanelCollapsed', isQuestionPanelCollapsed.toString());
  }, [isQuestionPanelCollapsed]);

  const toggleQuestionPanel = () => {
    setIsQuestionPanelCollapsed(prev => !prev);
  };

  const handleTextSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!textInput.trim() || isProcessingText) {
      return;
    }

    const problemText = textInput.trim();
    setIsProcessingText(true);

    try {
      // Send text directly for processing
      await window.electronAPI.processText({
        text: problemText,
        language: currentLanguage
      });
      
      // Clear input after successful submission
      setTextInput("");
      
      // Show success message
      showToast("Processing", "Your question is being processed", "neutral");
    } catch (error) {
      console.error("Error processing text:", error);
      showToast("Error", "Failed to process your question", "error");
    } finally {
      setIsProcessingText(false);
    }
  };
  
  return (
    <div ref={contentRef} className={`bg-transparent w-full`}>
      <div className="px-4 py-3">
        <div className="space-y-3">
          {/* Text Input Section */}
          <div className={`transition-all duration-200 ${
            isQuestionPanelCollapsed 
              ? 'w-fit' 
              : 'bg-black/60 rounded-lg border border-white/10'
          }`}>
            {/* Collapsed state - just icon */}
            {isQuestionPanelCollapsed ? (
              <Button
                onClick={toggleQuestionPanel}
                variant="ghost"
                className="p-3 text-white/60 hover:text-white hover:bg-black/60 rounded-lg border border-white/10 transition-colors"
                title="Ask a direct coding question"
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
            ) : (
              /* Expanded state - full panel */
              <>
                {/* Header with collapse toggle */}
                <div className="flex items-center gap-2 p-4 pb-3">
                  <MessageCircle className="h-5 w-5 text-white" />
                  <h3 className="text-white font-medium text-sm">Direct Question</h3>
                  <Button
                    onClick={toggleQuestionPanel}
                    variant="ghost"
                    size="sm"
                    className="ml-auto p-1 text-white/60 hover:text-white hover:bg-white/10"
                    title="Collapse question panel"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Form content */}
                <div className="px-4 pb-4">
                  <form onSubmit={handleTextSubmit} className="space-y-3">
                  <textarea
                    ref={textAreaRef}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type or paste your coding question here..."
                    className="w-full min-h-[100px] p-3 bg-white/10 border border-white/20 rounded-md text-white placeholder:text-white/50 resize-none focus:outline-none focus:border-white/40 focus:bg-white/15 transition-colors"
                    disabled={isProcessingText}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        handleTextSubmit();
                      }
                    }}
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">
                      Press Ctrl+Enter to submit
                    </span>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!textInput.trim() || isProcessingText}
                      className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4"
                    >
                      {isProcessingText ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Process Question
                        </>
                      )}
                    </Button>
                  </div>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* Divider */}
          {screenshots.length > 0 && (
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-white/40 text-xs">OR</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>
          )}

          {/* Screenshot Queue */}
          <ScreenshotQueue
            isLoading={false}
            screenshots={screenshots}
            onDeleteScreenshot={handleDeleteScreenshot}
          />

          {/* Commands */}
          <QueueCommands
            onTooltipVisibilityChange={handleTooltipVisibilityChange}
            screenshotCount={screenshots.length}
            credits={credits}
            currentLanguage={currentLanguage}
            setLanguage={setLanguage}
          />
        </div>
      </div>
    </div>
  )
}

export default Queue
