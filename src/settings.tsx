import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import { SettingsWindow } from "./components/Settings/SettingsWindow"

// Initialize the settings window
const root = ReactDOM.createRoot(document.getElementById("settings-root")!)

root.render(
  <React.StrictMode>
    <SettingsWindow />
  </React.StrictMode>
)