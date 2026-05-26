import AgentEnglishCore
import Foundation
import SwiftData
import XCTest
@testable import AgentEnglish

/// Phase 8.6：YouTube 视频页 v2.5 隐形态 / 召唤态状态机 + 召唤态菜单四项行为测试。
/// 对齐 VideoAudioTranslationInteractionTests 的 WebBridgeController + @MainActor 风格。
final class VideoSummonStateTests: XCTestCase {
    // MARK: - D1 召唤态显隐状态机

    @MainActor
    func testSummonMenuDefaultsCollapsedWhenEnteringVideo() {
        let controller = WebBridgeController()
        controller.handleVideoCaptionState(makeCaptionState())

        XCTAssertEqual(controller.isVideoImmersiveMode, true)
        XCTAssertEqual(controller.isSummonMenuPresented, false)
    }

    @MainActor
    func testTappingHandleExpandsSummonMenu() {
        let controller = WebBridgeController()
        controller.handleVideoCaptionState(makeCaptionState())

        controller.presentSummonMenu()

        XCTAssertEqual(controller.isSummonMenuPresented, true)
    }

    @MainActor
    func testExecutingMenuActionCollapsesSummonMenu() {
        let controller = WebBridgeController()
        controller.handleVideoCaptionState(makeCaptionState(translated: true))
        controller.presentSummonMenu()

        controller.summonToggleTranslation()

        XCTAssertEqual(controller.isSummonMenuPresented, false)
    }

    // MARK: - D2 召唤态菜单四项行为

    @MainActor
    func testFavoriteActionSavesCurrentCaptionAndCollapses() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let repository = SavedItemRepository(modelContext: ModelContext(container))
        let controller = WebBridgeController(savedItemRepository: repository)
        controller.handleVideoCaptionState(makeCaptionState(translated: true))
        controller.presentSummonMenu()

        controller.summonFavoriteCurrentCaption()

