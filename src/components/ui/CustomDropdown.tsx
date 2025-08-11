import React, { useState, useRef, useEffect } from 'react'

interface DropdownOption {
  value: string
  label: string
}

interface CustomDropdownProps {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  options,
  onChange,
  className = "",
  placeholder = "Select..."
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(option => option.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`} data-dropdown="true">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="bg-black/80 text-white/90 rounded px-1.5 py-0.5 text-[11px] outline-none border border-white/10 focus:border-white/20 hover:border-white/20 transition-colors flex items-center justify-between min-w-[80px]"
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onWheel={(e) => {
          e.stopPropagation()
        }}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <svg 
          className={`w-3 h-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-1 bg-black/90 border border-white/20 rounded shadow-lg z-50 min-w-full max-h-48 overflow-y-auto"
          style={{
            backdropFilter: 'blur(8px)',
            zIndex: 9999
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
          onWheel={(e) => {
            e.stopPropagation()
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleOptionClick(option.value)}
              className={`w-full text-left px-2 py-1.5 text-[11px] hover:bg-white/10 transition-colors ${
                option.value === value ? 'bg-white/20 text-white' : 'text-white/90'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}