# Phase 8.12 后端音频流方案 — spike 验收记录 + e2e 脚本

> 听音翻译后端先行：`videoId` + 播放进度 → 后端取 YouTube 音频流 → Range 拉片段 → ffmpeg 转码 → 自部署 Whisper 识别英文 → 分层翻译 → 带时间轴双语句子。
>
> 本目录两件事：
> 1. 本 README = **G0 部署环境 spike 闸门记录**（本机已验证结论 + 三风险点判定 + 闸门结论）。
> 2. `run.mjs` = **可脱离 iOS 的后端端到端验证脚本**（连真实 YouTube + 本机 ffmpeg/Whisper，断言英文 + 中文 + 时间轴；不进 CI）。

---

## 1. 本机已验证「取流 + Whisper 识别」结论（复述）

在本机（macOS、住宅 IP）跑通完整链路，事实如下（均已实跑核实）：

- **目标视频**：真实无字幕轨 Shorts `videoId=2QtsWjF3e78`（Suits 剪辑，`playabilityStatus.status === "OK"`，无 `captions` / `captionTracks`）。
- **取流**：`POST https://www.youtube.com/youtubei/v1/player`，body
  `{"context":{"client":{"clientName":"ANDROID","clientVersion":"20.10.38","androidSdkVersion":31,"hl":"en","gl":"US"}},"videoId":"2QtsWjF3e78"}`，
  从 `streamingData.adaptiveFormats`（31 路，其中 12 路 audio）选 **itag=139**：
  - `mimeType = audio/mp4; codecs="mp4a.40.5"`，`bitrate ≈ 49954`（~49kbps 纯音频）；
  - **明文 `url`、无 `signatureCipher`**（无需解签名）；
  - `contentLength = 302957`（~302KB 整轨）、`approxDurationMs = 49412`（~49s）；
  - URL query 含 `expire`（Unix 秒，实测 ~6h 后过期）。
- **Range 拉片段**：对 itag=139 明文 URL 发 `Range: bytes=0-65535` → HTTP **206 Partial Content**，`size_download=65536`（验证可只拉片段、不下整轨）。
- **ffmpeg 转码**：`ffmpeg -i <mp4> -ar 16000 -ac 1 -f wav <out>`（8.x）→ 16kHz 单声道 wav（整轨 1.58MB），rc=0。
- **Whisper 识别**：`whisper-cli -m ggml-base.en.bin -f <wav> -l en`（whisper.cpp，模型 `ggml-base.en` ~147MB）→ 识别出**完整准确英文台词**：
  > "One thing. Promise me you won't sleep at Esther. ... The last thing I want to do is **sleep with your sister**. ..."
- **耗时**：49s 音频，ffmpeg + Whisper base.en 端到端 **~1s**（远低于实时）。
- **翻译**：识别出的英文交现有 `routeTranslation` 分层翻译（Free→translation-proxy / Pro·Max→model-gateway，`preferredModelId` 生效）即得中文，链路与字幕翻译一致。

> 本机工具（已核实）：`/opt/homebrew/bin/ffmpeg`（8.x）、`/opt/homebrew/bin/whisper-cli`（whisper.cpp）、模型 `/tmp/ggml-base.en.bin`（~147MB）。

---

## 2. 三个「部署环境未验证」风险点 — 据实判定

### ① YouTube 云 IP 反爬

- **本机结论**：住宅 IP 拉 InnerTube `/youtubei/v1/player`（ANDROID client）与音频流均成功（`playabilityStatus=OK`、206 拉片段），**无需 visitor data / cookie**，未触发风控。
- **部署环境**：**待真实部署复核**——云厂商出口 IP（AWS/GCP/阿里云等数据中心 IP 段）拉 InnerTube / 音频流可能被限流或风控（开发机能跑不代表云能跑）。
- **处置预案**（部署前必须验证；若云 IP 被硬阻断，回报 caller 评估后采用）：
  1. ANDROID client + 合理 User-Agent（已采）通常比 WEB client 抗封；
  2. 失败重试 + 退避（取流模块已内置 `ASR_STREAM_MAX_RETRIES`，默认 2 次）；
  3. 必要时引入 visitor data / `po_token`；
  4. 仍被硬阻断 → 自建住宅/移动代理出口 IP，或改托管方案。
