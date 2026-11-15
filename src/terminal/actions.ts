import type { Action } from "./commands";
import { applyTheme } from "../lib/theme";
import { openItem } from "../lib/launcher";
import { scrollToSection, setMatrix } from "../lib/effects";

/** Executes the side effect a command asked for. `clear` is handled by the terminal itself. */
export function performAction(action: Action) {
  switch (action.type) {
    case "navigate":
      scrollToSection(action.target);
      break;
    case "theme":
      applyTheme(action.value);
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
