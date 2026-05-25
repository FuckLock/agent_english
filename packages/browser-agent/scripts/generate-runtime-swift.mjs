import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const checkOnly = process.argv.includes("--check");
const require = createRequire(import.meta.url);

const workspaceRoot = path.resolve(import.meta.dirname, "../../..");
const runtimeSourcePath = path.resolve(
  import.meta.dirname,
  "../src/browser-runtime-source.ts",
);
const compiledRuntimePath = path.resolve(
  import.meta.dirname,
  "../dist/browser-runtime-source.js",
);
const generatedSwiftPath = path.resolve(
  workspaceRoot,
  "apps/ios/AgentEnglish/Generated/BrowserAgentRuntimeSource.generated.swift",
);

function loadRuntimeSource() {
  if (fs.existsSync(compiledRuntimePath)) {
    const runtimeModule = require(compiledRuntimePath);
    if (typeof runtimeModule.BROWSER_AGENT_RUNTIME_SOURCE === "string") {
      return runtimeModule.BROWSER_AGENT_RUNTIME_SOURCE;
    }
  }

  const runtimeModuleSource = fs.readFileSync(runtimeSourcePath, "utf8");
  const runtimeMatch = runtimeModuleSource.match(
    /BROWSER_AGENT_RUNTIME_SOURCE\s*=\s*String\.raw`([\s\S]*)`;/,
  );

  if (runtimeMatch) {
    return runtimeMatch[1];
  }

  throw new Error(
    `Failed to extract runtime source from ${path.relative(workspaceRoot, runtimeSourcePath)}.`,
  );
}

const runtimeSource = loadRuntimeSource();
const generatedSwiftSource = [
  "import Foundation",
  "",
  "enum BrowserAgentRuntimeSource {",
  "    // Generated from packages/browser-agent/src/browser-runtime-source.ts.",
  "    static let source = #\"\"\"",
  runtimeSource,
  "\"\"\"#",
  "}",
  "",
].join("\n");

const existingSwiftSource = fs.existsSync(generatedSwiftPath)
  ? fs.readFileSync(generatedSwiftPath, "utf8")
  : null;

if (checkOnly) {
  if (existingSwiftSource !== generatedSwiftSource) {
    console.error(
      `${path.relative(workspaceRoot, generatedSwiftPath)} is out of sync with ${path.relative(workspaceRoot, runtimeSourcePath)}.`,
    );
    process.exit(1);
  }

  console.log(
    `${path.relative(workspaceRoot, generatedSwiftPath)} is in sync.`,
  );
  process.exit(0);
}

fs.mkdirSync(path.dirname(generatedSwiftPath), { recursive: true });
fs.writeFileSync(generatedSwiftPath, generatedSwiftSource);
console.log(
  `Generated ${path.relative(workspaceRoot, generatedSwiftPath)} from ${path.relative(workspaceRoot, runtimeSourcePath)}.`,
);
