import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const checkOnly = process.argv.includes("--check");

const workspaceRoot = path.resolve(import.meta.dirname, "../../..");
const runtimeSourcePath = path.resolve(
  import.meta.dirname,
  "../src/browser-runtime-source.ts",
);
const generatedSwiftPath = path.resolve(
  workspaceRoot,
  "apps/ios/AgentEnglish/Generated/BrowserAgentRuntimeSource.generated.swift",
);

const runtimeModuleSource = fs.readFileSync(runtimeSourcePath, "utf8");
const runtimeMatch = runtimeModuleSource.match(
  /BROWSER_AGENT_RUNTIME_SOURCE\s*=\s*String\.raw`([\s\S]*)`;/,
);

if (!runtimeMatch) {
  throw new Error(
    `Failed to extract runtime source from ${path.relative(workspaceRoot, runtimeSourcePath)}.`,
  );
}

const runtimeSource = runtimeMatch[1];
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
