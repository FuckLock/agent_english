import Foundation
import XCTest
@testable import AgentEnglishCore

final class VideoAudioTranslationContractTests: XCTestCase {
    func testDecodesVideoAudioFixtureFromContractsPackage() throws {
        let data = try Data(contentsOf: videoAudioFixtureURL())
        let event = try BridgeEventDecoder().decode(data)

        guard case .videoAudioStateChanged(let payload) = event.payload else {
            XCTFail("Expected videoAudioStateChanged payload.")
            return
        }

        XCTAssertEqual(event.schemaVersion, bridgeSchemaVersion)
        XCTAssertEqual(event.eventType, .videoAudioStateChanged)
        XCTAssertEqual(payload.activeSegment?.audioSegmentId, "vaud-1")
        XCTAssertEqual(payload.quota?.remainingMinutes, 7)
        XCTAssertEqual(payload.quota?.resetAt, "2026-05-25T00:00:00.000Z")
    }

    func testVideoAudioTranslateRequestEncodesPlaybackPositionSeconds() throws {
        // Phase 8.12：请求 DTO 新增 playbackPositionSeconds，断言 encode → JSON 含 key、decode 往返一致，
        // 守护 TS number ↔ Swift Double 双端等价不漂移。
        let request = ModelServiceVideoAudioTranslateRequest(
            pageID: "page-youtube-shorts-1",
            url: "https://www.youtube.com/shorts/2QtsWjF3e78",
            title: "Suits clip",
            videoID: "2QtsWjF3e78",
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            serviceTier: .free,
            preferredModelID: "free-translate",
            audioSegmentID: "vaud-1",
            audioDurationSeconds: 49,
            playbackPositionSeconds: 12,
            captionText: nil,
            captionQuality: "unavailable",
            manualAudioSelection: true,
            privacyDisclosureAccepted: true
        )

        let encoded = try JSONEncoder().encode(request)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        )
        XCTAssertEqual(json["playbackPositionSeconds"] as? Double, 12)
        XCTAssertNil(json["audioPayload"], "request must not carry frontend audio payload")
        XCTAssertNil(json["audioData"], "request must not carry frontend audio payload")

        let decoded = try JSONDecoder().decode(
            ModelServiceVideoAudioTranslateRequest.self,
            from: encoded
        )
        XCTAssertEqual(decoded.playbackPositionSeconds, 12)
        XCTAssertEqual(decoded.videoID, "2QtsWjF3e78")
        XCTAssertEqual(decoded, request)
    }

    private func videoAudioFixtureURL() throws -> URL {
        let fileManager = FileManager.default
        var directory = URL(fileURLWithPath: fileManager.currentDirectoryPath)

        for _ in 0..<6 {
            let candidate = directory
                .appendingPathComponent("packages/contracts/tests/fixtures/video-audio-youtube-watch.json")
            if fileManager.fileExists(atPath: candidate.path) {
                return candidate
            }

            directory.deleteLastPathComponent()
        }

        throw NSError(
            domain: "VideoAudioTranslationContractTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Missing video-audio-youtube-watch.json fixture."]
        )
    }
}
