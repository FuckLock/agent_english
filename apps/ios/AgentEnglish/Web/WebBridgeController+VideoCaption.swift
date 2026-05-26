#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation

extension WebBridgeController {
    var isVideoImmersiveMode: Bool {
        videoCaptionState != nil || videoAudioState != nil
    }

    func updateVideoModeForPageReady(urlText: String) {
        guard isYouTubeVideoURL(urlText) else {
            videoCaptionState = nil
            videoAudioState = nil
            videoAudioPrivacyAcknowledged = false
            videoCaptionTranslationKeys.removeAll()
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

        let translationKey = "\(state.videoId ?? state.pageId):\(segment.sourceText)"
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

    func isYouTubeVideoURL(_ urlText: String) -> Bool {
        guard let url = URL(string: urlText), let host = url.host?.lowercased() else {
            return false
        }

        if host == "youtu.be" {
            return url.pathComponents.count > 1
        }

        guard ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].contains(host) else {
            return false
        }

        if url.path == "/watch" {
            return URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .contains(where: { $0.name == "v" && $0.value?.isEmpty == false }) == true
        }

        return url.path.hasPrefix("/shorts/")
    }
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
