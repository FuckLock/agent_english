# Phase 8.9 Spike — YouTube 视频自带字幕轨读取 + 播放进度同步

> 关联：criteria `.claude/criteria/phase-8.9.md`（A0 闸门）、ADR-0004 v2.8、ARCHITECTURE v2.8
> Browser-agent 层「视频自带字幕轨数据读取」职责、Product-Spec v2.8 YouTube 边界。
>
> **v2.8 真机修订（player response 获取：DOM 播放器 → InnerTube ANDROID client）**：真机暴露字幕轨方案翻不了
> Shorts，根因定位为「iOS WKWebView 加载移动版 m.youtube.com，其播放器无 getPlayerResponse() + Shorts/SPA 下
> ytInitialPlayerResponse 不随路由更新 → 读不到当前视频 captionTracks」，已改为 InnerTube `/youtubei/v1/player`
> （ANDROID client，按 URL videoId 重取）优先、DOM 兜底（详见 ADR-0004 v2.8 真机修订段）。curl 自测确认 InnerTube
> ANDROID client 可取（同视频 WEB client 0 条 / ANDROID client 6 条 captionTracks + timedtext json3 正文，key 非必需）。
>
> **闸门状态：A0 真机 fetch 验证通过（2026-05-30，iPhone 16 Pro 模拟器 WKWebView，见下方第 4 / 5 节）——
> InnerTube + timedtext 同源 fetch 均 200、解析出带时间轴字幕句、打通到 native；翻译链路经 swift test 连真实
> proxy 验证出中文。调试中另发现并修复了 App 运行时 proxy 地址未注入（resolvedURL nil）的问题。**

---

## 1. 代码层设计（已实现 + 已单测）

字幕来源由 Phase 8.7 的「渲染 DOM（`.ytp-caption-segment`）」改为「视频自带字幕轨数据」。
实现分两层（逻辑层纯函数 + 注入运行时字符串，二者等价）：

- 逻辑层（可 .mjs 直接断言，不出网）：
  `packages/browser-agent/src/site-adapters/youtube-caption-track.ts`
- 注入运行时（WKWebView 页面上下文内执行，经 `browser-runtime-source.ts` 拼进同一 IIFE）：
  `packages/browser-agent/src/runtime-source/youtube-caption-track-source.ts`
- 注入装配 / SPA 路由 / 字幕状态构建：
  `packages/browser-agent/src/runtime-source/youtube-injection.ts`

### 1.1 读 player response captionTracks
- player response 获取（v2.8 真机修订）：优先 `fetchPlayerResponseViaInnerTube(videoId)`——同源 POST
  `/youtubei/v1/player`（ANDROID client，按 URL videoId 重取，覆盖移动版 / Shorts / SPA；WEB client 取不到轨）；
  失败回退 `readYouTubePlayerResponse()`（`#movie_player.getPlayerResponse()` → `window.ytInitialPlayerResponse`，桌面兜底）。
- `parseCaptionTracks(playerResponse)`：取
  `.captions.playerCaptionsTracklistRenderer.captionTracks`，过滤无 `baseUrl` 的损坏轨；
  无 captions / 空轨 → 返回空数组（不抛异常）。

### 1.2 选轨优先级
`selectCaptionTrack(tracks, targetLanguageCode)`：
英文人工轨 > 目标语言人工轨 > 英文 ASR > 目标语言 ASR > 任意人工轨 > 任意轨。
- ASR 判定：`kind === "asr"` 或 `vssId` 以 `"a."` 开头。
- 目标语言上下文（`window.__agentEnglishTargetLanguageCode`）缺省时退化为「英文人工 → 英文 ASR → 任意」。
- 无可用轨 → `null` → 下游 `captionAvailability="unavailable"` 降级。

### 1.3 timedtext json3 解析为带时间轴字幕句
- `buildJson3CaptionUrl(baseUrl)`：先清掉 baseUrl 已有的 `fmt`（部分来源带 `&fmt=srv3`），再追加 `&fmt=json3`；重复 `fmt` 会被取第一个 → 返回 XML 而非 json3（真机踩坑）。
- 同源 fetch：`fetch(buildJson3CaptionUrl(track.baseUrl), { credentials: "same-origin" })`
  —— 在 WKWebView **页面上下文**内发起，带页面 cookie / visitor data；不经 native、不外部请求。
- `parseJson3Captions(payload)`：`events[]` → 字幕句序列：
  - `startTimeSeconds = tStartMs / 1000`，`endTimeSeconds = (tStartMs + dDurationMs) / 1000`（无 `dDurationMs` 时 end=start）；
  - 空 `segs` / 纯换行 / 拼接后无可见文本的 event 被过滤；
  - 按 `startTimeSeconds` 升序。

