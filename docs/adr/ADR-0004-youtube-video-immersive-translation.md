# ADR-0004: YouTube Video Immersive Translation Mode

## Status

Accepted, amended by Product-Spec v2.4；v2.5 修订：视频页交互重构为隐形态 / 召唤态（见下方 v2.5 修订段，配套 ADR-0005 翻译分层）；v2.6 修订：YouTube 整站重定位为专门适配的视频站点（整站原生 + SPA 友好注入 + 绝不破坏交互 + 不做页面文字翻译，见下方 v2.6 修订段）；v2.8 修订：字幕来源改为视频自带字幕轨数据 + InnerTube ANDROID client（见下方 v2.8 修订段）；**v2.11 修订：听音翻译改为后端拉音频流 + 自部署 Whisper ASR（推翻 v2.10「iOS 不可行」误判，见下方 v2.11 修订段）**

## Date

2026-05-24

Amended: 2026-05-25

## Context

Product-Spec v2.3 将 YouTube watch / Shorts 从普通网页阅读模式中拆出。用户打开 YouTube 视频时，主任务是继续按 YouTube 原方式刷视频，而不是进入一个阅读器界面。当前实现截图暴露的问题是：视频页底部展示“原文 / 双语 / 学习”分段控件和 App chrome，导致 YouTube 内容被挤压，也把视频场景误当成文章翻译场景。

同时，YouTube 相关能力有明确合规风险：产品不能做 YouTube 替代客户端，不能下载视频或完整字幕文件，不能去广告，不能替换或遮挡播放器核心控件、品牌区域和链接。视频翻译必须作为学习增强，而不是播放器控制或内容搬运。

Product-Spec v2.4 进一步明确：视频翻译不能只依赖字幕。真实 YouTube watch / Shorts 经常没有可访问字幕，用户希望无字幕时也能翻译。因此产品采用“字幕翻译优先 + 听音翻译 Beta 兜底”的双路径：Free 也可使用听音翻译，但每天限制 10 分钟；Pro / Max 提供更高额度和更稳定识别。

Product-Spec v2.5 修订视频页交互：此前实现把字幕 / 听音控制做成视频页底部常驻工具条（约 7 个按钮 + 状态栏），仍在挤压 YouTube 播放区域，违背“App chrome 降到最低”的初衷。v2.5 把视频页重构为“隐形态 + 召唤态”——隐形态下 App 自身 UI 整体隐藏、YouTube 独占屏幕，只保留视频上的双语字幕叠层（内容层）和一个左侧低存在感半透明召唤把手；召唤态下点把手浮出精简胶囊菜单。字幕 / 听音翻译能力本身不变，只改交互结构。

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

### v2.5 修订（视频页交互结构，配套 ADR-0005 翻译分层）

- 视频页不在屏幕底部或顶部常驻任何工具条 / 状态栏 / 分段控件；进入视频页即进入隐形态，App 自身 UI 整体隐藏，YouTube 独占屏幕。
- 隐形态下唯一常驻的 App 元素是视频左侧中部的半透明召唤把手（低存在感）；视频上的双语字幕叠层属内容层、可常驻，不计入 App 控件。
- 召唤态：点把手浮出半透明精简胶囊菜单，仅含返回、翻译开关、字幕 / 听音来源切换、收藏当前句四项，操作完或点空白即收回，不长期占屏。
- 召唤把手与菜单的渲染载体（native 浮层 vs `browser-agent` overlay）由实现按层次边界划分；无论哪种都不得遮挡 YouTube 播放器控件、进度条、右侧点赞 / 评论 / 分享、频道信息与品牌区域，无法安全叠加时降级。
- 由 DEV-PLAN Phase 8.6 落地；该 phase 不重做字幕 / 听音翻译能力，只改交互结构。

### v2.6 修订（YouTube 整站重定位 + SPA 友好注入）

