import Foundation
import XCTest
@testable import AgentEnglishCore

final class ExplanationProviderClientTests: XCTestCase {
    func testReturnsSuccessfulExplanationFromModelService() async {
        let transport = ExplanationTransportFixture(
            response: .init(
                pageID: "page-1",
                serviceTier: .pro,
                model: fixtureModelOption(),
                translation: "中文释义：gloss over",
                explanation: "这里表示有意淡化问题的重要性。",
                examples: ["They glossed over the delay in the meeting."],
                quota: fixtureQuota(),
                error: nil
            )
        )
        let client = ExplanationProviderClient(
            modelServiceClient: ModelServiceClient(transport: transport)
        )

        let response = await client.explain(selectionFixture(), preferences: preferencesFixture())

        guard case .success(let payload) = response else {
            XCTFail("Expected success response.")
            return
        }

        XCTAssertEqual(payload.translation, "中文释义：gloss over")
        XCTAssertEqual(payload.examples.count, 1)
    }

    func testMapsTierUnavailableToFailurePayload() async {
        let transport = ExplanationTransportFixture(
            response: .init(
                pageID: "page-1",
                serviceTier: .free,
                model: fixtureModelOption(),
                translation: "",
                explanation: "",
                examples: [],
                quota: fixtureQuota(),
                error: .init(code: .tierUnavailable, message: "tier", retryable: false, requiredTier: .pro)
            )
        )
        let client = ExplanationProviderClient(
            modelServiceClient: ModelServiceClient(transport: transport)
        )

        let response = await client.explain(selectionFixture(), preferences: preferencesFixture())

        guard case .failure(let payload) = response else {
            XCTFail("Expected failure response.")
            return
        }

        XCTAssertEqual(payload.failureReason, .tierUnavailable)
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

    private func preferencesFixture() -> TranslationPreferencesSnapshot {
        TranslationPreferencesSnapshot(
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            serviceTier: .pro,
            preferredModelID: "pro-context",
            preferredModelLabel: "Pro 模型 · 语境精读",
            quota: fixtureQuota(),
            lastSyncedAt: .now,
            catalog: .preview(currentTier: .pro, preferredModelID: "pro-context")
        )
    }
}

private struct ExplanationTransportFixture: ModelServiceTransport {
    let response: ModelServiceExplainResponse

    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        .preview(currentTier: serviceTier)
    }

    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        _ = request
        return .init(
            pageID: "page-1",
            serviceTier: .pro,
            model: fixtureModelOption(),
            segmentResults: [],
            quota: fixtureQuota(),
            error: nil
        )
    }

    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        _ = request
        return response
    }
}

private func fixtureModelOption() -> ModelCatalogOption {
    ModelCatalogOption(
        id: "pro-context",
        tier: .pro,
        displayName: "Pro 模型 · 语境精读",
        summary: "适合整段语境解释和更稳定的长句处理。",
        capabilities: ["translation", "explanation", "examples"],
        availability: .available,
        requiredTier: nil,
        quota: fixtureQuota()
    )
}

private func fixtureQuota() -> ModelQuotaSnapshot {
    ModelQuotaSnapshot(
        status: .ok,
        used: 8,
        limit: 200,
        remaining: 192,
        resetAt: ISO8601DateFormatter().string(from: .now.addingTimeInterval(86_400))
    )
}
