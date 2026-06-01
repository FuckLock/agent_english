import Foundation
import XCTest
@testable import AgentEnglishCore

// 覆盖 v2.8 真机修订引入的「开发兜底地址」：DEBUG 下未配置 TRANSLATION_PROXY_ROOT 时默认连本地
// translation-proxy，让本地调试的 Free 文本 / 字幕翻译开箱可用（不依赖 Xcode scheme 环境变量或
// Info.plist 注入）。真机 / release 仍走环境变量或 Info.plist 配置的生产地址，DEBUG 默认不影响 release。
final class TranslationProxyEndpointConfigurationTests: XCTestCase {
    func testResolvedURLFallsBackToLocalProxyInDebug() {
        let url = TranslationProxyEndpointConfiguration.resolvedURL(
            environment: [:],
            bundle: Bundle(for: Self.self)
        )
        #if DEBUG
        XCTAssertEqual(url?.absoluteString, "http://localhost:4200")
        #else
        XCTAssertNil(url)
        #endif
    }

    func testEnvironmentRootOverridesDebugDefault() {
        let url = TranslationProxyEndpointConfiguration.resolvedURL(
            environment: ["TRANSLATION_PROXY_ROOT": "https://proxy.example.com"],
            bundle: Bundle(for: Self.self)
        )
        XCTAssertEqual(url?.absoluteString, "https://proxy.example.com")
    }
}
