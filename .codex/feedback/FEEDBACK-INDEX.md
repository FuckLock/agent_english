# Feedback Index

> 经验教训索引。新建或更新 feedback 文件后，同步更新此索引。
> 格式：每条一行，`- [标题](文件名.md) — 一句话描述（✅ 已毕业 / 留空表示待消化）`
> 模板：templates/feedback-topic-template.md
> 毕业说明：✅ 表示已转化为 Skill 规则或 CLAUDE.md 条目，详见 feedback 文件 frontmatter 的 `graduated_to` 字段。

## product-spec-builder

- [product-spec-builder 越界：在 Spec 阶段做 V1/V2 交付切分](product-spec-scope-boundary.md) — Spec 阶段误问 V1/V2 分期，侵入 dev-planner 职责，应只描述完整产品形态（✅ 已毕业）
- [product-spec-builder 区分学习习惯与产品边界](product-spec-learning-input-vs-product-scope.md) — 英语学习项目中，不应把用户现有学习方式误判为产品唯一边界，且要确认中文翻译桥梁需求（✅ 2026-05-14 → SKILL [反模式守门].1）
- [product-spec-builder 真实内容与实操学习偏好](product-spec-real-content-practical-learning.md) — 英语学习产品不要默认 AI 生成内容或机械跟读，应 websearch 真实有趣内容并设计实操型任务（✅ 2026-05-14 → SKILL [反模式守门].2）
- [product-spec-builder 快乐优先的游戏化英语学习](product-spec-joy-first-game-learning.md) — 英语学习产品应把快乐学习、游戏化推进和图片驱动放在核心体验前部，Provider 配置只是支撑能力（✅ 2026-05-14 → SKILL [反模式守门].4）
- [product-spec-builder 内容控制应交给用户](product-spec-content-controls-user-choice.md) — 内容型学习产品应支持默认分类 Tab、关键词输入、长度/难度/模式筛选，而不是固定单一路径（✅ 2026-05-14 → SKILL [反模式守门].3）
- [product-spec-builder 多模型供应商配置](product-spec-configurable-ai-providers.md) — AI 产品需求应明确多 Provider Adapter、官方 API、grsai/API 聚合配置、设置界面和密钥隔离（✅ 2026-05-14 → SKILL [AI Provider 配置最小集]）

## AGENTS.md / 路由逻辑

- [AGENTS.md [项目旅程] 状态检测表与线性旅程不一致](claude-md-journey-inconsistent.md) — 状态检测表让 Spec 完成后直跳 /dev-planner，线性旅程里"可选设计阶段"永远不可达，UI-heavy 产品丢失设计分叉（✅ 已毕业）
- [Codex hook 契约迁移缺口](codex-hook-contract-migration-gaps.md) — AGENTS.md 必须逐项写明 `.codex/hooks.json` 中每个 hook 的真实能力边界，尤其说明 hook 不会自动派发 custom agent

## design-maker

- [design-maker 未覆盖 Pencil MCP batch_design 的 4 类技术陷阱](design-maker-pencil-mcp-pitfalls.md) — parent 参数不认 binding / 单 batch 内新 id 不可引用 / 特殊字符破坏解析 / get_screenshot 对大容器返回白板缩略图（✅ 2026-05-14 → playbooks/pencil-mcp.md，提前实施）
- [design-maker MCP 产物需要本地 PNG 导出](design-maker-local-png-export.md) — MCP 生成设计稿后应创建 `design_export/` 并导出 PNG，替代导出后要清理过期 PNG，最终报告必须列出本地文件路径（✅ 2026-05-14 → checklists/local-png-export.md）

## dev-planner

- [dev-planner 需要覆盖 Spec 边界需求](dev-planner-spec-edge-coverage.md) — 生成 DEV-PLAN 时要扫第一版范围、默认决策、结构化输出、状态与数据对象，避免遗漏 TTS、搜索模板、Boss 触发等边界需求
