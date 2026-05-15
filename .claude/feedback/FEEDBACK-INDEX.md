# Feedback Index

> 经验教训索引。新建或更新 feedback 文件后，同步更新此索引。
> 格式：每条一行，`- [标题](文件名.md) — 一句话描述（✅ 已毕业 / 留空表示待消化）`
> 模板：templates/feedback-topic-template.md
> 毕业说明：✅ 表示已转化为 Skill 规则或 CLAUDE.md 条目，详见 feedback 文件 frontmatter 的 `graduated_to` 字段。

## product-spec-builder

- [product-spec-builder 越界：在 Spec 阶段做 V1/V2 交付切分](product-spec-scope-boundary.md) — Spec 阶段误问 V1/V2 分期，侵入 dev-planner 职责，应只描述完整产品形态（✅ 已毕业）

## CLAUDE.md / 路由逻辑

- [CLAUDE.md [项目旅程] 状态检测表与线性旅程不一致](claude-md-journey-inconsistent.md) — 状态检测表让 Spec 完成后直跳 /dev-planner，线性旅程里"可选设计阶段"永远不可达，UI-heavy 产品丢失设计分叉（✅ 已毕业）

## design-maker

- [design-maker 未覆盖 Pencil MCP batch_design 的 4 类技术陷阱](design-maker-pencil-mcp-pitfalls.md) — parent 参数不认 binding / 单 batch 内新 id 不可引用 / 特殊字符破坏解析 / get_screenshot 对大容器返回白板缩略图（✅ 2026-05-14 → playbooks/pencil-mcp.md）
