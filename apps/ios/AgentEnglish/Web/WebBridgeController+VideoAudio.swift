#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation

extension WebBridgeController {
    func handleVideoAudioState(_ state: VideoAudioTranslationState) {
        videoAudioState = state
        displayMode = .original

        // Phase 8.13 / A2 / A3：browser-agent 无字幕轨自动切听音后，按播放进度段桶上报 recognizing 听音
        // state（带 videoId + 段起点 startTimeSeconds，无音频载荷）；native 收到即按 videoId + 播放进度
        // POST model-gateway 做识别 + 翻译（后端自取音频流、前端不采集），按 videoId + audioSegmentId 段桶
        // 去重避免同段重复请求 / 耗额度；已识别出译文的段不重复触发。
        guard
            state.source == .audio,
            state.status == .recognizing,
            let segment = state.activeSegment,
            (segment.translatedText?.isEmpty ?? true)
        else {
            return
        }
        let segmentKey = "\(state.videoId ?? state.pageId):\(segment.audioSegmentId)"
        guard !videoAudioDispatchedSegments.contains(segmentKey) else {
            return
        }
        videoAudioDispatchedSegments.insert(segmentKey)
        dispatchVideoAudioTranslationRequest()
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
            message: "开启听音翻译前请确认：将由后端按播放进度拉取该视频音频流做识别翻译，不在本机采集、不保存完整音频。"
        )
        displayMode = .original
        evaluateBridgeCommand(named: "requestVideoAudioTranslation", argument: "{}")
    }

    func acknowledgeVideoAudioPrivacyAndStart() {
        videoAudioPrivacyAcknowledged = true
        // Phase 8.13：置位 browser-agent 听音许可 flag，让「无字幕轨自动切听音」生效
        //（隐私确认前停 privacy-required，确认后自动进 recognizing + 按播放进度上报 → native 自动 POST）。
        evaluateBridgeCommand(named: "acknowledgeAudioPrivacy", argument: "")
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
            // Phase 8.13：听音改为后端按 videoId + 播放进度自取音频流识别——传当前段起点播放进度
            //（来自 browser-agent 段桶 startTimeSeconds），不携带任何前端音频载荷。
            playbackPositionSeconds: state.activeSegment?.startTimeSeconds,
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
