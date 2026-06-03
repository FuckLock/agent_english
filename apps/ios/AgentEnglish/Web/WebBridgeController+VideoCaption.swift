#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation

extension WebBridgeController {
    var isVideoImmersiveMode: Bool {
        videoCaptionState != nil || videoAudioState != nil
    }

    /// Phase 8.7 / A1：YouTube 整站极简 chrome 决策入口。整站（首页 / 列表 / 搜索 /
    /// Shorts / 视频页）均走极简 chrome——不展示阅读显示模式分段控件与常驻浏览工具条。
    /// 这是 "整站隐形" 的 chrome 决策，独立于 "仅视频页才叠字幕" 的字幕能力决策
    /// （后者由 `isVideoImmersiveMode` / `isYouTubeVideoURL` 承担）。
    func shouldUseMinimalChrome(for urlText: String) -> Bool {
        isYouTubeSiteURL(urlText)
    }

    func updateVideoModeForPageReady(urlText: String) {
        guard isYouTubeVideoURL(urlText) else {
            videoCaptionState = nil
            videoAudioState = nil
            videoAudioPrivacyAcknowledged = false
            videoCaptionTranslationKeys.removeAll()
            videoCaptionTranslationCache.removeAll()
            videoCaptionPrefetchedVideoId = nil
            isSummonMenuPresented = false
            return
        }

        displayMode = .original
    }

    func handleVideoCaptionState(_ state: VideoCaptionOverlayState) {
        videoCaptionState = state
        displayMode = .original

        guard
            let segment = state.activeSegment,
            !segment.sourceText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            segment.translatedText?.isEmpty != false,
            state.status == .captionAvailable || state.status == .translating
        else {
            return
        }

        let videoKey = state.videoId ?? state.pageId

        // 字幕轨首次出现 → 异步批量预翻整轨填缓存（后续句直接命中、不逐句串行等 DeepSeek）。
        if videoCaptionPrefetchedVideoId != videoKey {
            videoCaptionPrefetchedVideoId = videoKey
            // 切到新视频：清旧译文缓存（键含 videoId、只留当前视频，避免跨视频内存累积）。
            videoCaptionTranslationCache.removeAll()
            prefetchVideoCaptionTranslations(videoKey: videoKey, state: state)
        }

        // 命中预取缓存 → 直接显示双语，不卡「等待字幕翻译」。
        let cacheKey = "\(videoKey)\n\(segment.sourceText)"
        if let cached = videoCaptionTranslationCache[cacheKey], !cached.isEmpty {
            let cachedSegment = segment.with(translatedText: cached)
            let cachedState = state.with(
                status: .translated,
                activeSegment: cachedSegment,
                failureReason: nil,
                message: nil
            )
            videoCaptionState = cachedState
            applyVideoCaptionOverlayState(cachedState)
            return
        }

        let translationKey = "\(videoKey):\(segment.sourceText)"
        guard !videoCaptionTranslationKeys.contains(translationKey) else {
            return
        }
        videoCaptionTranslationKeys.insert(translationKey)

        let translatingState = state.with(
            status: .translating,
            failureReason: nil,
            message: nil
        )
        videoCaptionState = translatingState
        applyVideoCaptionOverlayState(translatingState)

        Task { [weak self] in
            guard let self else {
                return
            }

            let preferences = await self.currentTranslationPreferences()
            let request = self.translationRequest(
                for: segment,
                state: state,
                preferences: preferences
            )
            let result = await self.providerClient.translate(
                request,
                preferences: preferences
            )

            await MainActor.run {
                let segmentResult = result.resultsBySegmentId[segment.segmentId]
                    ?? result.segmentResults.first

                if let translatedText = segmentResult?.translatedText, !translatedText.isEmpty {
                    self.videoCaptionTranslationCache[cacheKey] = translatedText
                    let translatedSegment = segment.with(translatedText: translatedText)
                    let translatedState = state.with(
                        status: .translated,
                        activeSegment: translatedSegment,
                        failureReason: nil,
                        message: nil
                    )
                    self.videoCaptionState = translatedState
                    self.applyVideoCaptionOverlayState(translatedState)
                } else {
                    let failureReason = self.videoCaptionFailureReason(
                        from: result.failureReason ?? segmentResult?.failureReason
                    )
                    let failedState = state.with(
                        status: .failed,
                        failureReason: failureReason,
                        message: self.videoCaptionFailureMessage(for: failureReason)
                    )
                    self.videoCaptionState = failedState
                    self.applyVideoCaptionOverlayState(failedState)
                }
            }
        }
    }

    func saveCurrentVideoCaption() {
        guard
            let state = videoCaptionState,
            let segment = state.activeSegment,
            let savedItemRepository
        else {
            return
        }

        do {
            _ = try savedItemRepository.save(
                SavedItem(
                    sourceUrl: state.url,
                    sourceTitle: state.title.isEmpty ? "YouTube" : state.title,
                    selectedText: segment.sourceText,
                    contextBefore: "",
                    contextAfter: "",
                    translation: segment.translatedText ?? "",
                    explanation: "YouTube 字幕句",
                    kind: .sentence,
                    createdAt: createdAtFormatter.string(from: .now)
                )
            )
            try? statisticsRepository?.recordSavedItem()
            pushSummary("video.caption.favorite.saved · \(segment.segmentId)")
        } catch {
            pushSummary("video.caption.favorite.failed · \(error.localizedDescription)")
        }
    }

