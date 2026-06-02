// Phase 8.13：YouTube「听音前端集成」的注入运行时子模块（页面上下文内执行）。
//
// 把 Phase 8.12 后端「videoId + 播放进度 → 带时间轴双语句子」链路接到用户体验：
// - 无字幕轨（videoCaptionTrackUnavailable，captionTracks=0 / 解析 0 句）时 buildYouTubeVideoAudioState
//   不再恒停在 status:"privacy-required" 等手动开；隐私已接受（native 经 bridge 命令置
//   window.__agentEnglishAudioPrivacyAccepted=true）时**自动**进入识别态（recognizing），开始进度上报；
//   隐私未接受仍先 privacy-required（复用 Phase 6.7 弹窗，确认后自动进入）；有字幕轨仍走字幕（Phase 8.9 不变）。
// - postVideoAudioState：去重（lastVideoAudioSignature）后渲染听音双语 overlay（复用 Phase 8.9
//   applyVideoCaptionOverlayState）+ post "video.audio.state.changed"（带 videoId + 进度，无音频载荷）/
//   "video.audio.quota.changed"；native 收到 recognizing 听音 state 即按 videoId+进度 POST model-gateway。
//
// 层次边界（ADR-0004 v2.11，review 阻断）：本模块只构建状态 + 渲染 overlay + 上报 videoId/进度，
// 绝不采集音频 / 不拉音频流 / 不调 ASR·模型 / 不持有 key（识别 + 翻译 + 拉流全在 model-gateway）。
// 进度编排（按播放推进周期请求 + 节流 + 去重）在 youtube-injection.ts 的 reportVideoAudioProgress。
//
// 本字符串经 browser-runtime-source.ts 拼接进同一 IIFE（在 youtube-injection 之前），
// 纯函数暴露到 __agentEnglishYouTubeInjection 供注入式单测（不出网）。

export const RUNTIME_YOUTUBE_AUDIO_SOURCE = String.raw`  // A3：听音段时长（秒）——按播放进度把当前句 / 段分桶，同段内 timeupdate 复用同一 audioSegmentId
  // （去重为 1 次后端请求），跨段推进换桶触发下一段；与后端 Phase 8.12 单段识别粒度对齐。
  const VIDEO_AUDIO_SEGMENT_SECONDS = 6;
  const audioPrivacyAccepted = () => Boolean(window.__agentEnglishAudioPrivacyAccepted);
  const buildYouTubeVideoAudioState = (overrides = {}) => {
    const detection = detectYouTubePage();
    if (!detection.isVideoPage || !detection.pageKind) {
      return null;
    }
    const updatedAt = new Date().toISOString();
    const captionText = normalizeText(overrides.captionText || readActiveYouTubeCaptionText());
    const captionQuality = overrides.captionQuality || (captionText ? "available" : "unavailable");
    const captionAvailable = captionQuality === "available" || captionQuality === "low";
    // A1 自动切：无字幕轨（videoCaptionTrackUnavailable）/ 低质量字幕 / 无字幕文本 → 听音 source；
    // 有字幕轨且非手动选择 → 字幕 source（Phase 8.9 字幕优先不被破坏）。
    const source = overrides.source || (
      overrides.manualAudioSelection
        || captionQuality === "low"
        || (!captionText && videoCaptionTrackUnavailable)
        || (!captionText && captionQuality === "unavailable")
        ? "audio"
        : "caption"
    );
    // A1 自动切：听音 source 下隐私已接受即自动进入识别态（recognizing，开始进度上报），
    // 不再恒为 privacy-required；隐私未接受时先 privacy-required（确认后自动转 recognizing）。
    const autoStatus = source === "audio"
      ? (audioPrivacyAccepted() ? "recognizing" : "privacy-required")
      : "caption-primary";
    const status = overrides.status || autoStatus;
    const audioSegmentId = overrides.audioSegmentId || hashSeed("vaud", pageId + ":audio:" + updatedAt.slice(0, 19));
    return {
      pageId,
      siteKind: "youtube",
      pageKind: detection.pageKind,
      url: window.location.href,
      title: document.title || "",
      videoId: detection.videoId,
      captionAvailability: captionAvailable ? "available" : "unavailable",
      source,
      overlayMode: overrides.overlayMode || (source === "audio" ? "inline-overlay" : "hidden"),
      status,
      capabilities: source === "audio"
        ? [
            captionAvailable ? "captions-available" : "captions-unavailable",
            "audio-translation-beta",
            "video-audio-translation",
            "selection-fallback",
          ]
        : ["captions-available", "video-caption-overlay", "audio-translation-beta", "selection-fallback"],
      activeSegment: source === "audio"
        ? {
            pageId,
            audioSegmentId,
            videoId: detection.videoId,
            source: "audio",
            sourceText: overrides.sourceText || "",
            translatedText: overrides.translatedText,
            sourceLanguage: overrides.sourceLanguage || "English",
            targetLanguage: overrides.targetLanguage || "简体中文",
            startTimeSeconds: typeof overrides.startTimeSeconds === "number" ? overrides.startTimeSeconds : undefined,
            endTimeSeconds: typeof overrides.endTimeSeconds === "number" ? overrides.endTimeSeconds : undefined,
            capturedAt: updatedAt,
          }
        : undefined,
      failureReason: overrides.failureReason || (source === "caption" ? "caption-primary" : undefined),
      message: overrides.message || (source === "audio"
        ? (status === "recognizing" ? "正在听音识别 · Beta" : "听音翻译 Beta 会在你确认后由后端按播放进度拉取音频流识别。")
        : "字幕可用，优先使用字幕翻译。"),
      updatedAt,
    };
  };
  const postVideoAudioState = (state, force = false) => {
    if (!state) {
      return false;
    }
    const signature = [
      state.pageKind,
      state.videoId || "",
      state.source,
      state.status,
      state.activeSegment?.audioSegmentId || "",
      state.activeSegment?.sourceText || "",
      state.activeSegment?.translatedText || "",
      state.failureReason || "",
    ].join(":");
    if (!force && signature === lastVideoAudioSignature) {
      return false;
    }
    lastVideoAudioSignature = signature;
    // 识别态 / 已识别出双语句即渲染听音 overlay（与字幕共用 applyVideoCaptionOverlayState）；
    // privacy-required / caption-primary 不渲染（等隐私确认 / 字幕主路径）。
    if (state.source === "audio" && state.status !== "privacy-required" && state.status !== "caption-primary") {
      applyVideoCaptionOverlayState(state);
    }
    postBridgeEvent("video.audio.state.changed", state, {
      requestId: "video-audio-state-" + (state.activeSegment?.audioSegmentId || sessionId),
      pageId,
    });
    if (state.quota) {
      postBridgeEvent("video.audio.quota.changed", state.quota, {
        requestId: "video-audio-quota-" + sessionId,
        pageId,
      });
    }
    return true;
  };
  const requestVideoAudioTranslation = (config = {}) => {
    const state = buildYouTubeVideoAudioState({
      source: "audio",
      status: config.status,
      sourceLanguage: config.sourceLanguage,
      targetLanguage: config.targetLanguage,
      manualAudioSelection: true,
      captionQuality: config.captionQuality,
      captionText: config.captionText,
      message: config.message,
    });
    return postVideoAudioState(state, true);
  };
`;
