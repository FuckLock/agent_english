import Foundation
import XCTest

final class SettingsViewTests: XCTestCase {
    func testAudioQuotaSummaryShowsFreeTenMinuteCopy() throws {
        let source = try settingsViewSource()

        XCTAssertTrue(source.contains("accessibilityIdentifier(\"audio-quota-summary\")"))
        XCTAssertTrue(source.contains("今日 \\(audioQuota.limit) 分钟"))
    }

    func testAudioQuotaSummaryShowsRemainingMinutesForHigherTiers() throws {
        let source = try settingsViewSource()

        XCTAssertTrue(source.contains("audioQuota.remaining"))
        XCTAssertTrue(source.contains("ModelCatalogSnapshot.previewAudioQuota"))
    }

    private func settingsViewSource() throws -> String {
        try String(contentsOf: sourceURL("apps/ios/AgentEnglish/Screens/SettingsView.swift"), encoding: .utf8)
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

        throw NSError(domain: "SettingsViewTests", code: 1)
    }
}
