import Foundation
import XCTest

final class WebBrowserViewTests: XCTestCase {
    /// Phase 8.6 (v2.5)：视频页底部常驻工具条 / 状态栏已移除（隐形态），原 video-audio-*
    /// 底部 chrome 标识不再出现在 WebBrowserView；听音入口 / 停止 / 关闭 / 来源切换改由
    /// 召唤态胶囊菜单与听音状态机承载。隐私确认弹窗（video-audio-privacy）仍在视频页保留。
    func testVideoImmersiveModeRemovesLegacyBottomChrome() throws {
        let source = try webBrowserViewSource()

        XCTAssertFalse(source.contains("videoCaptionToolbar"))
        XCTAssertFalse(source.contains("videoCaptionStatusBar"))
        XCTAssertFalse(source.contains("accessibilityIdentifier(\"video-audio-source\")"))
        XCTAssertFalse(source.contains("accessibilityIdentifier(\"video-audio-status\")"))
        XCTAssertFalse(source.contains("video-audio-entry"))
        XCTAssertFalse(source.contains("video-audio-stop"))
        XCTAssertFalse(source.contains("video-audio-close"))
        XCTAssertTrue(source.contains("video-audio-privacy"))
    }

    /// 召唤态胶囊菜单恰含四项动作（返回 / 翻译开关 / 字幕·听音来源切换 / 收藏当前句），
    /// 隐形态唯一常驻 App 元素是左侧召唤把手。
    func testSummonMenuExposesStableAccessibilityIdentifiers() throws {
        let source = try videoSummonViewSource()

        XCTAssertTrue(source.contains("accessibilityIdentifier(\"video-summon-handle\")"))
        XCTAssertTrue(source.contains("video-summon-back"))
        XCTAssertTrue(source.contains("video-summon-translation-toggle"))
        XCTAssertTrue(source.contains("video-summon-source-toggle"))
        XCTAssertTrue(source.contains("video-summon-favorite"))
        // 没有第五个可点击动作项（dismiss 背景与剩余分钟展示不属于动作项）。
        XCTAssertFalse(source.contains("video-summon-retry"))
        XCTAssertFalse(source.contains("video-summon-close"))
        XCTAssertFalse(source.contains("video-summon-stop"))
    }

    private func webBrowserViewSource() throws -> String {
        try String(contentsOf: sourceURL("apps/ios/AgentEnglish/Screens/WebBrowserView.swift"), encoding: .utf8)
    }

    private func videoSummonViewSource() throws -> String {
        try String(contentsOf: sourceURL("apps/ios/AgentEnglish/Screens/VideoSummonView.swift"), encoding: .utf8)
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
