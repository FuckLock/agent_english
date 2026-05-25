import { RUNTIME_BOOTSTRAP_SOURCE } from "./runtime-source/bootstrap";
import { RUNTIME_SCANNER_SOURCE } from "./runtime-source/scanner";
import { RUNTIME_UI_BRIDGE_SOURCE } from "./runtime-source/ui-bridge";

export const BROWSER_AGENT_RUNTIME_SOURCE = [
  RUNTIME_BOOTSTRAP_SOURCE,
  RUNTIME_SCANNER_SOURCE,
  RUNTIME_UI_BRIDGE_SOURCE,
].join("\n");
