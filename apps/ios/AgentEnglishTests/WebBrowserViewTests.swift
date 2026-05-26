import Foundation
import XCTest

final class WebBrowserViewTests: XCTestCase {
    func testVideoAudioSourceBadgeAndStatusCopyForCaptionAndAudioStates() throws {
        let source = try webBrowserViewSource()

        XCTAssertTrue(source.contains("accessibilityIdentifier(\"video-audio-source\")"))
        XCTAssertTrue(source.contains("accessibilityIdentifier(\"video-audio-status\")"))
        XCTAssertTrue(source.contains("听音 Beta"))
        XCTAssertTrue(source.contains("字幕可用，优先使用字幕翻译"))
    }

    func testVideoAudioEntryStopAndCloseControlsExposeStableAccessibilityIdentifiers() throws {
        let source = try webBrowserViewSource()

        XCTAssertTrue(source.contains("video-audio-entry"))
        XCTAssertTrue(source.contains("video-audio-stop"))
        XCTAssertTrue(source.contains("video-audio-close"))
        XCTAssertTrue(source.contains("video-audio-privacy"))
    }

    private func webBrowserViewSource() throws -> String {
        try String(contentsOf: sourceURL("apps/ios/AgentEnglish/Screens/WebBrowserView.swift"), encoding: .utf8)
    }

    private func sourceURL(_ relativePath: String) throws -> URL {
        let fileManager = FileManager.default
        var directory = URL(fileURLWithPath: fileManager.currentDirectoryPath)

        for _ in 0..<6 {
            let candidate = directory.appendingPathComponent(relativePath)
            if fileManager.fileExists(atPath: candidate.path) {
                return candidate
            }
            directory.deleteLastPathComponent()
        }

        throw NSError(domain: "WebBrowserViewTests", code: 1)
    }
}
