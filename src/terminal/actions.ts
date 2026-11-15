/**
 * @file Side effects for terminal commands and command palette actions.
 */
import type { Action } from "./commands";
import { applyScene } from "../lib/scene";
import { openItem } from "../lib/launcher";
import { scrollToSection, setMatrix } from "../lib/effects";

/** Executes the side effect a command asked for. `clear` is handled by the terminal itself. */
export function performAction(action: Action) {
  switch (action.type) {
    case "navigate":
      scrollToSection(action.target);
      break;
    case "scene":
      applyScene(action.value);
      break;
    case "open":
      openItem(action.id);
      break;
    case "matrix":
      setMatrix(true);
      break;
    case "clear":
      break;
  }
}
