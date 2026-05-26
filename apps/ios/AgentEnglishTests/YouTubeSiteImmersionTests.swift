import Foundation
import XCTest
@testable import AgentEnglish

/// Phase 8.7 / E1：YouTube 整站识别 + 极简 chrome 判定 + "整站隐形为真但仅视频页叠字幕"
/// 分支测试。整站识别（chrome 决策）与视频页识别（字幕能力决策）是两个分别判定的入口。
/// 由 SPM `.testTarget` 目录扫描纳入 swift test，不登记 pbxproj（见 criteria C5）。
final class YouTubeSiteImmersionTests: XCTestCase {
    // MARK: - A2.1 / A2.2 整站识别覆盖各 YouTube 域名

    @MainActor
    func testIsYouTubeSiteURLReturnsTrueForAllYouTubePageTypes() {
        let controller = WebBridgeController()
        let youtubeURLs = [
            "https://www.youtube.com/",
            "https://www.youtube.com/feed/subscriptions",
            "https://www.youtube.com/results?search_query=english",
            "https://m.youtube.com/",
            "https://music.youtube.com/",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=abc123",
            "https://www.youtube.com/shorts/abc123",
        ]

        for urlText in youtubeURLs {
            XCTAssertTrue(
                controller.isYouTubeSiteURL(urlText),
                "\(urlText) 应被识别为 YouTube 整站"
            )
        }
    }

    @MainActor
    func testIsYouTubeSiteURLReturnsFalseForNonYouTube() {
        let controller = WebBridgeController()
        let nonYouTubeURLs = [
            "https://www.reddit.com/",
            "https://en.wikipedia.org/wiki/English_language",
            "https://archiveofourown.org/works/123",
            "https://example.com/article",
        ]

        for urlText in nonYouTubeURLs {
            XCTAssertFalse(
                controller.isYouTubeSiteURL(urlText),
                "\(urlText) 不应被识别为 YouTube 整站"
            )
        }
    }

    // MARK: - A1.4 / A2.3 整站隐形为真 vs 仅视频页叠字幕（两个分别判定入口）

    @MainActor
    func testNonVideoYouTubePagesAreSiteButNotVideo() {
        let controller = WebBridgeController()
        // 整站隐形为真、但视频页叠字幕为假的非视频页用例。
        let nonVideoPages = [
            "https://www.youtube.com/",
            "https://www.youtube.com/feed/subscriptions",
            "https://www.youtube.com/results?search_query=english",
            "https://m.youtube.com/",
            "https://music.youtube.com/",
        ]

        for urlText in nonVideoPages {
            XCTAssertTrue(
                controller.isYouTubeSiteURL(urlText),
                "\(urlText) 整站识别应为真"
            )
            XCTAssertFalse(
                controller.isYouTubeVideoURL(urlText),
                "\(urlText) 视频页识别应为假（仅视频页才叠字幕）"
            )
        }
    }

    @MainActor
    func testVideoPagesAreBothSiteAndVideo() {
        let controller = WebBridgeController()
        // 视频页：整站隐形与视频页叠字幕皆为真。
        let videoPages = [
            "https://www.youtube.com/watch?v=abc123",
            "https://www.youtube.com/shorts/abc123",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://m.youtube.com/watch?v=abc123",
        ]

        for urlText in videoPages {
            XCTAssertTrue(
                controller.isYouTubeSiteURL(urlText),
                "\(urlText) 整站识别应为真"
            )
            XCTAssertTrue(
                controller.isYouTubeVideoURL(urlText),
                "\(urlText) 视频页识别应为真"
            )
        }
    }

    @MainActor
    func testWatchURLWithoutVideoIdIsSiteButNotVideo() {
        let controller = WebBridgeController()
        // /watch 缺 v 参数：仍属整站、但非视频页。
        XCTAssertTrue(controller.isYouTubeSiteURL("https://www.youtube.com/watch"))
        XCTAssertFalse(controller.isYouTubeVideoURL("https://www.youtube.com/watch"))
    }

    // MARK: - A1.3 chrome 决策：YouTube 各页面类型走极简，非 YouTube 走完整 chrome