    // 批量预翻：字幕轨加载后取整轨全部句（getVideoCaptionLines 已暴露），一次性批量翻 → 填缓存。
    // 修「翻译跟不上」：之前逐句串行等 DeepSeek（1-2 秒/句）跟不上字幕滚动、卡「等待字幕翻译」；
    // 预取后播到当前句直接命中缓存显示双语。失败 / 未命中仍回退单句翻（不破坏 Phase 8.9 字幕翻译）。
    private func prefetchVideoCaptionTranslations(
        videoKey: String,
        state: VideoCaptionOverlayState
    ) {
        guard let webView else {
            return
        }
        let script = "JSON.stringify((window.__agentEnglishYouTubeInjection && window.__agentEnglishYouTubeInjection.getVideoCaptionLines ? window.__agentEnglishYouTubeInjection.getVideoCaptionLines() : []).map(function (line) { return line.sourceText; }))"
        webView.evaluateJavaScript(script) { [weak self] result, _ in
            guard
                let self,
                let json = result as? String,
                let data = json.data(using: .utf8),
                let texts = try? JSONDecoder().decode([String].self, from: data)
            else {
                return
            }
            let uniqueTexts = Array(
                Set(texts.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
            )
            guard !uniqueTexts.isEmpty else {
                return
            }

            Task { [weak self] in
                guard let self else {
                    return
                }
                let preferences = await self.currentTranslationPreferences()
                let (request, idToText) = await MainActor.run {
                    self.batchVideoCaptionRequest(
                        texts: uniqueTexts,
                        state: state,
                        preferences: preferences
                    )
                }
                let result = await self.providerClient.translate(request, preferences: preferences)

                await MainActor.run {
                    for segmentResult in result.segmentResults {
                        guard
                            let sourceText = idToText[segmentResult.segmentId],
                            let translated = segmentResult.translatedText,
                            !translated.isEmpty
                        else {
                            continue
                        }
                        self.videoCaptionTranslationCache["\(videoKey)\n\(sourceText)"] = translated
                    }
                    // 预取完成：若当前句已在缓存且尚未显示译文 → 立即刷新双语（不等下一次 timeupdate）。
                    guard
                        let current = self.videoCaptionState,
                        let activeSegment = current.activeSegment,
                        activeSegment.translatedText?.isEmpty != false,
                        let cached = self.videoCaptionTranslationCache["\(videoKey)\n\(activeSegment.sourceText)"],
                        !cached.isEmpty
                    else {
                        return
                    }
                    let refreshedSegment = activeSegment.with(translatedText: cached)
                    let refreshedState = current.with(
                        status: .translated,
                        activeSegment: refreshedSegment,
                        failureReason: nil,
                        message: nil
                    )
                    self.videoCaptionState = refreshedState
                    self.applyVideoCaptionOverlayState(refreshedState)
                }
            }
        }
    }

    private func batchVideoCaptionRequest(
        texts: [String],
        state: VideoCaptionOverlayState,
        preferences: TranslationPreferencesSnapshot
    ) -> (TranslationRequest, [String: String]) {
        let sourceLanguage = state.activeSegment?.sourceLanguage ?? "English"
        let pageContext = PageContext(
            pageId: state.pageId,
            url: state.url,
            title: state.title,
            sourceLanguage: sourceLanguage,
            targetLanguage: preferences.targetLanguage,
            displayMode: .bilingual,
            capabilities: state.capabilities,
            siteKind: "youtube"
        )
        var idToText: [String: String] = [:]
        var segments: [PageTextSegment] = []
        for (index, text) in texts.enumerated() {
            let segmentId = "capbatch-\(index)"
            idToText[segmentId] = text
            segments.append(
                PageTextSegment(
                    pageId: state.pageId,
                    segmentId: segmentId,
                    sourceText: text,
                    containerPath: "video-caption-overlay",
                    sourceLanguage: sourceLanguage,
                    isVisible: true,
                    capabilities: state.capabilities
                )
            )
        }
        let request = TranslationRequest(
            pageId: state.pageId,
            pageContext: pageContext,
            sourceLanguage: sourceLanguage,
            targetLanguage: preferences.targetLanguage,
            displayMode: .bilingual,
            capabilities: state.capabilities,
            segments: segments
        )
        return (request, idToText)
    }

    func translationRequest(
        for segment: VideoCaptionSegment,
        state: VideoCaptionOverlayState,
        preferences: TranslationPreferencesSnapshot
    ) -> TranslationRequest {
        let pageContext = PageContext(
            pageId: state.pageId,
            url: state.url,
            title: state.title,
            sourceLanguage: segment.sourceLanguage,
            targetLanguage: preferences.targetLanguage,
            displayMode: .bilingual,
            capabilities: state.capabilities,
            siteKind: "youtube"
        )
        let pageTextSegment = PageTextSegment(
            pageId: state.pageId,
            segmentId: segment.segmentId,
            sourceText: segment.sourceText,
            containerPath: segment.containerPath ?? "video-caption-overlay",
            sourceLanguage: segment.sourceLanguage,
            isVisible: true,
            capabilities: state.capabilities
        )

        return TranslationRequest(
            pageId: state.pageId,
            pageContext: pageContext,
            sourceLanguage: segment.sourceLanguage,
            targetLanguage: preferences.targetLanguage,
            displayMode: .bilingual,
            capabilities: state.capabilities,
            segments: [pageTextSegment]
        )
    }

    func applyVideoCaptionOverlayState(_ state: VideoCaptionOverlayState) {
        guard let payload = jsonString(state) else {
            pushSummary("video.caption.command.failed · encode")
            return
        }

        evaluateBridgeCommand(named: "applyVideoCaptionOverlayState", argument: payload)
    }

    func videoCaptionFailureReason(
        from translationFailure: TranslationFailureReason?
    ) -> VideoCaptionFailureReason {
        switch translationFailure {
        case .quotaExceeded: return .quotaExceeded
        case .tierUnavailable: return .tierUnavailable
        case .serviceUnavailable: return .serviceUnavailable
        case .contentTooLong: return .contentTooLong
        case .providerFallbackFailed: return .providerFallbackFailed
        case .pageUnrecognized, .translationFailed, .none:
            return .translationFailed
        }
    }

    func videoCaptionFailureMessage(
        for failureReason: VideoCaptionFailureReason
    ) -> String {
        switch failureReason {
        case .captionUnavailable:
            return "当前视频没有检测到可用字幕。"
        case .overlayUnsafe:
            return "字幕会遮挡播放器，已切换到下方字幕条。"
        case .quotaExceeded:
            return "当前服务等级额度不足。"
        case .tierUnavailable:
            return "当前模型需要更高服务等级。"
        case .contentTooLong:
            return "当前字幕过长，暂不能翻译。"
        case .providerFallbackFailed, .serviceUnavailable, .translationFailed:
            return "字幕翻译暂不可用。"
        }
    }

    /// Phase 8.7 / A2：YouTube "整站" 识别——覆盖各 YouTube 域名的任意页面（首页 / 列表 /
    /// 搜索 / Shorts / 视频页）。区别于 `isYouTubeVideoURL`（仅视频页）：整站识别用于驱动
    /// WebBrowserView 的极简 chrome 决策（整站隐形），视频页识别用于驱动字幕叠层能力决策。
    /// 两者 host 集合一致，但 path 判定不同——这是 "整站隐形" 与 "仅视频页叠字幕" 两个分别
    /// 判定入口的核心区分。本函数只解析 URL / host，不做任何 DOM 扫描或字幕句抽取。
    func isYouTubeSiteURL(_ urlText: String) -> Bool {
        guard let url = URL(string: urlText), let host = url.host?.lowercased() else {
            return false
        }

        return Self.youTubeHosts.contains(host)
    }

    func isYouTubeVideoURL(_ urlText: String) -> Bool {
        guard let url = URL(string: urlText), let host = url.host?.lowercased() else {
            return false
        }

        guard Self.youTubeHosts.contains(host) else {
            return false
        }

        if host == "youtu.be" {
            return url.pathComponents.count > 1
        }

        if url.path == "/watch" {
            return URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .contains(where: { $0.name == "v" && $0.value?.isEmpty == false }) == true
        }

        return url.path.hasPrefix("/shorts/")
    }

    /// YouTube 整站识别与视频页识别共用的 host 集合（与 browser-agent
    /// `detectYouTubePage` 的 host 集合保持一致，含 m. / music. / youtu.be）。
    static let youTubeHosts: Set<String> = [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
    ]
}

private extension VideoCaptionSegment {
    func with(translatedText: String?) -> VideoCaptionSegment {
        VideoCaptionSegment(
            pageId: pageId,
            segmentId: segmentId,
            videoId: videoId,
            sourceText: sourceText,
            translatedText: translatedText,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            startTimeSeconds: startTimeSeconds,
            endTimeSeconds: endTimeSeconds,
            containerPath: containerPath,
            capturedAt: capturedAt
        )
    }
}

extension VideoCaptionOverlayState {
    func with(
        status: VideoCaptionOverlayStatus,
        activeSegment: VideoCaptionSegment? = nil,
        failureReason: VideoCaptionFailureReason?,
        message: String?
    ) -> VideoCaptionOverlayState {
        VideoCaptionOverlayState(
            pageId: pageId,
            siteKind: siteKind,
            pageKind: pageKind,
            url: url,
            title: title,
            videoId: videoId,
            captionAvailability: captionAvailability,
            overlayMode: failureReason == .captionUnavailable ? .fallbackBar : overlayMode,
            status: status,
            capabilities: capabilities,
            activeSegment: activeSegment ?? self.activeSegment,
            failureReason: failureReason,
            message: message,
            updatedAt: ISO8601DateFormatter().string(from: .now)
        )
    }
}
