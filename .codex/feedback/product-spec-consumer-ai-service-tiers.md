---
type: feedback
description: 消费级 AI 产品不应默认暴露 Provider / API Key / BYOK 配置，应先区分后台模型运营和用户可见服务等级
created: 2026-05-22
updated: 2026-05-22
occurrences: 1
graduated: false
source_skill: product-spec-builder
---

# product-spec-builder 消费级 AI 服务等级边界

**问题描述**：用户明确修正“高级设置里可以保留自定义 Provider / 自带 API Key”的建议，指出这类配置不需要给用户。此前需求和实现倾向把 Provider 配置作为用户设置项，导致普通用户要面对 API Key、Base URL、模型名等工程概念。

**触发场景**：在 iPhone 英语学习浏览器讨论 Free / Pro / Max 模型等级时，用户决定模型和 API 信息应由后台统一配置，用户只选择或看到服务等级和可用模型档位。

**教训/建议**：面向普通用户的 AI 产品，应默认把 Provider 密钥、模型目录、fallback、额度和成本控制放在后台；前台只展示 Free / Pro / Max、用量状态、隐私说明和可读模型名。BYOK / 自定义 Provider 只有在明确面向开发者或用户主动要求时才进入产品范围。