真机验证 v2.5 实现暴露两个问题：① v2.5 只把视频播放页特殊化，YouTube 首页 / 列表仍走通用文本网页管线、套了“原文 / 双语 / 学习”阅读模式控件 + 浏览工具条；② browser-agent 注入（`.atDocumentEnd` 一次性注入 + 全量 DOM 扫描 + 全局 touch/mouse 事件监听 + fixed overlay + 不监听 SPA 路由）破坏了 YouTube 单页应用的原生滑动 / 点击 / 路由。v2.6 把 YouTube 从“通用文本网页 + 视频页特殊”重定位为“专门适配的视频站点”：

- YouTube 整站（首页 / 列表 / 搜索 / Shorts / 视频页）不走通用“文本网页全量扫描 + 阅读显示模式 + 注入翻译”管线，按原生体验处理；`apps/ios` WebBrowserView 对 YouTube 整站走极简 chrome，不显示阅读模式分段控件和常驻浏览工具条。YouTube 是否“整站隐形 + 仅视频页叠字幕”的判定不能只看 /watch、/shorts，要覆盖整站。
- `browser-agent` 的 YouTube adapter 改 SPA 友好轻注入：监听前端路由变化（History API / popstate），在 YouTube 内前端路由切换时重新判定页面类型；不做全量 DOM 扫描；不注册会干扰 YouTube 原生滚动 / 点击 / 手势的全局事件监听；overlay 不用会干扰 YouTube 虚拟滚动的布局方式。
- App 在 YouTube 整站的唯一增强是视频播放页的双语字幕叠层（含 v2.5 隐形态 / 召唤态）；YouTube 首页 / 列表 / 搜索不注入翻译逻辑。
- 硬约束（review 阻断项）：YouTube 注入绝不破坏原生交互——上下滑视频列表、点开视频 / Shorts、SPA 前端路由必须正常，不报错、不卡。
- 本版不做 YouTube 页面文字翻译（标题 / 简介 / 评论 / 搜索结果），该能力从当前范围移除、留作后续。
- 由 DEV-PLAN 新增的 “YouTube 整站沉浸重构” phase 落地。

### v2.8 修订（视频字幕来源：渲染 DOM / 可见字幕 → 视频自带字幕轨数据）

真机验证暴露：v2.4–v2.7 的字幕来源「读播放器渲染的可见字幕 / DOM（`.ytp-caption-segment`）」只在「横屏 watch + 用户手动开 CC」时可读，翻不了 Shorts（用户核心场景）——Shorts 默认不开 CC、播放器 DOM 不同。竞品（Immersive Translate / Trancy）用「读取视频自带的字幕轨数据」（`ytInitialPlayerResponse` / `movie_player.getPlayerResponse()` 的 `captionTracks` → `timedtext`），不依赖 CC 开启、覆盖 Shorts。

- 字幕来源从「渲染 DOM / 可见字幕」改为「读取视频自带的字幕轨数据（player response / timedtext，含自动生成字幕）」，按播放进度（`video.currentTime`）显示当前句；不依赖用户手动开 CC，覆盖 Shorts 与横屏。
- `browser-agent` 的 YouTube adapter 字幕识别相应重写：读 `captionTracks`（优先英文 / 目标语言 / 自动生成轨）→ 取 `baseUrl`（timedtext，同源 fetch）→ 解析带时间轴的字幕句 → 跟随播放进度；SPA 切视频后用 `getPlayerResponse()` 重取当前视频字幕轨。仍只在视频播放页做字幕翻译（v2.6 整站边界不变）；无字幕轨的视频（如纯烧录字幕）走听音翻译 Beta 或提示。
- 合规边界调整：从「不通过非官方下载接口抓取字幕文件、不保存完整字幕文件」调整为「仅在播放当前视频时实时读取其自带字幕轨数据用于翻译显示、只取当前播放所需、不保存为字幕文件、不离线缓存整轨、不再分发或搬运」；保留不下载视频 / 音频、不分离音视频、不替换 / 遮挡播放器控件 / 广告 / 品牌。
- 风险：字幕轨读取依赖 YouTube 内部接口（WKWebView 移动版 / SPA 路由 / timedtext fetch 鉴权有技术风险，需开发阶段技术验证 + 真机迭代）；YouTube ToS / App Store 审核的长期合规风险由产品方知情采用（与沉浸翻译类竞品同等做法）。
- 由 DEV-PLAN 新增的「YouTube 视频字幕轨读取」phase 落地。

