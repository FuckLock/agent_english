import Foundation
import XCTest
@testable import AgentEnglish
#if canImport(AgentEnglishCore)
@testable import AgentEnglishCore
#endif

final class VideoCaptionPrefetchChunkingTests: XCTestCase {
    func testChunkingPreservesOrderAndSkipsEmptyLines() {
        let chunks = WebBridgeController.chunkCaptionTexts(
            ["Hey,", "  ", "how come you two", "", "never got an"],
            maxLines: 12,
            maxChars: 1500
        )

        XCTAssertEqual(chunks, [["Hey,", "how come you two", "never got an"]])
    }

    func testChunkingRespectsMaxLines() {
        let lines = (0..<25).map { "line \($0)" }
        let chunks = WebBridgeController.chunkCaptionTexts(
            lines,
            maxLines: 12,
            maxChars: 1500,
            firstChunkMaxLines: 12
        )

        XCTAssertEqual(chunks.map(\.count), [12, 12, 1])
        XCTAssertEqual(chunks.flatMap { $0 }, lines)
    }

    func testFirstChunkIsSmallerForFastFirstTranslation() {
        // 默认首块 4 句（快速返回首批译文），后续块按 12 句切。
        let lines = (0..<20).map { "line \($0)" }
        let chunks = WebBridgeController.chunkCaptionTexts(lines)

        XCTAssertEqual(chunks.map(\.count), [4, 12, 4])
        XCTAssertEqual(chunks.flatMap { $0 }, lines)
    }

    func testChunkingRespectsMaxChars() {
        // 每句 100 字符：1500 上限内只装得下 15 句，第 16 句起进下一块。
        let lines = (0..<16).map { index in
            String(repeating: Character(UnicodeScalar(UInt8(97 + index))), count: 100)
        }
        let chunks = WebBridgeController.chunkCaptionTexts(
            lines,
            maxLines: 20,
            maxChars: 1500,
            firstChunkMaxLines: 20
        )

        XCTAssertEqual(chunks.map(\.count), [15, 1])
        XCTAssertLessThanOrEqual(chunks[0].reduce(0) { $0 + $1.count }, 1500)
    }

    func testOversizeSingleLineGetsOwnChunk() {
        let oversize = String(repeating: "x", count: 2000)
        let chunks = WebBridgeController.chunkCaptionTexts(
            ["short", oversize, "tail"],
            maxLines: 12,
            maxChars: 1500
        )

        XCTAssertEqual(chunks, [["short"], [oversize], ["tail"]])
    }

    func testChunkIndexFindsContainingChunk() {
        let chunks = [["a", "b"], ["c", "d"], ["e"]]

        XCTAssertEqual(WebBridgeController.videoCaptionChunkIndex(containing: "c", in: chunks), 1)
        XCTAssertEqual(WebBridgeController.videoCaptionChunkIndex(containing: " e ", in: chunks), 2)
        XCTAssertNil(WebBridgeController.videoCaptionChunkIndex(containing: "missing", in: chunks))
        XCTAssertNil(WebBridgeController.videoCaptionChunkIndex(containing: "  ", in: chunks))
    }

    @MainActor
    func testLeavingVideoPageResetsChunkState() {
        let controller = WebBridgeController()
        controller.videoCaptionChunks = [["a"], ["b"]]
        controller.videoCaptionChunkRequested = [0]
        controller.videoCaptionChunkAttempts = [0: 1]
        controller.videoCaptionChunkInFlightCount = 1

        controller.updateVideoModeForPageReady(urlText: "https://example.com/article")

        XCTAssertTrue(controller.videoCaptionChunks.isEmpty)
        XCTAssertTrue(controller.videoCaptionChunkRequested.isEmpty)
        XCTAssertTrue(controller.videoCaptionChunkAttempts.isEmpty)
        XCTAssertEqual(controller.videoCaptionChunkInFlightCount, 0)
    }
}
