---
type: feedback
description: 英语学习产品的内容长度和来源不应由 AI 固定，应作为用户可控筛选条件
created: 2026-05-08
updated: 2026-05-08
occurrences: 1
graduated: true
graduated_date: 2026-05-14
graduated_to: .claude/skills/product-spec-builder/SKILL.md [反模式守门].3 内容控制交给用户
graduated_note: occurrences=1 未达单独毕业阈值；批量毕业为反模式守门
source_skill: product-spec-builder
---

# product-spec-builder 内容控制应交给用户

**问题描述**：在英语学习项目需求收集中，AI 把文章长度当成需要用户单选的产品决策，用户纠正短文和长文理论上应由用户自行选择。

**触发场景**：用户说：“两者都有 理论短文和长文不是用户自行选择的嘛”，随后确认内容搜索应支持输入，也应有默认 Tab 给用户选择。

**教训/建议**：product-spec-builder 遇到内容型学习产品时，不应把内容长度、类型、来源固定成单一路径；应优先设计为用户可筛选的内容控制能力，例如默认分类 Tab、关键词输入、长度筛选、难度筛选和学习模式筛选。
