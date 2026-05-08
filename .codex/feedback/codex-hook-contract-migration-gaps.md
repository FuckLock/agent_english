---
type: feedback
description: Codex 迁移后 AGENTS.md 不能只保留笼统 Hook 闭环，必须逐项写明 hook 的真实能力和边界
created: 2026-05-08
updated: 2026-05-08
occurrences: 1
graduated: false
source_skill: N/A
---

# Codex hook 契约迁移缺口

**问题描述**：AGENTS.md 只描述了跨 Skill / Hook 闭环，没有逐项说明 `.codex/hooks.json` 中每个 hook 的来源、脚本、能力边界和主 Agent 承接动作，导致用户质疑 detect-feedback-signal 是否会自动触发 feedback-observer。

**触发场景**：用户对照旧项目 `.claude/CLAUDE.md` 的 Hook 契约，指出当前 AGENTS.md 没有说明 UserPromptSubmit 命中后是否会触发 feedback-observer，并要求检查是否还有其他 hook 契约被忽略。

**教训/建议**：Claude → Codex 迁移时，不应只迁移 hook 脚本和简化闭环描述；必须在 AGENTS.md 中按当前 Codex 实际语义写清每个 hook：来源、脚本、当前能力、模式、主 Agent 动作和禁止误判，尤其要标明 Codex hook 不会自动派发 custom agent。
