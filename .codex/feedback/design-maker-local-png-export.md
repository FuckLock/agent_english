---
type: feedback
description: design-maker 在 MCP 生成后应强制导出本地 PNG，避免只有设计工具内产物、开发阶段缺少可直接对照的图片文件
created: 2026-05-10
updated: 2026-05-11
occurrences: 4
graduated: true
graduated_date: 2026-05-14
graduated_to: .claude/skills/design-maker/checklists/local-png-export.md + SKILL.md [设计交付物].5
source_skill: design-maker
---

# design-maker MCP 产物需要本地 PNG 导出

**问题描述**：用户指出 design-maker 生成 MCP 设计稿后，还应把设计稿导出到本地 `design_export/` 目录保存为 PNG；如果目录不存在，应先创建目录。

**触发场景**：完成 Pencil MCP 设计稿后，Skill 原流程只要求输出设计完成报告，没有把本地 PNG 导出列为硬交付。后续实际回放导出流程时，`export_nodes` 报告可能引用了错误 `.pen` 文件，同时发现总设计容器可能只挂载状态区，页面区/组件区脱离容器，导致“总设计容器导出”存在不完整风险。继续排查后发现，Pencil `export_nodes` 对多节点批量导出、宽/复杂总览节点不稳定，单节点逐个导出更可靠，且需要按节点复杂度降低 scale。用户进一步指出，替代导出成功后，旧 PNG 如果不再作为交付依据必须删除，否则会误导后续查看者。

**教训/建议**：design-maker 的 MCP 模式完成标准应包含本地 PNG 导出。流程中需要明确创建 `design_export/`、调用设计 MCP 导出 PNG、确认文件真实存在，并把 PNG 路径写入最终报告。导出前还必须确认当前活动设计文件、导出节点存在、总设计容器包含 Header / Variables / Components / Pages / State Variants，并在 `.pen` 文件引用错误时只允许恢复重试一次，失败后明确报告。Pencil 导出应优先单节点循环：单页面 `scale: 1`，组件/页面行/状态总览 `scale: 0.5`，总设计容器 `scale: 0.25`；页面总览失败时，用页面行 + 每个页面 frame 替代覆盖。若某个旧 PNG 已被新导出替代或明确不再作为交付依据，应在报告前删除或移入非交付位置，避免 `design_export/` 混入过期文件。
