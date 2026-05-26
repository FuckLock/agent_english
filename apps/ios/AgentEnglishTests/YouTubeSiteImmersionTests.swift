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

        // 存在整站极简 chrome 分支与整站判定符号。
        XCTAssertTrue(source.contains("isYouTubeImmersiveSite"))
        XCTAssertTrue(source.contains("youTubeSiteBody"))
        XCTAssertTrue(source.contains("shouldUseMinimalChrome"))

        // body 分支不再仅依赖 isVideoImmersiveMode 单一条件。
        XCTAssertTrue(source.contains("else if isYouTubeImmersiveSite"))
    }

    func testMinimalChromeBranchExcludesDisplayModePickerAndToolbar() throws {
        let source = try webBrowserViewSource()

        // 分段控件 Picker（原文 / 双语 / 学习）与 browserToolbar 仍只存在于 browserBody
        // 文本网页分支；youTubeSiteBody 极简分支只渲染 webViewContainer。
        let youTubeBodyDecl = "private var youTubeSiteBody: some View {"
        guard let bodyRange = source.range(of: youTubeBodyDecl) else {
            return XCTFail("未找到 youTubeSiteBody 声明")
        }
        // 截取 youTubeSiteBody 声明体（到下一个右花括号块）做粗粒度断言。
        let afterDecl = source[bodyRange.upperBound...]
        let bodySnippet = String(afterDecl.prefix(160))
        XCTAssertTrue(bodySnippet.contains("webViewContainer"))
        XCTAssertFalse(bodySnippet.contains(".pickerStyle(.segmented)"))
        XCTAssertFalse(bodySnippet.contains("browserToolbar"))

        // 分段控件仍保留在源文件（browserToolbar 分支内），未被整体删除。
        XCTAssertTrue(source.contains(".pickerStyle(.segmented)"))
        XCTAssertTrue(source.contains("private var browserToolbar"))
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
