# Phase 8.9 Spike — YouTube 视频自带字幕轨读取 + 播放进度同步

> 关联：criteria `.claude/criteria/phase-8.9.md`（A0 闸门）、ADR-0004 v2.8、ARCHITECTURE v2.8
> Browser-agent 层「视频自带字幕轨数据读取」职责、Product-Spec v2.8 YouTube 边界。
>
> **闸门状态：A0 真机 fetch 验证待 caller 在 WKWebView 真机 / 模拟器内确认（见下方第 4 节）。**
> 本文档「真机结论」一栏一律据实标注「待真机验证」，未编造任何真机抓包 / 状态码结果。

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
- `readYouTubePlayerResponse()`：优先 `document.querySelector("#movie_player, .html5-video-player, ytd-player").getPlayerResponse()`；
  切视频瞬间抛错 / 返回旧值时回退 `window.ytInitialPlayerResponse`。
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
- `buildJson3CaptionUrl(baseUrl)`：在 baseUrl 上幂等追加 `&fmt=json3`。
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
| E4 | A3 json3 解析 | 时间轴 ms/1000（误差 ≤0.001）、空 segs / 纯换行过滤、升序、`fmt=json3` 幂等追加 |
| E5 | A4 currentTime 定位 + 去重 + 节流 | 区间内 / 边界（左闭右开）/ 同句去重只 post 1 次 / 跨句切换再 post / 节流窗口内连发跳过 |
| E6 | A5 SPA 重取 | A→B 切换后序列来自 B（不复用 A）、签名重置（B 首句不被视为重复）、非视频页路由不 fetch |
| E7 | A6 无字幕轨降级 | 无 captionTracks / 空轨 → `captionAvailability="unavailable"`、`activeSegment` 缺省、无异常 |
| E8 | A8 非视频页不注入 | 首页 fetch / timeupdate 计数 = 0；视频页 boot 各 ≥1 |
| E9 | 不回退 8.7/8.5 | `youtube-spa-injection` / `youtube-adapter` / `video-caption-overlay` / `translation-events` 用例未改动且全过 |

测试套件结果（本机执行）：`pnpm --filter @agent-english/browser-agent test` → **80 pass / 0 fail**
（60 既有 + 20 本 phase 新增）。

> 注：单测仅验证「代码逻辑链路」（读 player response → 选轨 → json3 解析 → 时间同步 → 去重 / 节流 / SPA 重取 / 降级）。
> stub fetch 模拟了「同源 fetch 拿到带时间轴 json3」的成功路径，**不等于真机 WKWebView 内 timedtext 真的返回带时间轴字幕**——后者必须由真机验证（见第 4 节）。

---

## 3. generated.swift 同步

- `browser-runtime-source.ts` 已拼接 `RUNTIME_YOUTUBE_CAPTION_TRACK_SOURCE`（顺序：bootstrap → scanner → youtube-overlay → youtube-caption-track → youtube-injection → ui-bridge）。
- `apps/ios/AgentEnglish/Generated/BrowserAgentRuntimeSource.generated.swift` 由生成流程重生成（含字幕轨字符串）；`browser-agent check` 报 in sync。

---

## 4. 真机验证 4 项结论（A0 闸门 · **待 caller 真机验证**）

> 以下 4 项是 A0 闸门的真机证据，**当前仅有外部 / 竞品事实锚点，尚无 WKWebView 真机抓包结果**。
> 由 caller 在「用户跑 App + caller 看 proxy 日志 / bridge log」流程中确认；本 generator 不编造真机结果。

### 4.1 WKWebView 内能否读到 `.captions.playerCaptionsTracklistRenderer.captionTracks`（watch + Shorts 两侧）
- **待真机验证。**
- 已知事实锚点（caller / criteria 提供，非本机抓包）：
  - 桌面 `youtube.com/watch?v=...` HTML 含 `"captionTracks":[...]`（多语 + ASR + manual，baseUrl 形如 `youtube.com/api/timedtext?v=...&ei=...&caps=asr&hl=...`）；
  - 移动 `m.youtube.com/watch?v=...` 用 iOS Safari UA 拉取，HTML 也含 `playerCaptionsTracklistRenderer.captionTracks`，WKWebView 默认 UA 下能读 captionTracks。
- 待真机确认：`document.querySelector('#movie_player').getPlayerResponse()` 在 WKWebView 内 watch / Shorts 两侧是否各能读到 captionTracks（Shorts 的 player 结构是否一致）。

### 4.2 选中轨 `baseUrl` 同源 `fetch(baseUrl + "&fmt=json3")` 的实际状态码 / 是否带回带时间轴字幕
- **待真机验证（A0 核心闸门项）。**
- 已知事实锚点：
  - 外部 `curl` timedtext（fmt=json3/srv3/默认）HTTP 200 但 **0 字节**（无 cookie / visitor data 被反爬）；InnerTube `/youtubei/v1/player` POST 返回 captionTracks 空（2024+ 反爬）；
  - 竞品 Immersive Translate / Trancy 在**浏览器同源上下文**实测可用 → WKWebView 内同源 fetch（带页面 cookie / visitor data）行为预期不同，且本实现采用竞品同款方案。
- 待真机确认：WKWebView **页面上下文内** `fetch(baseUrl + "&fmt=json3", { credentials: "same-origin" })` 的实际状态码、响应体是否含 `events[].tStartMs / dDurationMs / segs`。
- **若真机内同源 fetch 也 0 字节 / 403 / 结构不匹配 → A0 闸门未过 → 本 phase 暂停回报，A1–A8 不强制达成（需评估降级方案：如回退 DOM `.ytp-caption-segment` 兜底或转听音 Beta）。**

### 4.3 WKWebView 移动版 player response 结构差异
- **待真机验证。**
- 待确认：移动版 `getPlayerResponse()` 字段路径是否与桌面 Web 一致；是否需要 visitor data / cookie 才能拿到非空 captionTracks；Shorts 与 watch 是否共用同一 player response 结构。

### 4.4 一次端到端打通到 native 的证据
- **待真机验证（caller 看 proxy 日志 / bridge log 间接确认）。**
- 期望证据：native 收到的 `VideoCaptionOverlayState` 含至少一个 `activeSegment` 且 `containerPath === "caption-track"`（来自字幕轨而非 DOM `.ytp-caption-segment`）；App 跑视频期间 `translation-proxy` 日志按句节流收到字幕翻译请求（不爆量、不重复），sourceText 与视频字幕匹配。
- 若视频播放期间 proxy 日志无请求 → 视为字幕轨读取未生效（spike 闸门 / 实现存在问题），回报。

---

## 5. 闸门结论

- 代码层链路（读轨 / 选轨 / json3 解析 / 时间同步 / SPA 重取 / 降级 / 合规边界）：**已实现 + 单测通过（80 pass）**。
- A0 真机 fetch 闸门（4.2 为核心）：**待 caller 在 WKWebView 真机 / 模拟器内确认**。
- 在真机 fetch 未确认前，本实现的「字幕轨优先、DOM `.ytp-caption-segment` 兜底」结构已就位——
  即便真机 timedtext 同源 fetch 仍被反爬（0 字节），注入侧会经 `.catch` 降级到 `captionAvailability="unavailable"` 并保留听音 Beta 入口，不会崩溃 / 不空转。
- caller 真机验证通过 → A0 闸门过，进入 F1 真机端到端验证；不通过 → 暂停 phase，按 4.2 评估降级方案。
