import Foundation
import XCTest
@testable import AgentEnglishCore

final class AccountSessionClientTests: XCTestCase {
    override func tearDownWithError() throws {
        try? KeychainCredentialStore.deleteSessionToken()
    }

    func testBootstrapGuestSessionStoresKeychainToken() async throws {
        try? KeychainCredentialStore.deleteSessionToken()
        let client = AccountSessionClient(transport: MockAccountSessionTransport())

        let session = try await client.bootstrapGuestSession()

        XCTAssertEqual(session.account.kind, .guest)
        XCTAssertEqual(session.account.serviceTier, .free)
        XCTAssertEqual(try KeychainCredentialStore.loadSessionToken(), "guest-session")
    }

    func testDevLoginStoresTestProAndTestMaxTokensInKeychain() async throws {
        try? KeychainCredentialStore.deleteSessionToken()
        let client = AccountSessionClient(transport: MockAccountSessionTransport())

        let pro = try await client.loginDevAccount(
            email: "test-pro@agentenglish.local",
            password: "from-env"
        )
        let max = try await client.loginDevAccount(
            email: "test-max@agentenglish.local",
            password: "from-env"
        )

        XCTAssertEqual(pro.account.kind, .devPro)
        XCTAssertEqual(max.account.kind, .devMax)
        XCTAssertEqual(try KeychainCredentialStore.loadSessionToken(), "max-session")
    }

    func testLogoutReturnsGuestAndReplacesKeychainToken() async throws {
        try KeychainCredentialStore.saveSessionToken("max-session")
        let client = AccountSessionClient(transport: MockAccountSessionTransport())

        let session = try await client.logout()

        XCTAssertEqual(session.account.kind, .guest)
        XCTAssertEqual(session.account.serviceTier, .free)
        XCTAssertEqual(try KeychainCredentialStore.loadSessionToken(), "guest-after-logout")
    }

    func testDecodesSharedDevLoginResponseContractFixture() throws {
        let fixtureURL = try sharedContractFixtureURL(
            "auth-session-dev-login.json"
        )
        let payload = try Data(contentsOf: fixtureURL)

        let response = try JSONDecoder().decode(DevLoginResponse.self, from: payload)

        XCTAssertEqual(response.session.sessionToken, "session_fixture_dev_pro")
        XCTAssertEqual(response.session.expiresAt, "2026-06-21T00:00:00Z")
        XCTAssertEqual(response.session.account.kind, .devPro)
        XCTAssertEqual(response.session.account.serviceTier, .pro)
        XCTAssertEqual(response.session.account.email, "test-pro@agentenglish.local")
        XCTAssertEqual(response.session.entitlement.account.kind, .devPro)
        XCTAssertEqual(response.session.entitlement.serviceTier, .pro)
        XCTAssertEqual(response.session.entitlement.quota.remaining, 188)
        XCTAssertEqual(response.session.entitlement.catalog.defaultModelID, "openai-gpt-4o")
        XCTAssertEqual(response.session.entitlement.catalog.availableTiers, [.free, .pro, .max])
        XCTAssertEqual(response.session.entitlement.catalog.options.last?.requiredTier, .max)
    }

    private func sharedContractFixtureURL(_ fixtureName: String) throws -> URL {
        var directory = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 {
            directory.deleteLastPathComponent()
        }
        return directory
            .appendingPathComponent("packages")
            .appendingPathComponent("contracts")
            .appendingPathComponent("tests")
            .appendingPathComponent("fixtures")
            .appendingPathComponent(fixtureName)
    }
}

private struct MockAccountSessionTransport: AccountSessionTransport {
    func guestSession(existingSessionToken: String?) async throws -> AuthSession {
        _ = existingSessionToken
        return makeSession(token: "guest-session", kind: .guest, tier: .free)
    }

    func loginDevAccount(email: String, password: String) async throws -> AuthSession {
        _ = password
        if email.contains("test-max") {
            return makeSession(token: "max-session", kind: .devMax, tier: .max)
        }
        return makeSession(token: "pro-session", kind: .devPro, tier: .pro)
    }

    func logout(sessionToken: String?) async throws -> AuthSession {
        _ = sessionToken
        return makeSession(token: "guest-after-logout", kind: .guest, tier: .free)
    }

    private func makeSession(
        token: String,
        kind: AccountStatusKind,
        tier: ModelServiceTier
    ) -> AuthSession {
        let account = AccountStatus(
            kind: kind,
            displayName: kind == .guest ? "游客模式" : "\(tier.displayName) 测试账号",
            serviceTier: tier,
            email: kind == .guest ? nil : "test-\(tier.rawValue)@agentenglish.local",
            isTestAccount: kind != .guest
        )
        let catalog = ModelCatalogSnapshot.preview(currentTier: tier)
        return AuthSession(
            sessionToken: token,
            expiresAt: "2026-06-21T00:00:00Z",
            account: account,
            entitlement: EntitlementSnapshot(
                account: account,
                serviceTier: tier,
                quota: catalog.quota,
                catalog: catalog,
                refreshedAt: "2026-05-22T00:00:00Z"
            )
        )
    }
}
