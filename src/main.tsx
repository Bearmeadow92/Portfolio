/**
 * @file Application entry point. Applies the saved theme, then mounts React.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, getTheme } from "./lib/theme";
import "./index.css";

// Apply the saved theme before the first paint to avoid a flash of the default colors.
applyTheme(getTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
