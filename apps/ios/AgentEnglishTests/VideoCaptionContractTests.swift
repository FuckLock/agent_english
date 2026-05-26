import Foundation
import XCTest
@testable import AgentEnglishCore

final class VideoCaptionContractTests: XCTestCase {
    func testDecodesVideoCaptionFixtureFromContractsPackage() throws {
        let data = try Data(contentsOf: videoCaptionFixtureURL())
        let event = try BridgeEventDecoder().decode(data)

        guard case .videoCaptionStateChanged(let payload) = event.payload else {
            XCTFail("Expected videoCaptionStateChanged payload.")
            return
        }

        XCTAssertEqual(event.schemaVersion, bridgeSchemaVersion)
        XCTAssertEqual(event.eventType, .videoCaptionStateChanged)
        XCTAssertEqual(event.requestId, "video-caption-state-vcap-1")
        XCTAssertEqual(payload.siteKind, "youtube")
        XCTAssertEqual(payload.pageKind, .youtubeWatch)
        XCTAssertEqual(payload.captionAvailability, .available)
        XCTAssertEqual(payload.overlayMode, .inlineOverlay)
        XCTAssertEqual(payload.status, .translated)
        XCTAssertEqual(payload.capabilities, [.captionsAvailable, .videoCaptionOverlay, .selectionFallback])
        XCTAssertEqual(payload.activeSegment?.sourceText, "Ranking the best ice moments.")
        XCTAssertEqual(payload.activeSegment?.translatedText, "冰上瞬间排名。")
    }

    private func videoCaptionFixtureURL() throws -> URL {
        let fileManager = FileManager.default
        var directory = URL(fileURLWithPath: fileManager.currentDirectoryPath)

        for _ in 0..<6 {
            let candidate = directory
                .appendingPathComponent("packages/contracts/tests/fixtures/video-caption-youtube-watch.json")
            if fileManager.fileExists(atPath: candidate.path) {
                return candidate
            }

            directory.deleteLastPathComponent()
        }

        throw NSError(
            domain: "VideoCaptionContractTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Missing video-caption-youtube-watch.json fixture."]
        )
    }
}
