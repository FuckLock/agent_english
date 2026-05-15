---
type: feedback
description: AI 英语学习产品应支持多 Provider Adapter 配置，不能把 grsai 或官方 API 写死成单一接口
created: 2026-05-08
updated: 2026-05-10
occurrences: 3
graduated: true
graduated_date: 2026-05-14
graduated_to: .claude/skills/product-spec-builder/SKILL.md [AI Provider 配置最小集]
source_skill: product-spec-builder
---

# product-spec-builder 多模型供应商配置

**问题描述**：在英语学习产品需求收集中，AI 讨论了接入图片模型和文字模型，但用户进一步指出模型应支持不同厂商配置，并应有设置界面。

**触发场景**：用户说：“当然文字模型和图片模型应该可以根据不同的厂商就行配置，应该有个设置界面啥的。”随后补充当前第三方图片模型使用 grsai，需要支持。后续又修正：grsai 不是固定某一个 API 或模型，而是在配置界面里支持 grsai 这类 API，同时也要支持 OpenAI、Google 官方 API，并可配置 GPT 或其他模型。

**教训/建议**：product-spec-builder 涉及 AI 能力时，不应只写单一模型接入；应确认是否需要多供应商、多模型配置、API Key 管理、默认模型选择、测试连接和前后端密钥隔离等产品能力。涉及 grsai 时，不要把它理解成单一图片模型或固定 endpoint，而应抽象为可配置 Provider：Host、Path、模型名、鉴权、Request Mapping、Response Mapping、异步轮询都应可配置。官方 OpenAI / Google API 和 OpenAI-compatible / 自定义 API 也要作为同一套 Provider Adapter 能力处理。