### v2.8 真机修订（player response 获取：DOM 播放器 → InnerTube ANDROID client）

字幕轨方案上真机后仍翻不了 Shorts。根因（自测定位，非视频问题）：iOS WKWebView 未设 customUserAgent → 加载移动版 `m.youtube.com`，其播放器无 `getPlayerResponse()`；Shorts 是 SPA 前端路由，`ytInitialPlayerResponse` 切视频后不更新（仍是首屏 / 上一个视频），导致读不到「当前视频」的 `captionTracks`，proxy 收不到任何字幕翻译请求。

curl 自测对比（同一视频）：
- InnerTube `/youtubei/v1/player` **WEB client** → `captionTracks` **0 条**（即 v2.8 spike 误记的「InnerTube 反爬空」根因——是 client 选错，不是接口不可用）；
- InnerTube **ANDROID client**（`clientName:"ANDROID"`）→ `captionTracks` **6 条**、`playabilityStatus:OK`，且 key 非必需（页面 WEB key / 无 key 均可取）；
- 选轨后 `timedtext baseUrl + &fmt=json3`（先清掉已有 `fmt`）→ json3 正文（`events[].segs[].utf8`）可取（外部 WEB client 的 baseUrl 是 0 字节）。

修订：
- player response 获取改为优先 **InnerTube `/youtubei/v1/player`（ANDROID client，按 URL 中的 videoId 重取）**；只需 videoId、不依赖播放器 DOM 就绪 / 更新，天然覆盖移动版 + Shorts + SPA。`getPlayerResponse()` / `ytInitialPlayerResponse` 降为桌面场景兜底。
- timedtext URL 规整修复：追加 `&fmt=json3` 前先清掉 baseUrl 已有的 `fmt`，否则重复 `fmt` 被取第一个 → 返回 XML 而非 json3。
- InnerTube 请求与 timedtext 一样在 YouTube 页面上下文**同源 fetch**（带 cookie / visitor data），不经 native、不外部抓取；合规边界与 v2.8 相同（只实时读取当前视频字幕轨、不保存 / 不缓存整轨 / 不分离媒体）。
- 落地：`browser-agent` 注入运行时 `fetchPlayerResponseViaInnerTube` + `site-adapters/youtube-caption-track.ts#buildInnerTubePlayerRequest`；纯逻辑层单测 E9 覆盖（InnerTube 优先 / 兜底回退 / Shorts videoId）。

### v2.11 修订（听音翻译：前端采集 → 后端拉音频流 + 自部署 Whisper ASR）

Product-Spec v2.11。听音翻译此前设想「前端采集播放中音频短片段 → 传后端 ASR」，但真机 spike 证明 iOS WKWebView `captureStream()` 采不到 YouTube 跨源播放音频（音频轨数=0，WebKit 防盗录禁用跨源媒体音频采集，平台天花板）。曾据此误判「iOS 听音不可行」（Spec v2.10，**已推翻**）——错在只试了「前端采集」这一条路。

自测定位到可行路径并**端到端验证**：
- InnerTube `/youtubei/v1/player`（ANDROID client）的 `streamingData.adaptiveFormats` **直接提供纯音频流**（itag=139 ~49kbps / itag=140 ~130kbps），**明文 URL、无需解签名、任何视频都有**（含无 YouTube 字幕轨的 Shorts，实测 `2QtsWjF3e78` Suits 剪辑）。
- 实测：下载该音频流（302KB）→ ffmpeg 转 16kHz wav → 自部署 Whisper（base.en）离线识别出**完整准确英文台词**（含屏幕台词 "sleep with your sister"）。音频流可取 + ASR 可识别 + 翻译可行，全链路通。