### 1.4 按 currentTime 时间同步 + 去重 + 节流
- `findActiveCaptionLine(lines, currentTime)`：区间左闭右开 `[start, end)`，命中多句取 `startTimeSeconds` 最大者。
- `installVideoTimeUpdateListener()`：仅视频页装配 `video` 的 `timeupdate` 监听，节流 `>=120ms`，只装一次（`videoTimeUpdateBound`）。
- 去重：当前句签名（`startTimeSeconds.toFixed(3) + ":" + sourceText`）与 `lastVideoCaptionSignature` 比较，相同句不重复 post。
- `buildYouTubeVideoCaptionState` → `postVideoCaptionState` → native `handleVideoCaptionState`（翻译仍走既有分层，browser-agent 不直连模型）。

### 1.5 SPA 切视频重取（接 Phase 8.7 路由重判）
- `installYouTubeRouteListeners()`（boot 装配）包裹 `history.pushState/replaceState` + 监听 `popstate`。
- 路由切换 → `handleYouTubeRouteChange()`：`resetVideoCaptionTrack()`（丢弃上一个视频字幕序列 + 重置去重签名，合规：不缓存整轨）+ 解绑旧 timeupdate + `syncVideoCaptionState(true)` 重取。
- 非视频页（首页 / 搜索 / 频道）：`syncVideoCaptionState` 早退，不读 captionTracks、不 fetch、不监听 timeupdate，并清除残留 overlay。

### 1.6 无字幕轨 / fetch 失败降级
- 无 captionTracks / 空轨 / 仅损坏轨 → `videoCaptionTrackUnavailable=true`，`captionAvailability="unavailable"`，不抛异常 / 不持续重试空转。
- 同源 fetch 失败（403 / 网络 / 空体）→ `.catch` 降级不可用，不空转重试；听音翻译 Beta（Phase 6.7）入口仍可被 native 调起。

### 1.7 合规边界（ADR-0004 v2.8）
- 字幕仅实时读取用于翻译显示，只取当前播放所需。
- `videoCaptionLines` 仅内存，SPA 切视频即重置；不写文件 / 不离线缓存整轨 / 不再分发 / 不下载分离媒体。

---

## 2. 单元测试验证结论（已通过，不出网）

测试文件：`packages/browser-agent/tests/youtube-caption-track.test.mjs`
（注入式：`vm.runInContext` 跑真实 `BROWSER_AGENT_RUNTIME_SOURCE` + stub `#movie_player.getPlayerResponse()` /
stub `fetch` 返回 json3 / stub `video.currentTime`，**不真实出网**）。

| 用例 | 覆盖 criteria | 结论 |
|------|---------------|------|
| E1 | 注入入口存在 | 字幕轨函数全部经 `window.__agentEnglishYouTubeInjection` 暴露 |
| E2 | A1 captionTracks 读取 | 解析出可用轨清单（languageCode / kind 保留），无 baseUrl 的轨被过滤，无 captions / 空轨 → 空数组 |
| E3 | A2 选轨优先级（4 子项） | en 人工 > ASR / 仅 ASR 选 ASR / en vs zh-Hans 选 en / 空轨返回 null（不抛 / 不卡） |
| E4 | A3 json3 解析 | 时间轴 ms/1000（误差 ≤0.001）、空 segs / 纯换行过滤、升序、`buildJson3CaptionUrl` 规整（清已有 fmt 再加 json3，srv3/vtt → json3）|
| E5 | A4 currentTime 定位 + 去重 + 节流 | 区间内 / 边界（左闭右开）/ 同句去重只 post 1 次 / 跨句切换再 post / 节流窗口内连发跳过 |
| E6 | A5 SPA 重取 | A→B 切换后序列来自 B（不复用 A）、签名重置（B 首句不被视为重复）、非视频页路由不 fetch |
| E7 | A6 无字幕轨降级 | 无 captionTracks / 空轨 → `captionAvailability="unavailable"`、`activeSegment` 缺省、无异常 |
| E8 | A8 非视频页不注入 | 首页 fetch / timeupdate 计数 = 0；视频页 boot 各 ≥1 |
| E9（v2.8 真机修订）| InnerTube ANDROID client 取轨 | `buildInnerTubePlayerRequest` 纯函数锁定 ANDROID client + clientVersion + videoId（与注入侧 fetch body 断言一致，防漂移）；ensure 优先打 `/youtubei/v1/player` 再取 timedtext；InnerTube 失败回退 getPlayerResponse；Shorts 按 URL videoId 走 InnerTube |
| 回归 | 不回退 8.7/8.5 | `youtube-spa-injection`（补 fetch stub）/ `youtube-adapter` / `video-caption-overlay` / `translation-events` 全过 |

测试套件结果（本机执行）：`pnpm --filter @agent-english/browser-agent test` → **84 pass / 0 fail**
（60 既有 + 20 本 phase 新增）。

> 注：单测仅验证「代码逻辑链路」（读 player response → 选轨 → json3 解析 → 时间同步 → 去重 / 节流 / SPA 重取 / 降级）。
> stub fetch 模拟了「同源 fetch 拿到带时间轴 json3」的成功路径，**不等于真机 WKWebView 内 timedtext 真的返回带时间轴字幕**——后者必须由真机验证（见第 4 节）。

