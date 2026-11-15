/**
 * @file Application entry point. Applies the saved scene, then mounts React.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyScene, getScene } from "./lib/scene";
import "./index.css";

// Set the scene before the first paint, so the page never flashes the wrong palette.
applyScene(getScene());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