        XCTAssertEqual(try repository.fetchAll().count, 1)
        XCTAssertEqual(try repository.fetchAll().first?.selectedText, "Hello there.")
        XCTAssertEqual(controller.isSummonMenuPresented, false)
    }

    @MainActor
    func testTranslationToggleTriggersTranslationAndCollapses() {
        let controller = WebBridgeController()
        controller.handleVideoCaptionState(makeCaptionState(translated: true))
        controller.presentSummonMenu()

        controller.summonToggleTranslation()

        XCTAssertEqual(controller.translationStatus, .loading)
        XCTAssertEqual(controller.isSummonMenuPresented, false)
    }

    @MainActor
    func testSourceToggleSwitchesBetweenCaptionAndAudioAndCollapses() {
        let controller = WebBridgeController()
        controller.handleVideoCaptionState(makeCaptionState(translated: true))
        controller.presentSummonMenu()

        // 字幕 → 听音：走既有隐私确认入口。
        controller.summonToggleSource()
        XCTAssertEqual(controller.videoAudioState?.source, .audio)
        XCTAssertEqual(controller.videoAudioState?.status, .privacyRequired)
        XCTAssertEqual(controller.isSummonMenuPresented, false)

        // 听音识别中 → 切回字幕优先：停止听音。
        controller.acknowledgeVideoAudioPrivacyAndStart()
        XCTAssertEqual(controller.videoAudioState?.status, .recognizing)
        controller.presentSummonMenu()
        controller.summonToggleSource()
        XCTAssertEqual(controller.videoAudioState?.status, .stopped)
        XCTAssertEqual(controller.isSummonMenuPresented, false)
    }

    @MainActor
    func testBackActionLeavesImmersiveModeAndCollapses() {
        let controller = WebBridgeController()
        controller.handleVideoCaptionState(makeCaptionState(translated: true))
        controller.presentSummonMenu()

        controller.summonBack()

        XCTAssertEqual(controller.isVideoImmersiveMode, false)
        XCTAssertEqual(controller.videoBackRequestCount, 1)
        XCTAssertEqual(controller.isSummonMenuPresented, false)
    }

    // MARK: - C4 召唤态听音来源展示今日剩余分钟

    @MainActor
    func testSummonShowsRemainingAudioMinutesForAudioSource() {
        let controller = WebBridgeController()
        controller.handleVideoCaptionState(makeCaptionState())
        controller.acknowledgeVideoAudioPrivacyAndStart()
        controller.handleVideoAudioQuota(
            AudioTranslationQuota(
                serviceTier: .free,
                status: .ok,
                usedMinutes: 2,
                limitMinutes: 10,
                remainingMinutes: 8,
                resetAt: "2026-05-26T00:00:00.000Z"
            )
        )

        XCTAssertEqual(controller.summonSourceLabel, "听音 Beta")
        XCTAssertEqual(controller.summonRemainingAudioMinutesText, "今日剩余 8 分钟")
    }

    // MARK: - E1 往返收敛无菜单残留

    @MainActor
    func testOpenCloseOpenSequenceConvergesWithoutResidue() {
        let controller = WebBridgeController()
        controller.handleVideoCaptionState(makeCaptionState())

        controller.toggleSummonMenu()
        XCTAssertEqual(controller.isSummonMenuPresented, true)
        controller.dismissSummonMenu()
        XCTAssertEqual(controller.isSummonMenuPresented, false)
        controller.toggleSummonMenu()
        XCTAssertEqual(controller.isSummonMenuPresented, true)
        controller.dismissSummonMenu()

        XCTAssertEqual(controller.isSummonMenuPresented, false)
        XCTAssertEqual(controller.isVideoImmersiveMode, true)
    }

    // MARK: - E2 把手所属隐形态在各字幕 / 听音子状态下都不丢失

    @MainActor
    func testImmersiveModePersistsAcrossCaptionAndAudioSubStates() {
        let captionStatuses: [VideoCaptionOverlayStatus] = [
            .translating, .translated, .captionUnavailable, .failed, .fallback,
        ]
        for status in captionStatuses {
            let controller = WebBridgeController()
            controller.handleVideoCaptionState(makeCaptionState(status: status))
            XCTAssertEqual(
                controller.isVideoImmersiveMode,
                true,
                "字幕子状态 \(status) 不应退出隐形态"
            )
        }

        let audioStatuses: [VideoAudioTranslationStatus] = [
            .recognizing, .quotaExhausted, .failed,
        ]
        for status in audioStatuses {
            let controller = WebBridgeController()
            controller.handleVideoCaptionState(makeCaptionState())
            controller.handleVideoAudioState(makeAudioState(status: status))
            XCTAssertEqual(
                controller.isVideoImmersiveMode,
                true,
                "听音子状态 \(status) 不应退出隐形态"
            )
        }
    }

    // MARK: - Fixtures

    @MainActor
    private func makeCaptionState(
        status: VideoCaptionOverlayStatus = .captionAvailable,
        translated: Bool = false
    ) -> VideoCaptionOverlayState {
        let segment = VideoCaptionSegment(
            pageId: "yt-page",
            segmentId: "vcap-1",
            videoId: "abc",
            sourceText: "Hello there.",
            translatedText: translated ? "你好。" : nil,
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            startTimeSeconds: 0,
            endTimeSeconds: 2,
            containerPath: "video-caption-overlay",
            capturedAt: "2026-05-25T00:00:00.000Z"
        )
        return VideoCaptionOverlayState(
            pageId: "yt-page",
            siteKind: "youtube",
            pageKind: .youtubeWatch,
            url: "https://m.youtube.com/watch?v=abc",
            title: "YouTube",
            videoId: "abc",
            captionAvailability: .available,
            overlayMode: .inlineOverlay,
            status: translated ? .translated : status,
            capabilities: [.captionsAvailable, .videoCaptionOverlay],
            activeSegment: segment,
            failureReason: nil,
            message: nil,
            updatedAt: "2026-05-25T00:00:01.000Z"
        )
    }

    @MainActor
    private func makeAudioState(
        status: VideoAudioTranslationStatus
    ) -> VideoAudioTranslationState {
        VideoAudioTranslationState(
            pageId: "yt-page",
            siteKind: "youtube",
            pageKind: .youtubeWatch,
            url: "https://m.youtube.com/watch?v=abc",
            title: "YouTube",
            videoId: "abc",
            captionAvailability: .unavailable,
            source: .audio,
            overlayMode: .inlineOverlay,
            status: status,
            capabilities: [.audioTranslationBeta, .videoAudioTranslation],
            activeSegment: nil,
            quota: nil,
            failureReason: nil,
            message: nil,
            updatedAt: "2026-05-25T00:00:01.000Z"
        )
    }
}
