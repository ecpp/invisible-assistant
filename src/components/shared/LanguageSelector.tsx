import React from "react"
import { CustomDropdown } from "../ui/CustomDropdown"

interface LanguageSelectorProps {
  currentLanguage: string
  setLanguage: (language: string) => void
}

const LANGUAGE_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "golang", label: "Go" },
  { value: "cpp", label: "C++" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "ruby", label: "Ruby" },
  { value: "sql", label: "SQL" },
  { value: "r", label: "R" },
  { value: "csharp", label: "C#" }
]

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  setLanguage
}) => {
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      // Save language preference to electron store
      await window.electronAPI.updateConfig({ language: newLanguage })
      
      // Update global language variable
      window.__LANGUAGE__ = newLanguage
      
      // Update state in React
      setLanguage(newLanguage)
      
      console.log(`Language changed to ${newLanguage}`);
    } catch (error) {
      console.error("Error updating language:", error)
    }
  }

  return (
    <div className="mb-3 px-2 space-y-1">
      <div className="flex items-center justify-between text-[11px] font-medium text-white/90">
        <span>Language</span>
        <CustomDropdown
          value={currentLanguage}
          options={LANGUAGE_OPTIONS}
          onChange={handleLanguageChange}
        />
      </div>
    </div>
  )
}
