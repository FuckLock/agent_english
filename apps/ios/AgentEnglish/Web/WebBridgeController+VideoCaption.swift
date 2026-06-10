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
            resetVideoCaptionChunkState()
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

        // 字幕轨首次出现 → 取整轨句子按序切块，预翻当前滑窗（当前块 + 下一块）填缓存。
        if videoCaptionPrefetchedVideoId != videoKey {
            videoCaptionPrefetchedVideoId = videoKey
            // 切到新视频：清旧译文缓存与分块状态（键含 videoId、只留当前视频，避免跨视频内存累积）。
            videoCaptionTranslationCache.removeAll()
            resetVideoCaptionChunkState()
            loadVideoCaptionChunks(videoKey: videoKey, state: state)
        } else {
            // 播放推进 / 用户拖动 → 滑窗跟着当前句走，缺的块补预取。
            ensureVideoCaptionPrefetchWindow(
                videoKey: videoKey,
                state: state,
                aroundText: segment.sourceText
            )
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

    // 分块滑窗预翻（修「翻译跟不上」）：整轨单批必撞 gateway 双闸——总字符 >1800 →
    // content-too-long、配额按句计 / 单请求超档位上限 → quota-exceeded——预翻从未成功过，
    // 句句退化为现场单句翻（1-2 秒/句跟不上台词滚动、常驻「字幕翻译中」）。
    // 现按原始句序切块（块内保留对白上下文，批量对齐质量优于孤立单句；不再 Set 去重打乱句序），
    // 只预翻「当前块 + 下一块」（Shorts 短轨 ≈ 整轨，长视频成本有界、划走少白翻），播放跨块时
    // 由字幕状态回调事件驱动补预取；失败块最多重试 1 次，期间回退单句翻（不投毒）。
    nonisolated static let videoCaptionChunkMaxLines = 12
    nonisolated static let videoCaptionChunkMaxChars = 1500
    nonisolated static let videoCaptionChunkWindowSize = 2
    nonisolated static let videoCaptionChunkMaxAttempts = 2
    nonisolated static let videoCaptionChunkMaxConcurrent = 2

    /// 按原始句序切块：跳过空白句；块不超过 maxLines 句且不超过 maxChars 总字符
    /// （双闸均留余量：gateway 限 1800 字符、Free 档配额单请求 20 句）。
    /// 单句超长独占一块（交给 gateway 判 content-too-long，与单句现场翻同失败语义）。
    nonisolated static func chunkCaptionTexts(
        _ texts: [String],
        maxLines: Int = videoCaptionChunkMaxLines,
        maxChars: Int = videoCaptionChunkMaxChars
    ) -> [[String]] {
        var chunks: [[String]] = []
        var current: [String] = []
        var currentChars = 0

        for text in texts {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                continue
            }
            if !current.isEmpty,
               current.count >= maxLines || currentChars + trimmed.count > maxChars {
                chunks.append(current)
                current = []
                currentChars = 0
            }
            current.append(trimmed)
            currentChars += trimmed.count
        }
        if !current.isEmpty {
            chunks.append(current)
        }
        return chunks
    }

    /// 当前句所在块的下标（句文本与块内文本同源自注入脚本的 videoCaptionLines，均已 normalize）。
    nonisolated static func videoCaptionChunkIndex(containing text: String, in chunks: [[String]]) -> Int? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }
        return chunks.firstIndex(where: { $0.contains(trimmed) })
    }

    func resetVideoCaptionChunkState() {
        videoCaptionChunks.removeAll()
        videoCaptionChunkRequested.removeAll()
        videoCaptionChunkAttempts.removeAll()
        videoCaptionChunkInFlightCount = 0
    }

    private func loadVideoCaptionChunks(videoKey: String, state: VideoCaptionOverlayState) {
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
            // evaluateJavaScript 回调在主线程；期间可能已划走视频 → 丢弃迟到的轨数据。
            guard self.videoCaptionPrefetchedVideoId == videoKey else {
                return
            }
            self.videoCaptionChunks = Self.chunkCaptionTexts(texts)
            guard !self.videoCaptionChunks.isEmpty else {
                return
            }
            // 滑窗锚定当前句（用户可能已拖动进度条，不一定从第 0 块开始）。
            let aroundText = self.videoCaptionState?.activeSegment?.sourceText
                ?? state.activeSegment?.sourceText
                ?? ""
            self.ensureVideoCaptionPrefetchWindow(
                videoKey: videoKey,
                state: state,
                aroundText: aroundText
            )
        }
    }

    private func ensureVideoCaptionPrefetchWindow(
        videoKey: String,
        state: VideoCaptionOverlayState,
        aroundText: String
    ) {
        guard !videoCaptionChunks.isEmpty else {
            return
        }
        let currentIndex = Self.videoCaptionChunkIndex(
            containing: aroundText,
            in: videoCaptionChunks
        ) ?? 0
        let windowEnd = min(
            currentIndex + Self.videoCaptionChunkWindowSize,
            videoCaptionChunks.count
        )
        for index in currentIndex..<windowEnd {
            guard
                !videoCaptionChunkRequested.contains(index),
                videoCaptionChunkAttempts[index, default: 0] < Self.videoCaptionChunkMaxAttempts,
                videoCaptionChunkInFlightCount < Self.videoCaptionChunkMaxConcurrent
            else {
                continue
            }
            requestVideoCaptionChunk(index, videoKey: videoKey, state: state)
        }
    }

    private func requestVideoCaptionChunk(
        _ index: Int,
        videoKey: String,
        state: VideoCaptionOverlayState
    ) {
        videoCaptionChunkRequested.insert(index)
        videoCaptionChunkAttempts[index, default: 0] += 1
        videoCaptionChunkInFlightCount += 1
        let texts = videoCaptionChunks[index]

        Task { [weak self] in
            guard let self else {
                return
            }
            let preferences = await self.currentTranslationPreferences()
            let (request, idToText) = await MainActor.run {
                self.batchVideoCaptionRequest(
                    texts: texts,
                    state: state,
                    preferences: preferences
                )
            }
            let result = await self.providerClient.translate(request, preferences: preferences)

            await MainActor.run {
                // 划走视频后迟到的块结果直接丢弃（缓存已清、滑窗已重置）；此时计数器已被
                // reset 归零，不再递减——否则会误减新视频正在飞行的计数。
                guard self.videoCaptionPrefetchedVideoId == videoKey else {
                    return
                }
                self.videoCaptionChunkInFlightCount = max(0, self.videoCaptionChunkInFlightCount - 1)

                var translatedCount = 0
                for segmentResult in result.segmentResults {
                    guard
                        let sourceText = idToText[segmentResult.segmentId],
                        let translated = segmentResult.translatedText,
                        !translated.isEmpty
                    else {
                        continue
                    }
                    self.videoCaptionTranslationCache["\(videoKey)\n\(sourceText)"] = translated
                    translatedCount += 1
                }

                if translatedCount == 0 {
                    // 整块失败：释放 requested，滑窗按 attempts 上限最多再试 1 次；句子由单句翻兜底。
                    self.videoCaptionChunkRequested.remove(index)
                    return
                }

                // 块完成：若当前句已在缓存且尚未显示译文 → 立即刷新双语（不等下一次 timeupdate）。
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
