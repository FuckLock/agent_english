// Phase 8.9：YouTube 视频自带字幕轨数据读取的「注入运行时」子模块（页面上下文内执行）。
//
// 在 WKWebView 的 YouTube 页面上下文内：
// - 取 player response 的 `.captions.playerCaptionsTracklistRenderer.captionTracks`：优先 InnerTube
//   `/youtubei/v1/player`（ANDROID client，按 URL videoId 重取，覆盖移动版 / Shorts / SPA；见
//   fetchPlayerResponseViaInnerTube），失败回退 `getPlayerResponse()` / `window.ytInitialPlayerResponse`
//   （桌面场景兜底）；
// - 选轨（英文人工 > 目标语言 > ASR）后，**同源** `fetch(baseUrl + "&fmt=json3")`（带页面
//   cookie / visitor data，不经 native、不外部请求 —— 竞品 Immersive Translate / Trancy 同款；外部
//   WEB client 反爬 0 条轨、timedtext 0 字节，ANDROID client + 页面同源 fetch 可取）；
// - 解析 json3（events[].tStartMs / dDurationMs / segs[].utf8）为带时间轴字幕句序列；
// - 监听 video 的 timeupdate（节流 >=100ms）按 currentTime 定位当前句 -> 去重 -> post。
//
// 合规（ADR-0004 v2.8）：字幕只实时读取用于翻译显示，只取当前播放所需；不写文件 / 不离线缓存
// 整轨（videoCaptionLines 仅内存、SPA 切视频即重置）/ 不再分发；不下载 / 分离媒体。
//
// 与 site-adapters/youtube-caption-track.ts（逻辑层 TS）保持等价实现；本字符串经
// browser-runtime-source.ts 拼接进同一 IIFE，纯函数暴露到 __agentEnglishYouTubeInjection 供单测。

