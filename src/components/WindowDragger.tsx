import React, { useState, useRef, useEffect } from 'react'

interface WindowDraggerProps {
  children: React.ReactNode
}

export const WindowDragger: React.FC<WindowDraggerProps> = ({ children }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const windowPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false)
        if (isDragging) {
          setIsDragging(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isDragging])

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (!isCtrlPressed) return
    
    // Prevent default to avoid text selection while dragging
    e.preventDefault()
    setIsDragging(true)
    
    // Store the initial mouse position
    startPosRef.current = { x: e.screenX, y: e.screenY }
    
    // Get the current window position
    const position = await window.electronAPI.getWindowPosition()
    windowPosRef.current = position
  }

  const handleMouseMove = async (e: MouseEvent) => {
    if (!isDragging || !isCtrlPressed) return

    e.preventDefault()
    
    // Calculate the delta
    const deltaX = e.screenX - startPosRef.current.x
    const deltaY = e.screenY - startPosRef.current.y
    
    // Calculate new position
    const newX = windowPosRef.current.x + deltaX
    const newY = windowPosRef.current.y + deltaY
    
    // Update window position through IPC
    await window.electronAPI.setWindowPosition(newX, newY)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      // Add global mouse event listeners when dragging
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isCtrlPressed])

  return (
    <div 
      className={`h-full w-full ${isCtrlPressed ? 'cursor-move' : ''}`}
      onMouseDown={handleMouseDown}
      style={{
        userSelect: isDragging ? 'none' : 'auto',
        WebkitUserSelect: isDragging ? 'none' : 'auto'
      }}
    >
      {children}
    </div>
  )
}