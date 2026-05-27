import Foundation
import XCTest
@testable import AgentEnglishCore

// Phase 8.8 修复（ADR-0005 v2.7 解耦兜底）：translation-proxy 限额 session token 来源。
// 验证 Free 文本翻译不依赖 model-gateway——无 gateway 游客 session token 时用本地设备级匿名标识兜底，
// proxy 总能拿到一个稳定的限额分组键，不会因 gateway 未起而 401（这正是真机「配了 key 仍不翻」的根因）。
// 由 SPM .testTarget 目录扫描纳入 swift test，不登记 pbxproj（教训②）。
final class TranslationProxySessionTokenTests: XCTestCase {
    override func setUp() {
        super.setUp()
        try? KeychainCredentialStore.deleteSessionToken()
        try? KeychainCredentialStore.deleteToken(alias: KeychainCredentialStore.anonymousProxyTokenAlias)
    }

    override func tearDown() {
        try? KeychainCredentialStore.deleteSessionToken()
        try? KeychainCredentialStore.deleteToken(alias: KeychainCredentialStore.anonymousProxyTokenAlias)
        super.tearDown()
    }

    // 无 gateway session token 时，resolvedSessionToken 兜底返回非空匿名标识（不再是 nil → proxy 不会 401）。
    func testResolvedSessionTokenFallsBackToAnonymousWhenNoGatewayToken() throws {
        try KeychainCredentialStore.deleteSessionToken()

        let token = try TranslationProxyEndpointConfiguration.resolvedSessionToken()

        XCTAssertNotNil(token, "无 gateway token 时应兜底返回本地匿名标识，而非 nil")
        XCTAssertFalse(token?.isEmpty ?? true)
        XCTAssertTrue(token?.hasPrefix("anon-") ?? false, "兜底标识应为本地生成的设备级匿名 token")
    }

    // 有 gateway session token 时优先使用它（登录 / 游客会话），不被匿名兜底覆盖。
    func testResolvedSessionTokenPrefersGatewayToken() throws {
        try KeychainCredentialStore.saveSessionToken("guest-session-xyz")

        let token = try TranslationProxyEndpointConfiguration.resolvedSessionToken()

        XCTAssertEqual(token, "guest-session-xyz")
    }

    // 匿名兜底标识跨调用稳定（同设备复用同一限额分组键，而非每次新生成）。
    func testAnonymousProxyTokenStableAcrossCalls() throws {
        try KeychainCredentialStore.deleteSessionToken()

        let first = try TranslationProxyEndpointConfiguration.resolvedSessionToken()
        let second = try TranslationProxyEndpointConfiguration.resolvedSessionToken()

        XCTAssertNotNil(first)
        XCTAssertEqual(first, second, "匿名限额标识应持久化复用，而非每次新生成")
    }
}
