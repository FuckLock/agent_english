export const RUNTIME_YOUTUBE_OVERLAY_SOURCE = String.raw`  const detectYouTubePage = () => {
    let url;
    try {
      url = new URL(window.location.href);
    } catch {
      return { isYouTube: false, isVideoPage: false };
    }
    const youtubeHosts = new Set([
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
    ]);
    if (!youtubeHosts.has(url.hostname)) {
      return { isYouTube: false, isVideoPage: false };
    }
    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.replace(/^\/+/, "").split(/[/?#]/)[0] || undefined;
      return { isYouTube: true, isVideoPage: Boolean(videoId), pageKind: "youtube-watch", videoId };
    }
    if (url.pathname === "/watch") {
      const videoId = url.searchParams.get("v") || undefined;
      return { isYouTube: true, isVideoPage: Boolean(videoId), pageKind: "youtube-watch", videoId };
    }
    if (url.pathname.startsWith("/shorts/")) {
      const videoId = url.pathname.replace(/^\/shorts\//, "").split(/[/?#]/)[0] || undefined;
      return { isYouTube: true, isVideoPage: Boolean(videoId), pageKind: "youtube-shorts", videoId };
    }
    return { isYouTube: true, isVideoPage: false };
  };
  const videoCaptionStatusMessage = (state) => {
    if (state.failureReason === "caption-unavailable") {
      return state.message || "当前视频没有检测到可用字幕";
    }
    if (state.failureReason === "quota-exceeded") {
      return "当前服务等级额度不足";
    }
    if (state.failureReason === "tier-unavailable") {
      return "当前模型需要更高服务等级";
    }
    if (state.failureReason === "content-too-long") {
      return "当前字幕过长，暂不能翻译";
    }
    if (state.failureReason) {
      return "字幕翻译暂不可用";
    }
    if (state.activeSegment?.sourceText && state.activeSegment?.translatedText) {
      return state.activeSegment.sourceText + "\n" + state.activeSegment.translatedText;
    }
    if (state.activeSegment?.sourceText) {
      const statusText = state.status === "translating" ? "字幕翻译中" : "等待字幕翻译";
      return state.activeSegment.sourceText + "\n" + statusText;
    }
    if (state.status === "detecting") {
      return "正在识别字幕";
    }
    return state.message || "字幕翻译暂不可用";
  };
  const videoAudioStatusMessage = (state) => {
    if (state.failureReason === "privacy-disclosure-required") {
      return state.message || "开启前请确认听音翻译隐私提示";
    }
    if (state.failureReason === "audio-quota-exceeded" || state.failureReason === "quota-exceeded") {
      return "今日听音分钟已用完";
    }
    if (state.failureReason) {
      return state.message || "听音翻译暂不可用";
    }
    if (state.activeSegment?.sourceText && state.activeSegment?.translatedText) {
      return state.activeSegment.sourceText + "\n" + state.activeSegment.translatedText;
    }
    if (state.activeSegment?.sourceText) {
      return state.activeSegment.sourceText + "\n" + (state.status === "translating" ? "听音翻译中" : "正在听音识别");
    }
    if (state.status === "privacy-required") {
      return state.message || "开启前请确认听音翻译隐私提示";
    }
    if (state.status === "recognizing") {
      return "正在听音识别";
    }
    if (state.status === "quota-exhausted") {
      return "今日听音分钟已用完";
    }
    return state.message || "听音翻译 Beta";
  };
  const videoCaptionPlayerHost = () => {
    const player = document.querySelector("#movie_player, .html5-video-player, ytd-player, .ytp-iv-video-content");
    if (!player) {
      return null;
    }
    const hostStyle = getComputedStyle(player);
    if (hostStyle.position === "static") {
      player.style.position = "relative";
    }
    return player;
  };
  const ensureVideoCaptionSurface = (id) => {
    let surface = document.getElementById(id);
    if (surface) {
      return surface;
    }
    surface = document.createElement("div");
    surface.id = id;
    const playerHost = videoCaptionPlayerHost();
    if (playerHost) {
      playerHost.appendChild(surface);
    } else {
      document.body?.appendChild(surface);
    }
    return surface;
  };
  const styleVideoCaptionSurface = (surface, mode) => {
    // Phase 8.7 / A7：字幕叠层不再用 fixed 覆盖整个滚动容器，改为 absolute 相对视频
    // 播放器局部容器定位（host 见 videoCaptionPlayerHost）；播放器不可达时降级为不拦截
    // 滚动的局部条。pointerEvents:none 确保不拦截 YouTube 原生点击 / 滚动手势。
    surface.style.position = "absolute";
    surface.style.zIndex = "2147483000";
    surface.style.whiteSpace = "pre-line";
    surface.style.pointerEvents = "none";
    surface.style.color = "#ffffff";
    surface.style.background = "rgba(0, 0, 0, 0.72)";
    surface.style.lineHeight = "1.32";
    if (mode === "fallback-bar") {
      surface.className = videoCaptionFallbackClassName;
      surface.style.left = "12px";
      surface.style.right = "12px";
      // 降级字幕条也放顶部（与 inline-overlay 一致，对齐竞品）。
      surface.style.top = "8%";
      surface.style.bottom = "";
      surface.style.transform = "";
      surface.style.maxWidth = "";
      surface.style.padding = "9px 12px";
      surface.style.borderRadius = "12px";
      surface.style.fontSize = "14px";
      surface.style.textAlign = "left";
      return;
    }
    surface.className = videoCaptionOverlayClassName;
    surface.style.left = "50%";
    surface.style.right = "";
    // 双语字幕放视频顶部（对齐竞品沉浸翻译）；避开底部频道信息 / 描述 / 进度条。
    surface.style.top = "8%";
    surface.style.bottom = "";
    surface.style.transform = "translateX(-50%)";
    surface.style.maxWidth = "82%";
    surface.style.padding = "6px 10px";
    surface.style.borderRadius = "4px";
    surface.style.fontSize = "15px";
    surface.style.textAlign = "center";
  };
  const removeVideoCaptionSurfaces = () => {
    document.getElementById(videoCaptionOverlayId)?.remove();
    document.getElementById(videoCaptionFallbackId)?.remove();
  };
  const applyVideoCaptionOverlayState = (state) => {
    // A7.2：非视频页绝不渲染字幕 surface；切换前清除任何残留。
    if (!detectYouTubePage().isVideoPage) {
      removeVideoCaptionSurfaces();
      return true;
    }
    const inactiveId = state.overlayMode === "fallback-bar"
      ? videoCaptionOverlayId
      : videoCaptionFallbackId;
    document.getElementById(inactiveId)?.remove();
    if (state.overlayMode === "hidden") {
      removeVideoCaptionSurfaces();
      return true;
    }
    const surfaceId = state.overlayMode === "fallback-bar"
      ? videoCaptionFallbackId
      : videoCaptionOverlayId;
    const surface = ensureVideoCaptionSurface(surfaceId);
    styleVideoCaptionSurface(surface, state.overlayMode);
    surface.dataset.agentEnglishStatus = state.status;
    surface.dataset.agentEnglishPageKind = state.pageKind;
    surface.textContent = state.source === "audio"
      ? videoAudioStatusMessage(state)
      : videoCaptionStatusMessage(state);
    return true;
  };
`;
