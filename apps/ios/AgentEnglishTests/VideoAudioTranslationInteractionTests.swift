import AgentEnglishCore
import Foundation
import XCTest
@testable import AgentEnglish

final class VideoAudioTranslationInteractionTests: XCTestCase {
    @MainActor
    func testAudioTranslationRequiresPrivacyAcknowledgementBeforeDispatch() {
        let controller = WebBridgeController()

        controller.startVideoAudioTranslationIfAllowed()

        XCTAssertEqual(controller.videoAudioState?.status, .privacyRequired)
        XCTAssertEqual(controller.videoAudioDispatchCount, 0)

        controller.acknowledgeVideoAudioPrivacyAndStart()

        XCTAssertEqual(controller.videoAudioState?.status, .recognizing)
        XCTAssertEqual(controller.videoAudioDispatchCount, 1)
    }

    @MainActor
    func testStopAudioTranslationRestoresLightEntryState() {
        let controller = WebBridgeController()

        controller.acknowledgeVideoAudioPrivacyAndStart()
        controller.stopVideoAudioTranslation()

        XCTAssertEqual(controller.videoAudioState?.status, .stopped)
        XCTAssertEqual(controller.displayMode, .original)
    }

    @MainActor
    func testCloseAudioTranslationRestoresLightEntryState() {
        let controller = WebBridgeController()

        controller.acknowledgeVideoAudioPrivacyAndStart()
        controller.closeVideoAudioTranslation()

        XCTAssertEqual(controller.videoAudioState?.status, .closed)
        XCTAssertEqual(controller.videoAudioPrivacyAcknowledged, false)
    }

    @MainActor
    func testCloseAudioTranslationKeepsVideoImmersiveMode() {
        let controller = WebBridgeController()

        controller.closeVideoAudioTranslation()

        XCTAssertEqual(controller.isVideoImmersiveMode, true)
        XCTAssertEqual(controller.displayMode, .original)
    }
}
