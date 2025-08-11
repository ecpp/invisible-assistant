import React, { useEffect, useState, useRef } from 'react'

interface WindowResizerProps {
  children: React.ReactNode
}

export const WindowResizer: React.FC<WindowResizerProps> = ({ children }) => {
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentHeightRef = useRef<number>(600) // Default height

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const handleWheel = async (e: WheelEvent) => {
      // Only handle if Ctrl is pressed
      if (!isCtrlPressed) return

      // Don't resize if scrolling on a dialog or modal
      const target = e.target as HTMLElement
      if (target.closest('[role="dialog"]') || target.closest('.fixed.z-50')) {
        return
      }

      // Prevent default zoom behavior
      e.preventDefault()
      e.stopPropagation()

      // Get current window bounds
      const bounds = await window.electronAPI.getWindowBounds()
      if (!bounds) return

      currentHeightRef.current = bounds.height

      // Calculate new height based on scroll direction
      const delta = e.deltaY > 0 ? -20 : 20 // Decrease on scroll down, increase on scroll up
      const newHeight = Math.max(200, Math.min(1200, currentHeightRef.current + delta))

      // Update window height
      await window.electronAPI.setWindowBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: newHeight
      })

      currentHeightRef.current = newHeight
    }

    // Add the wheel event listener with passive: false to allow preventDefault
    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel)
      }
    }
  }, [isCtrlPressed])

  return (
    <div 
      ref={containerRef}
      className={`h-full w-full ${isCtrlPressed ? 'cursor-ns-resize' : ''}`}
    >
      {children}
    </div>
  )
}