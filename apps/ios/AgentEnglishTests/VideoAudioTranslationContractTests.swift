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
