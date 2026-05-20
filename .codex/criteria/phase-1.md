---
phase_id: Phase 1
status: locked
spec_refs:
  - "Product-Spec.md#7 技术方向"
  - "Product-Spec.md#8.1 WebView 与脚本注入"
  - "Product-Spec.md#8.3 App Store 边界"
  - "Product-Spec.md#9.1 MVP 范围"
  - "Product-Spec.md#10 非目标"
  - "Product-Spec.md#11 验收指标"
plan_refs:
- "DEV-PLAN.md#Phase 1: Workspace 骨架 + Contracts / Browser-Agent 最小包"
round: 2
---

[架构拆分说明]
本 criteria 对应原 first implementation tranche 的第 1/3 段，只验证 workspace + `packages/contracts` + `packages/browser-agent` 最小包。
原生壳、SwiftData / Keychain、本地学习闭环进入 `DEV-PLAN.md` 的 Phase 2；`WKWebView` 可进入页面、`BridgeEvent` native decode、website data 提示进入 `DEV-PLAN.md` 的 Phase 3。
该拆分来自 `DEV-PLAN.md` 的架构约束摘要，用于把原单体 Phase 1 拆成新的 Phase 1-3，不是否定 `ARCHITECTURE.md`、`PROJECT-STRUCTURE.md` 或 `docs/adr/ADR-0001-architecture-strategy.md` 的总体边界。

[功能验证 criteria]
- 交付项：根 workspace 只把 `packages/contracts` 与 `packages/browser-agent` 纳入首批 Node 工具链，根脚本不再把旧 Next / Drizzle 当作产品入口
  验证手段：文件存在 + Grep 模式
  验证条件：
    - 文件存在：`package.json`、`pnpm-workspace.yaml`、`packages/contracts/package.json`、`packages/browser-agent/package.json`
    - Grep 模式：`pnpm-workspace.yaml` 同时命中 `packages/contracts` 与 `packages/browser-agent`
    - Grep 模式：`pnpm-workspace.yaml` 不命中 `packages/*`、`packages/**`、`apps/ios`、`apps/android`、`apps/macos`、`apps/windows`、`src`
    - Grep 模式：`package.json` 命中根脚本键 `build` 与 `check`
    - Grep 模式：`package.json` 的脚本值不命中 `next dev`、`next build`、`next start`、`src/server/db/migrate.ts`、`src/server/db/seed.ts`、`src/server/db/self-test.ts`

- 交付项：`packages/contracts` 提供唯一的 `BridgeEvent` 协议事实源，并统一导出 schema version、boot 级事件名与 envelope
  验证手段：文件存在 + Grep 模式
  验证条件：
    - 文件存在：`packages/contracts/src/bridge-events.ts`、`packages/contracts/src/index.ts`
    - Grep 模式：`packages/contracts/src/bridge-events.ts` 同时命中 `BridgeEvent`、`schemaVersion`、`eventType`
    - Grep 模式：`packages/contracts/src/bridge-events.ts` 同时命中 `payload`、`result`、`error`
    - Grep 模式：`packages/contracts/src/bridge-events.ts` 同时命中 `boot` 与 `ping`
    - Grep 模式：`packages/contracts/src/index.ts` 命中 `bridge-events`

- 交付项：`packages/browser-agent` 只交付 bootstrap 最小源码面，并通过 contracts 引用 boot / ping 协议
  验证手段：文件存在 + 文件树检查 + Grep 模式
  验证条件：
    - 文件存在：`packages/browser-agent/src/bridge/bootstrap.ts`、`packages/browser-agent/src/index.ts`
    - 文件树检查：命令 `rg --files packages/browser-agent/src` 的输出只允许包含 `packages/browser-agent/src/bridge/bootstrap.ts` 与 `packages/browser-agent/src/index.ts`
    - Grep 模式：`packages/browser-agent/src/bridge/bootstrap.ts` 同时命中 `boot`、`ping`
    - Grep 模式：`packages/browser-agent/src/bridge/bootstrap.ts` 同时命中 `import` 与 `contracts`
    - Grep 模式：`packages/browser-agent/src/index.ts` 命中 `bootstrap`

[UI 一致性 criteria]
- 不适用：本 Phase 只交付 workspace、contracts 与 browser-agent 最小包，不包含页面、选择器或像素级 UI 验证项。

[非功能 criteria]
- 交付项：本 Phase 的 TypeScript 校验与构建链可执行，且只覆盖 `packages/contracts` 与 `packages/browser-agent`
  验证手段：编译输出 + 命令退出码
  验证条件：
    - 命令退出码：`pnpm check` 返回 0
    - 命令退出码：`pnpm build` 返回 0
    - 命令退出码：`pnpm --filter ./packages/contracts build` 返回 0
    - 命令退出码：`pnpm --filter ./packages/browser-agent build` 返回 0

- 交付项：两个 package 的导出配置都能解析到真实构建产物，供后续 native / JS 消费
  验证手段：命令退出码
  验证条件：
    - 命令退出码：`node -e "const fs=require('fs'); const pkgs=['packages/contracts','packages/browser-agent']; for (const dir of pkgs) { const pkg=require('./'+dir+'/package.json'); const entries=[]; const dot=pkg.exports && pkg.exports['.']; if (typeof pkg.exports==='string') entries.push(pkg.exports); if (typeof dot==='string') entries.push(dot); if (dot && typeof dot==='object') for (const v of Object.values(dot)) if (typeof v==='string') entries.push(v); if (typeof pkg.main==='string') entries.push(pkg.main); if (typeof pkg.types==='string') entries.push(pkg.types); const missing=[...new Set(entries.filter(Boolean))].filter((p)=>!fs.existsSync(dir+'/'+p)); if (missing.length) { console.error(dir+':'+missing.join(',')); process.exit(1); } }"` 返回 0

- 交付项：实现未越过本 Phase 的目录职责与模块边界
  验证手段：命令输出 + Grep 模式
  验证条件：
    - 命令输出：`git diff --name-only -- . ':(exclude).codex/criteria' | rg -v '^(package\\.json|pnpm-workspace\\.yaml|pnpm-lock\\.yaml|packages/contracts/.*|packages/browser-agent/.*)$'` 输出为空
    - 命令输出：`git ls-files --others --exclude-standard -- . ':(exclude).codex/criteria' | rg -v '^(package\\.json|pnpm-workspace\\.yaml|pnpm-lock\\.yaml|packages/contracts/.*|packages/browser-agent/.*)$'` 输出为空
    - Grep 模式：`rg -n 'from [\"\\'](react|next|drizzle-orm|better-sqlite3)[\"\\']' packages/contracts/src packages/browser-agent/src` 输出为空
    - Grep 模式：`rg -n 'localStorage|indexedDB|fetch\\(|XMLHttpRequest|querySelector|MutationObserver' packages/browser-agent/src` 输出为空
    - Grep 模式：`rg -n 'browser-agent' packages/contracts/src` 输出为空