    @MainActor
    func testMinimalChromeDecisionForYouTubePageTypes() {
        let controller = WebBridgeController()
        let youtubePages = [
            "https://www.youtube.com/",
            "https://www.youtube.com/feed/subscriptions",
            "https://www.youtube.com/results?search_query=english",
            "https://www.youtube.com/shorts/abc123",
            "https://www.youtube.com/watch?v=abc123",
            "https://m.youtube.com/",
        ]

        for urlText in youtubePages {
            XCTAssertTrue(
                controller.shouldUseMinimalChrome(for: urlText),
                "\(urlText) chrome 决策应为极简（不含分段控件 / 工具条）"
            )
        }
    }

    @MainActor
    func testFullChromeDecisionForNonYouTubeTextSites() {
        let controller = WebBridgeController()
        let textSites = [
            "https://en.wikipedia.org/wiki/English_language",
            "https://www.reddit.com/r/EnglishLearning/",
            "https://archiveofourown.org/works/123",
            "https://example.com/article",
        ]

        for urlText in textSites {
            XCTAssertFalse(
                controller.shouldUseMinimalChrome(for: urlText),
                "\(urlText) chrome 决策应为完整 browserBody"
            )
        }
    }

    // MARK: - A1.2 / A1.3 视图分支结构（源文件断言）：极简 chrome 分支不含分段控件 / 工具条

    func testWebBrowserViewRoutesYouTubeSiteToMinimalChromeBranch() throws {
        let source = try webBrowserViewSource()

        // body 通过整站判定符号驱动 chrome 决策（整站识别 + 极简 chrome 决策入口接入视图）。
        XCTAssertTrue(source.contains("isYouTubeImmersiveSite"))
        XCTAssertTrue(source.contains("shouldUseMinimalChrome"))

        // chrome 决策不再仅依赖 isVideoImmersiveMode 单一条件：YouTube 整站（含非视频页）
        // 也走极简 chrome——showsBrowserChrome 同时排除视频隐形态与 YouTube 整站，二者皆走
        // 极简（webViewContainer 单例 + 条件叠加），只有普通文本网页才显示完整浏览 chrome。
        XCTAssertTrue(source.contains("showsBrowserChrome"))
        XCTAssertTrue(
            source.contains("!bridgeController.isVideoImmersiveMode && !isYouTubeImmersiveSite")
        )
    }

    func testMinimalChromeBranchExcludesDisplayModePickerAndToolbar() throws {
        let source = try webBrowserViewSource()

        // 极简 chrome 语义：webViewContainer 单例化为视图树根（避免分支切换重建 WKWebView），
        // 浏览 chrome（顶部 URL 栏 + 底部工具条 / 状态栏）只在 showsBrowserChrome 为真时经
        // safeAreaInset 叠加。YouTube 整站 / 视频隐形态 showsBrowserChrome 为假 → 不渲染
        // 分段控件 Picker 与工具条。
        XCTAssertTrue(source.contains("private var showsBrowserChrome: Bool"))
        // url 状态栏与底部 chrome 均受 showsBrowserChrome 守卫（不在 YouTube / 视频路径渲染）。
        XCTAssertTrue(source.contains("if showsBrowserChrome {"))
        XCTAssertTrue(source.contains("browserBottomChrome"))

        // 分段控件 Picker（原文 / 双语 / 学习）与 browserToolbar 仍保留在源文件，但只经
        // browserBottomChrome（受 showsBrowserChrome 守卫）可达，未被整体删除。
        XCTAssertTrue(source.contains(".pickerStyle(.segmented)"))
        XCTAssertTrue(source.contains("private var browserToolbar"))
        XCTAssertTrue(source.contains("private var browserBottomChrome"))
    }

    private func webBrowserViewSource() throws -> String {
        try String(
            contentsOf: sourceURL("apps/ios/AgentEnglish/Screens/WebBrowserView.swift"),
            encoding: .utf8
        )
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

        throw NSError(domain: "YouTubeSiteImmersionTests", code: 1)
    }
}