- **状态**：本机 PASS；**云 IP 项标「待部署复核」**（不阻断本机交付，部署上线前作为运维 checklist 项）。

### ② 音频流 URL 时效 + IP 绑定

- **事实**：`streamingData` 音频流 URL 带 `expire`（Unix 秒，~6h）且绑定**请求方出口 IP**。
- **采纳策略**（已落代码）：
  - **后端取 player response 与下载音频流走同一出口 IP**（同一 model-gateway 进程内 `fetch`，天然同源出口）→ IP 绑定规避有效；
  - **每次按当前 `videoId` 重取 URL，不缓存复用过期 URL**（`youtube-audio-stream.ts` 不做任何 URL 缓存，每请求重新取 player response）。
- **状态**：策略已采纳并落代码；本机 PASS。

### ③ Whisper 实时性 / 算力 / 档位

- **选定档位**：**whisper.cpp `whisper-cli` + `ggml-base.en`**（英文专用，纯 CPU 即可）。
- **本机实测**：49s 音频识别 + ffmpeg 转码端到端 **~1s**，准确度足够（完整识别出连续台词，含专有名词与口语）。
- **Free 每天 10 分钟 + 并发判断**：单段识别远快于实时（~50x）→ 单机即可支撑 Free 每天 10 分钟的串行负载；并发量上来后的处置预案：
  1. 限制单段时长（已有滥用保护 `AUDIO_ABUSE_PROTECTION_MAX_SEGMENT_SECONDS=90`）；
  2. 并发高时排队 / 加 worker；
  3. 算力不足时切 `base.en`→更小档位 或换 GPU / 托管 ASR（`faster-whisper`）。
- **档位通过环境变量配置**（`WHISPER_BIN` / `WHISPER_MODEL` / `WHISPER_LANGUAGE`），可不改代码切档。
- **状态**：本机 PASS；并发上线前按真实 QPS 复核 worker 数。

---

## 3. 闸门结论

**PASS（可进入完整实现）。**

- 本机已端到端验证「取流（itag=139 明文 URL）→ Range 拉片段（206）→ ffmpeg 16kHz wav → Whisper `base.en` 识别准确英文 → 可翻译」核心链路，三风险点中 ②③ 已据实判定并落策略/代码，① 云 IP 反爬本机 PASS、部署环境标「待部署复核」（运维 checklist 项，不阻断本机交付）。
- 唯一遗留：**部署环境云 IP 反爬需上线前真实复核**（若硬阻断则按 ① 处置预案回报 caller 评估）。本机核心已通，不构成本 Phase BLOCKED。

---

## 4. e2e 脚本用法（`run.mjs`，不进 CI）

```bash
# 默认对 2QtsWjF3e78 跑全链路（取流→Range 拉片段→ffmpeg→Whisper→翻译断言）
node scripts/listening-backend-e2e/run.mjs

# 指定其它无字幕 videoId
node scripts/listening-backend-e2e/run.mjs <videoId> [playbackPositionSeconds]
```

依赖本机：`ffmpeg`、`whisper-cli`（或 `WHISPER_BIN`）、Whisper 模型（`WHISPER_MODEL`，默认 `/tmp/ggml-base.en.bin`）。
缺工具 / 网络失败时脚本**非零退出**（不静默成功）。翻译段需配 `MODEL_GATEWAY` provider env 或脚本内置 mock 翻译（见脚本注释）。

后端运行依赖与环境变量约定见 [`services/model-gateway/README.md`](../../services/model-gateway/README.md)。