export const RUNTIME_YOUTUBE_CAPTION_TRACK_SOURCE = String.raw`  const CAPTION_TIMEUPDATE_THROTTLE_MS = 120;
  const readYouTubePlayerResponse = () => {
    const player = document.querySelector("#movie_player, .html5-video-player, ytd-player");
    if (player && typeof player.getPlayerResponse === "function") {
      try {
        const response = player.getPlayerResponse();
        if (response) {
          return response;
        }
      } catch (error) {
        // getPlayerResponse 在切视频瞬间可能抛错 / 返回旧值；回退到 ytInitialPlayerResponse。
      }
    }
    return window.ytInitialPlayerResponse || null;
  };
  const readInnerTubeApiKey = () => {
    try {
      if (window.ytcfg && typeof window.ytcfg.get === "function") {
        const key = window.ytcfg.get("INNERTUBE_API_KEY");
        if (typeof key === "string" && key.length > 0) {
          return key;
        }
      }
    } catch (error) {
      // ytcfg 不可用 -> 无 key（InnerTube 无 key 也能取 caption metadata）。
    }
    return "";
  };
  const fetchPlayerResponseViaInnerTube = (videoId) => {
    // 用 ANDROID client 按 videoId 重取 player response —— 不依赖播放器 DOM / ytInitialPlayerResponse，
    // 天然覆盖移动版 m.youtube.com + Shorts + SPA（WEB client 反爬返回空轨，ANDROID client 可取）。
    if (!videoId) {
      return Promise.resolve(null);
    }
    const apiKey = readInnerTubeApiKey();
    const endpoint = apiKey ? "/youtubei/v1/player?key=" + encodeURIComponent(apiKey) : "/youtubei/v1/player";
    const body = JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 31, hl: "en", gl: "US" } },
      videoId: videoId,
    });
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      credentials: "same-origin",
    })
      .then((response) => (response && response.ok ? response.json() : null))
      .catch(() => null);
  };
  const parseCaptionTracks = (playerResponse) => {
    const tracks = playerResponse
      && playerResponse.captions
      && playerResponse.captions.playerCaptionsTracklistRenderer
      && playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    if (!Array.isArray(tracks)) {
      return [];
    }
    return tracks.filter((track) => track && typeof track.baseUrl === "string" && track.baseUrl.length > 0);
  };
  const captionTrackIsAuto = (track) => {
    if (track.kind === "asr") {
      return true;
    }
    return typeof track.vssId === "string" && track.vssId.indexOf("a.") === 0;
  };
  const captionLanguageMatches = (track, prefix) => {
    const code = (track.languageCode || "").toLowerCase();
    return code === prefix || code.indexOf(prefix + "-") === 0;
  };
  const selectCaptionTrack = (tracks, targetLanguageCode) => {
    if (!tracks.length) {
      return null;
    }
    const manual = tracks.filter((track) => !captionTrackIsAuto(track));
    const target = (targetLanguageCode || "").toLowerCase();
    const englishManual = manual.find((track) => captionLanguageMatches(track, "en"));
    if (englishManual) {
      return englishManual;
    }
    if (target && target !== "en") {
      const targetManual = manual.find((track) => captionLanguageMatches(track, target));
      if (targetManual) {
        return targetManual;
      }
    }
    const englishAuto = tracks.find((track) => captionTrackIsAuto(track) && captionLanguageMatches(track, "en"));
    if (englishAuto) {
      return englishAuto;
    }
    if (target && target !== "en") {
      const targetAuto = tracks.find((track) => captionTrackIsAuto(track) && captionLanguageMatches(track, target));
      if (targetAuto) {
        return targetAuto;
      }
    }
    return manual[0] || tracks[0] || null;
  };
  const buildJson3CaptionUrl = (baseUrl) => {
    // 先清掉 baseUrl 已有的 fmt（部分来源带 &fmt=srv3），再加 &fmt=json3；
    // 重复 fmt 参数会被 YouTube 取第一个 -> 返回 XML 而非 json3（真机踩坑）。
    const withoutFmt = baseUrl.replace(/([?&])fmt=[^&]*&?/g, "$1").replace(/[?&]$/, "");
    return withoutFmt + (withoutFmt.indexOf("?") >= 0 ? "&" : "?") + "fmt=json3";
  };
  const parseJson3Captions = (payload) => {
    const events = payload && payload.events;
    if (!Array.isArray(events)) {
      return [];
    }
    const lines = [];
    for (const event of events) {
      if (!event || typeof event.tStartMs !== "number") {
        continue;
      }
      const segs = Array.isArray(event.segs) ? event.segs : [];
      const joined = segs.map((seg) => (seg && seg.utf8) || "").join("");
      const sourceText = normalizeText(joined);
      if (!sourceText.length) {
        continue;
      }
      const durationMs = typeof event.dDurationMs === "number" ? event.dDurationMs : 0;
      lines.push({
        startTimeSeconds: event.tStartMs / 1000,
        endTimeSeconds: (event.tStartMs + durationMs) / 1000,
        sourceText,
      });
    }
    lines.sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);
    return lines;
  };
  const findActiveCaptionLine = (lines, currentTime) => {
    let active = null;
    for (const line of lines) {
      if (currentTime < line.startTimeSeconds || currentTime >= line.endTimeSeconds) {
        continue;
      }
      if (!active || line.startTimeSeconds > active.startTimeSeconds) {
        active = line;
      }
    }
    return active;
  };
  const captionLineSignature = (line) => (line ? line.startTimeSeconds.toFixed(3) + ":" + line.sourceText : "");
  const resetVideoCaptionTrack = () => {
    // SPA 切视频：丢弃上一个视频字幕序列（合规：不缓存整轨）+ 重置去重签名。
    videoCaptionLines = [];
    videoCaptionTrackVideoId = "";
    videoCaptionTrackLoading = false;
    videoCaptionTrackLanguage = "";
    videoCaptionTrackIsAuto = false;
    videoCaptionTrackUnavailable = false;
    lastVideoCaptionSignature = "";
    lastVideoTimeUpdateAt = 0;
  };
  const captionTrackTargetLanguageCode = () => (
    typeof window.__agentEnglishTargetLanguageCode === "string"
      ? window.__agentEnglishTargetLanguageCode
      : ""
  );
  const ensureVideoCaptionTrackLoaded = () => {
    const detection = detectYouTubePage();
    if (!detection.isVideoPage) {
      return Promise.resolve(false);
    }
    const videoId = detection.videoId || "";
    if (videoId && videoId === videoCaptionTrackVideoId) {
      return Promise.resolve(videoCaptionLines.length > 0);
    }
    if (videoCaptionTrackLoading) {
      return Promise.resolve(false);
    }
    videoCaptionTrackLoading = true;
    videoCaptionTrackUnavailable = false;
    // 优先 InnerTube ANDROID client 按 videoId 重取（覆盖移动版 / Shorts / SPA）；
    // 失败回退页面 player response（getPlayerResponse / ytInitialPlayerResponse，桌面场景兜底）。
    return fetchPlayerResponseViaInnerTube(videoId)
      .then((innerTubeResponse) => {
        const playerResponse = innerTubeResponse || readYouTubePlayerResponse();
        const tracks = parseCaptionTracks(playerResponse);
        const track = selectCaptionTrack(tracks, captionTrackTargetLanguageCode());
        if (!track) {
          // A6：无 captionTracks / 空轨 / 仅损坏轨 -> 标记不可用，不抛错 / 不重试空转。
          videoCaptionTrackLoading = false;
          videoCaptionLines = [];
          videoCaptionTrackVideoId = videoId;
          videoCaptionTrackUnavailable = true;
          videoCaptionTrackLanguage = "";
          videoCaptionTrackIsAuto = false;
          return false;
        }
        videoCaptionTrackLanguage = track.languageCode || "";
        videoCaptionTrackIsAuto = captionTrackIsAuto(track);
        // 同源 fetch（页面上下文，带 cookie / visitor data）；不经 native、不外部请求。
        return fetch(buildJson3CaptionUrl(track.baseUrl), { credentials: "same-origin" })
          .then((response) => (response && response.ok ? response.json() : null))
          .then((payload) => {
            videoCaptionTrackLoading = false;
            const lines = parseJson3Captions(payload);
            videoCaptionLines = lines;
            videoCaptionTrackVideoId = videoId;
            if (!lines.length) {
              videoCaptionTrackUnavailable = true;
            }
            return lines.length > 0;
          });
      })
      .catch((error) => {
        // InnerTube / timedtext fetch 失败（403 / 网络）-> 降级不可用；不持续重试空转。
        videoCaptionTrackLoading = false;
        videoCaptionLines = [];
        videoCaptionTrackVideoId = videoId;
        videoCaptionTrackUnavailable = true;
        return false;
      });
  };
  const buildCaptionLineOverrides = (line) => {
    if (!line) {
      return videoCaptionTrackUnavailable
        ? { sourceText: "", failureReason: "caption-unavailable" }
        : { sourceText: "" };
    }
    return {
      sourceText: line.sourceText,
      startTimeSeconds: line.startTimeSeconds,
      endTimeSeconds: line.endTimeSeconds,
      selectedTrackLanguage: videoCaptionTrackLanguage || undefined,
      selectedTrackIsAutoGenerated: videoCaptionTrackIsAuto,
      containerPath: "caption-track",
    };
  };
  const syncActiveCaptionLine = (currentTime, force = false) => {
    if (!detectYouTubePage().isVideoPage) {
      return false;
    }
    const line = findActiveCaptionLine(videoCaptionLines, currentTime);
    const state = buildYouTubeVideoCaptionState(buildCaptionLineOverrides(line));
    return postVideoCaptionState(state, force);
  };
  const installVideoTimeUpdateListener = () => {
    // A4 / A8：仅在视频播放页装配 timeupdate 监听；节流 >=120ms；只装一次（videoTimeUpdateBound）。
    if (videoTimeUpdateBound || !detectYouTubePage().isVideoPage) {
      return false;
    }
    const video = document.querySelector("video");
    if (!video || typeof video.addEventListener !== "function") {
      return false;
    }
    videoTimeUpdateBound = true;
    video.addEventListener("timeupdate", () => {
      const nowMs = Date.now();
      if (nowMs - lastVideoTimeUpdateAt < CAPTION_TIMEUPDATE_THROTTLE_MS) {
        return;
      }
      lastVideoTimeUpdateAt = nowMs;
      syncActiveCaptionLine(typeof video.currentTime === "number" ? video.currentTime : 0, false);
    });
    return true;
  };
`;