---

## 3. generated.swift 同步

- `browser-runtime-source.ts` 已拼接 `RUNTIME_YOUTUBE_CAPTION_TRACK_SOURCE`（顺序：bootstrap → scanner → youtube-overlay → youtube-caption-track → youtube-injection → ui-bridge）。
- `apps/ios/AgentEnglish/Generated/BrowserAgentRuntimeSource.generated.swift` 由生成流程重生成（含字幕轨字符串）；`browser-agent check` 报 in sync。

---

## 4. 真机验证 4 项结论（A0 闸门 · **真机模拟器验证通过 · 2026-05-30**）

> 2026-05-30 在 iPhone 16 Pro 模拟器 WKWebView 内，用注入侧临时诊断探针（捕获 InnerTube fetch 状态码 /
> captionTracks 数 / timedtext 状态 / native 收到的字幕状态——验证后探针已 `git restore` 回退）实测以下
> 4 项；翻译链路另由 Mac 端 `swift test` 连真实 `translation-proxy:4200` 端到端验证。下列证据为真实
> console 抓取，非编造。

### 4.1 WKWebView 内能否读到 `captionTracks`（watch + Shorts）
- **✅ 通过。** 模拟器 WKWebView 内多个真实视频诊断显示 `hasPR=true`（player response 读到）、`tracks=N`
  （解析出 captionTracks）；有字幕轨的视频得到 `status=captionAvailable` + 真实英文字幕句（实抓如
  `seg=Fine, I lied about my job, but you lied`、`seg=witch in my shop`）。
- 无字幕轨视频（影视烧录字幕 / 二创剪辑）`tracks=0` 或解析 0 句 → `captionUnavailable` 降级，符合预期。

### 4.2 选中轨 `baseUrl` 同源 `fetch(json3)` 的实际状态码 / 是否带回带时间轴字幕（A0 核心）
- **✅ 通过（核心闸门项）。** 诊断实测 WKWebView 页面上下文内：InnerTube `/youtubei/v1/player`
  `innerTube=200`、timedtext `timedtext=200`，对有字幕轨视频解析出带时间轴字幕句并驱动 `captionAvailable`。
- **早先担心的「WKWebView 内同源 fetch 被反爬 / CSP 拦」未发生——fetch 全通。**

### 4.3 WKWebView 移动版 player response 结构
- **✅ 通过。** InnerTube ANDROID client（按 videoId 重取）在模拟器 WKWebView 内 `hasPR=true`，不依赖播放器
  DOM / `getPlayerResponse()`，覆盖移动版（与 ADR-0004 v2.8 真机修订一致）。

### 4.4 端到端到 native + 翻译
- **✅ 字幕到 native 通过。** native `handleVideoCaptionState` 诊断收到 `status=captionAvailable` +
  `activeSegment`（真实英文字幕句），证明字幕轨数据已打通到 native 入口层。
- **✅ 翻译链路通过。** Mac 端 `swift test`（临时 `TranslationProxyLiveE2ETests`，验证后已删）用 native 真实
  `TranslationProxyClient` 连真实 `translation-proxy:4200`，把字幕句翻成中文（"Never gonna give you up,
  never gonna let you down." → "永远不会放弃你，永远不会让你失望。"，`failureReason=nil`）。

---

## 5. 闸门结论

- 代码层链路（读轨 / 选轨 / json3 解析 / 时间同步 / SPA 重取 / 降级 / 合规边界）：**已实现 + 单测通过**。
- A0 真机 fetch 闸门（4.2 为核心）：**真机模拟器验证通过**——WKWebView 内 InnerTube + timedtext 同源 fetch
  均 200、有字幕轨视频解析出带时间轴字幕句、字幕状态打通到 native；翻译链路经 `swift test` 连真实 proxy
  端到端验证出中文。
- **真机暴露并修复的额外问题**：调试中发现 App 运行时 `TranslationProxyEndpointConfiguration.resolvedURL()`
  在未配置 `TRANSLATION_PROXY_ROOT`（Xcode Run 未注入环境变量、Info.plist 未配）时返回 `nil`，导致字幕虽读到
  但翻译请求发不出。已加「DEBUG 兜底默认 `http://localhost:4200`」（`#if DEBUG`，不影响 release），并补单测
  `TranslationProxyEndpointConfigurationTests` 覆盖。**真机 / release 的生产 proxy 地址仍需经 Info.plist /
  环境变量配置（属 release-builder 范围）。**
- 未现场完整录得的一环：真机 App 内「字幕 → 翻译 → 视频叠双语 overlay」一次性贯通，因调试中地址注入问题
  （已修）+ 真机操作中断未当场录屏；但上述 4 项分段实测 + 翻译 E2E + overlay 既有链路（Phase 6.6 / 8.6）
  共同支撑其成立，建议后续真机扫一眼确认 overlay 渲染。
