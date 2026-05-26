# ADR-0004: YouTube Video Immersive Translation Mode

## Status

Accepted, amended by Product-Spec v2.4

## Date

2026-05-24

Amended: 2026-05-25

## Context

Product-Spec v2.3 将 YouTube watch / Shorts 从普通网页阅读模式中拆出。用户打开 YouTube 视频时，主任务是继续按 YouTube 原方式刷视频，而不是进入一个阅读器界面。当前实现截图暴露的问题是：视频页底部展示“原文 / 双语 / 学习”分段控件和 App chrome，导致 YouTube 内容被挤压，也把视频场景误当成文章翻译场景。

同时，YouTube 相关能力有明确合规风险：产品不能做 YouTube 替代客户端，不能下载视频或完整字幕文件，不能去广告，不能替换或遮挡播放器核心控件、品牌区域和链接。视频翻译必须作为学习增强，而不是播放器控制或内容搬运。

Product-Spec v2.4 进一步明确：视频翻译不能只依赖字幕。真实 YouTube watch / Shorts 经常没有可访问字幕，用户希望无字幕时也能翻译。因此产品采用“字幕翻译优先 + 听音翻译 Beta 兜底”的双路径：Free 也可使用听音翻译，但每天限制 10 分钟；Pro / Max 提供更高额度和更稳定识别。

## Decision

YouTube watch / Shorts 页面采用独立的“视频沉浸翻译模式”：

- 不使用文本型网页的“原文 / 双语 / 学习”阅读模式控件。
- App chrome 在视频页降到最低，只保留返回、翻译状态、重试和必要错误提示。
- 视频翻译来源默认优先使用可访问字幕或页面可见字幕文本。
- 字幕不可用、质量明显不足或用户手动选择时，进入“听音翻译 Beta”，由后端 ASR / 模型服务对短音频片段识别并翻译。
- Free 用户每天有 10 分钟听音翻译额度；Pro / Max 由后端 entitlement 下发更高额度。客户端只展示额度，不作为授权事实源。
- `packages/browser-agent/src/site-adapters/youtube.ts` 负责识别 watch / Shorts 页面、字幕可用性、当前可见 / 可访问字幕句和安全显示区域。
- `packages/browser-agent/src/overlay/video-caption-overlay.ts` 负责视频字幕叠层、听音翻译叠层和视频下方降级字幕条。
- `packages/contracts/src/video-caption.ts` 定义 `VideoCaptionSegment` 与 `VideoCaptionOverlayState`，Swift DTO 必须通过 fixture 测试保持字段等价。
- 听音翻译新增 `VideoAudioSegment`、`VideoAudioTranslationState` 和 `AudioTranslationQuota` contract，Swift DTO 必须通过 fixture 测试保持字段等价。
- 翻译请求仍由 native `ModelServiceClient` 调用 `services/model-gateway`，后端按 session entitlement 授权；JS 不直接调用模型服务。
- 听音翻译请求仍走 `services/model-gateway`，后端负责 ASR 密钥、短片段处理、分钟额度、重试、错误归一和 fallback；JS 和 iOS App 不保存 ASR / Provider 密钥。
- 听音翻译必须用户可见、可关闭、可停止、按分钟计量；音频片段默认不持久化，不下载 / 分离 YouTube 音视频，不保存完整音频。
- 如果视频画面上无法安全显示字幕，必须降级为视频下方字幕条或轻提示。

## Consequences

- 普通文本网页和 YouTube 视频页拥有不同交互模型，避免把阅读器控件套到视频页。
- Phase 6.6 必须先修正浏览器 chrome 和 YouTube 视频模式基线，再继续 Phase 7 的历史 / 复习扩展。
- Phase 6.7 必须补齐听音翻译 Beta：ASR 路由、音频分钟额度、Free 10 分钟限制、隐私提示、听音状态和 overlay 表达。
- Phase 8 在 Phase 6.6 / 6.7 基线上完善 YouTube 字幕翻译、听音 fallback、页面文字翻译和其他站点适配。
- YouTube 字幕不可用、模型服务失败、额度不足和安全区域不足都属于正常产品状态，不能伪装成功。
- 听音翻译会引入更高后端成本、延迟、音质失败和隐私提示要求，必须被当成 Beta 能力而不是无限制默认能力。

## Rejected Options

| Option | Reason Rejected |
|---|---|
| 继续复用普通网页“原文 / 双语 / 学习”分段控件 | 阅读器交互会挤压视频主体，和用户刷 YouTube 的行为冲突。 |
| 强行覆盖视频画面所有区域 | 容易遮挡 YouTube 控件、广告、品牌区域或链接，合规和体验风险都高。 |
| 下载完整字幕后自行播放 | 超出当前产品边界，也增加 YouTube 政策和内容搬运风险。 |
| 无限制 / 后台 / 下载音视频后的实时转写 | 成本、延迟、权限、隐私和合规风险都不可接受；当前只接受用户可见启用、按分钟计量、短片段处理的听音翻译 Beta。 |

## Non-Goals

- 不做 YouTube 替代客户端。
- 不下载视频、音频或完整字幕文件。
- 不去广告、不后台播放、不分离音视频。
- 不做无限制听音识别、后台听音识别、下载音视频后转写或保存完整音频。
- 不在 YouTube 视频页展示阅读型底部分段控件。
