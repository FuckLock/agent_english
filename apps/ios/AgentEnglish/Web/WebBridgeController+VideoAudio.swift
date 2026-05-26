#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation

extension WebBridgeController {
    func handleVideoAudioState(_ state: VideoAudioTranslationState) {
        videoAudioState = state
        displayMode = .original
    }

    func handleVideoAudioQuota(_ quota: AudioTranslationQuota) {
        let base = videoAudioState ?? makeLightVideoAudioState(quota: quota)
        videoAudioState = base.with(
            status: quota.remainingMinutes == 0 ? .quotaExhausted : base.status,
            quota: quota,
            failureReason: quota.remainingMinutes == 0 ? .audioQuotaExceeded : base.failureReason,
            message: quota.remainingMinutes == 0 ? "今日听音分钟已用完。" : base.message
        )
        displayMode = .original
    }

    func requestVideoAudioPrivacyPrompt() {
        videoAudioPrivacyAcknowledged = false
        videoAudioState = (videoAudioState ?? makeLightVideoAudioState()).with(
            status: .privacyRequired,
            failureReason: .privacyDisclosureRequired,
            message: "开启听音翻译前，请确认会识别当前视频音频。"
        )
        displayMode = .original
        evaluateBridgeCommand(named: "requestVideoAudioTranslation", argument: "{}")
    }

    func acknowledgeVideoAudioPrivacyAndStart() {
        videoAudioPrivacyAcknowledged = true
        startVideoAudioTranslationIfAllowed()
    }

    func startVideoAudioTranslationIfAllowed() {
        guard videoAudioPrivacyAcknowledged else {
            requestVideoAudioPrivacyPrompt()
            return
        }

        videoAudioDispatchCount += 1
        videoAudioState = (videoAudioState ?? makeLightVideoAudioState()).with(
            status: .recognizing,
            failureReason: nil,
            message: "正在听音识别 · Beta"
        )
        displayMode = .original
        dispatchVideoAudioTranslationRequest()
    }

    func stopVideoAudioTranslation() {
        videoAudioState = (videoAudioState ?? makeLightVideoAudioState()).with(
            status: .stopped,
            failureReason: nil,
            message: "听音翻译已停止。"
        )
        displayMode = .original
    }

    func closeVideoAudioTranslation() {
        videoAudioPrivacyAcknowledged = false
        videoAudioState = makeLightVideoAudioState().with(
            status: .closed,
            failureReason: nil,
            message: "听音翻译已关闭，可从视频页轻入口重新开启。"
        )
        displayMode = .original
    }

    func makeLightVideoAudioState(
        quota: AudioTranslationQuota? = nil
    ) -> VideoAudioTranslationState {
        let timestamp = createdAtFormatter.string(from: .now)
        return VideoAudioTranslationState(
            pageId: videoCaptionState?.pageId ?? "youtube-video",
            siteKind: "youtube",
            pageKind: videoCaptionState?.pageKind ?? .youtubeWatch,
            url: videoCaptionState?.url ?? "",
            title: videoCaptionState?.title ?? "YouTube",
            videoId: videoCaptionState?.videoId,
            captionAvailability: videoCaptionState?.captionAvailability ?? .unavailable,
            source: .audio,
            overlayMode: .inlineOverlay,
            status: .idle,
            capabilities: [.audioTranslationBeta, .videoAudioTranslation, .selectionFallback],
            activeSegment: nil,
            quota: quota,
            failureReason: nil,
            message: "听音翻译 Beta",
            updatedAt: timestamp
        )
    }

    private func dispatchVideoAudioTranslationRequest() {
        let requestState = videoAudioState ?? makeLightVideoAudioState()

        Task { [weak self] in
            guard let self else {
                return
            }

            let preferences = await self.currentTranslationPreferences()
            let request = await MainActor.run {
                self.videoAudioRequest(
                    from: requestState,
                    preferences: preferences
                )
            }
            let response = await self.modelServiceClient.videoAudioTranslate(request)

            await MainActor.run {
                self.videoAudioState = response.state
                self.displayMode = .original
                self.applyVideoAudioOverlayState(response.state)
                if let error = response.error {
                    self.pushSummary("video.audio.failed · \(error.code.rawValue)")
                } else {
                    self.pushSummary("video.audio.translated · \(response.segment?.audioSegmentId ?? request.audioSegmentID)")
                }
            }
        }
    }

    private func videoAudioRequest(
        from state: VideoAudioTranslationState,
        preferences: TranslationPreferencesSnapshot
    ) -> ModelServiceVideoAudioTranslateRequest {
        let audioSegmentID = state.activeSegment?.audioSegmentId
            ?? "vaud-\(Int(Date().timeIntervalSince1970))"
        return ModelServiceVideoAudioTranslateRequest(
            pageID: state.pageId,
            url: state.url,
            title: state.title,
            videoID: state.videoId,
            sourceLanguage: preferences.sourceLanguage,
            targetLanguage: preferences.targetLanguage,
            serviceTier: preferences.serviceTier,
            preferredModelID: preferences.preferredModelID,
            audioSegmentID: audioSegmentID,
            audioDurationSeconds: 45,
            captionText: videoCaptionState?.activeSegment?.sourceText,
            captionQuality: videoCaptionState?.captionAvailability == .available ? "available" : "unavailable",
            manualAudioSelection: true,
            privacyDisclosureAccepted: videoAudioPrivacyAcknowledged
        )
    }

    private func applyVideoAudioOverlayState(_ state: VideoAudioTranslationState) {
        guard let payload = jsonString(state) else {
            pushSummary("video.audio.command.failed · encode")
            return
        }

        evaluateBridgeCommand(named: "applyVideoCaptionOverlayState", argument: payload)
    }
}

extension VideoAudioTranslationState {
    func with(
        status: VideoAudioTranslationStatus,
        quota: AudioTranslationQuota? = nil,
        failureReason: VideoAudioFailureReason?,
        message: String?
    ) -> VideoAudioTranslationState {
        VideoAudioTranslationState(
            pageId: pageId,
            siteKind: siteKind,
            pageKind: pageKind,
            url: url,
            title: title,
            videoId: videoId,
            captionAvailability: captionAvailability,
            source: source,
            overlayMode: overlayMode,
            status: status,
            capabilities: capabilities,
            activeSegment: activeSegment,
            quota: quota ?? self.quota,
            failureReason: failureReason,
            message: message,
            updatedAt: ISO8601DateFormatter().string(from: .now)
        )
    }
}