决策（推翻 v2.10「不可行」）：
- **听音改为后端方案**：app 传 videoId + 当前播放进度 → `model-gateway` 按 videoId 取 InnerTube 音频流 URL → 按进度 Range 拉取音频流片段 → ffmpeg 转码 → **自部署 Whisper ASR**（仅产英文文本）→ 走现有大模型分层翻译 → 返回带时间轴的双语句子。**不在前端采集音频**（绕开 `captureStream` 死路）。
- **ASR 选型：自部署 Whisper**（whisper.cpp / faster-whisper，开源离线、零 API 成本、适配 Free 每天 10 分钟额度）。替换 `services/model-gateway/src/providers/asr-provider.ts` 的 `UnavailableASRProvider`。
- **识别与翻译解耦、翻译统一走大模型分层**：Whisper 只「英文语音→英文文字」、不翻译；翻译「英文→中文」走现有 translation-proxy（Free）/ model-gateway（Pro·Max），**按订阅权限路由、用户在权限内可选模型**（`model-catalog` options + `preferredModelId`，`video-audio-translate.ts` route 已接入 preferredModelId）。
- **混合策略**：有字幕轨读字幕翻译（v2.8，省 ASR 成本、更准），无字幕轨走音频流 ASR；合起来任何视频可翻（追平竞品）。

合规边界变化（**实质，知情采用**）：
- **放宽 v2.4 / v2.8 的「不下载 / 分离音视频」边界**：允许 `model-gateway` 后端按播放进度**实时拉取音频流片段**做识别（与竞品 Immersive Translate 同类机制），仅取当前识别所需、**不持久化整轨、不缓存、不再分发、不离线整片转写**。
- 仍守住：用户可见 / 可关闭 / 可停止、按分钟计量、不保存 / 不再分发完整音频、不后台静默听音（仅前台当前播放）、Free 每天 10 分钟。
- YouTube ToS / App Store 审核长期合规风险由产品方知情采用（与字幕轨方案 v2.8 同等立场、与沉浸翻译类竞品同等做法）。

落地组件：
- `model-gateway`：新增音频流获取（InnerTube `streamingData` → audio URL）+ 按进度 Range 拉取 + ffmpeg 转码 + 自部署 Whisper ASR provider；`video-audio-translate.ts` route 改造（输入 videoId + 进度，不再期待前端音频数据）；ASR 与翻译路由解耦。
- `packages/contracts`：`VideoAudioTranslateRequest` 改为携带 videoId + 播放进度（替代音频数据载荷），结果带时间轴。
- `browser-agent` / iOS：无字幕轨时触发听音（传 videoId + 进度），复用现有 video caption overlay 按进度显示双语。
- 由 DEV-PLAN 听音 phase（原 Phase 8.10 / 8.11 重定义为音频流方案）落地。

风险：音频流 URL 有时效（`expire` ~6h）+ 绑定请求方（后端自取自下、同 IP 规避）；后端拉流可能受 YouTube 云 IP 反爬（开发阶段验证）；自部署 Whisper 的实时性 / 算力（分段处理 + 模型档位权衡，开发阶段定）；ToS 合规风险（知情采用）。

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
- 不下载视频、音频；不把字幕保存为文件、不离线缓存整轨、不再分发或搬运（v2.8：允许在播放当前视频时实时读取其自带字幕轨数据用于翻译显示，详见 v2.8 修订段）。
- 不去广告、不后台播放；不离线下载完整视频 / 整片音频（**v2.11 放宽**：允许后端按播放进度实时拉取音频流片段做听音识别，用完即弃、不持久化整轨、不缓存、不再分发，见 v2.11 修订段）。
- 不做无限制听音识别、后台静默听音识别（仅前台当前播放）、离线整片转写或保存 / 再分发完整音频（**v2.11**：听音改为后端拉音频流实时片段 + 自部署 Whisper 识别）。
- 不在 YouTube 视频页展示阅读型底部分段控件，也不在视频页底部常驻任何 App 工具条 / 状态栏（v2.5 强化：改隐形态 + 召唤态）。
- 不在 YouTube 任何页面（首页 / 列表 / 搜索 / Shorts / 视频页）套阅读显示模式控件或常驻浏览工具条；不把 YouTube 当普通文本网页处理（v2.6）。
- YouTube 注入不得破坏原生交互（滑动、点击、SPA 路由）；本版不做 YouTube 页面文字翻译（v2.6）。
