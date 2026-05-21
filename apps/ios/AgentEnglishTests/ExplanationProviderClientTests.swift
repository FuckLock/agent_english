import AgentEnglishCore
import Foundation
import XCTest

final class ExplanationProviderClientTests: XCTestCase {
    func testReturnsProviderNotConfiguredFailureWithoutCredentialReference() async {
        let client = ExplanationProviderClient()
        let response = await client.explain(selectionFixture(), credentialReference: nil)

        guard case .failure(let payload) = response else {
            XCTFail("Expected provider-not-configured failure.")
            return
        }

        XCTAssertEqual(payload.selectionId, "sel-1")
        XCTAssertEqual(payload.failureReason, .providerNotConfigured)
    }

    func testReturnsFailurePayloadAfterRetryExhaustion() async {
        let client = ExplanationProviderClient(
            transport: FailingExplanationTransport(),
            configuration: ExplanationProviderClientConfiguration(maxRetryAttempts: 1)
        )
        let response = await client.explain(
            selectionFixture(),
            credentialReference: "keychain.provider.preview"
        )

        guard case .failure(let payload) = response else {
            XCTFail("Expected selection explanation failure.")
            return
        }

        XCTAssertEqual(payload.selectionId, "sel-1")
        XCTAssertEqual(payload.sourceUrl, "https://example.com/article")
        XCTAssertEqual(payload.failureReason, .selectionExplanationFailed)
    }

    private func selectionFixture() -> SelectionRequest {
        SelectionRequest(
            pageId: "page-1",
            selectionId: "sel-1",
            selectedText: "gloss over",
            contextBefore: "They tried to",
            contextAfter: "the policy change.",
            sourceUrl: "https://example.com/article",
            sourceTitle: "Example Article",
            containerPath: "body>article:nth-of-type(1)>p:nth-of-type(1)",
            kind: .phrase
        )
    }
}

private struct FailingExplanationTransport: ExplanationProviderTransport {
    func explainSelection(
        request: SelectionRequest,
        credentialReference: String
    ) async throws -> SelectionExplanationResult {
        _ = request
        _ = credentialReference
        throw NSError(domain: "FailingExplanationTransport", code: 1)
    }
}
