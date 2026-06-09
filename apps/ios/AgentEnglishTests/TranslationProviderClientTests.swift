import Foundation
import XCTest
@testable import AgentEnglishCore

final class TranslationProviderClientTests: XCTestCase {
    func testTranslatesSegmentsThroughModelServiceClient() async {
        let transport = MockModelServiceTransport(
            translateResponse: .init(
                pageID: "page-1",
                serviceTier: .free,
                model: previewModelOption(),
                segmentResults: [
                    .init(segmentID: "seg-1", translatedText: "[简体中文] Hello world.", errorCode: nil),
                ],
                quota: previewQuota(),
                error: nil
            )
        )
        let client = TranslationProviderClient(
            modelServiceClient: ModelServiceClient(transport: transport)
        )

        let result = await client.translate(
            translationRequestFixture(),
            preferences: preferencesFixture()
        )

        XCTAssertEqual(result.segmentResults.first?.translatedText, "[简体中文] Hello world.")
        XCTAssertNil(result.failureReason)
    }

    func testMapsQuotaExceededFromModelService() async {
        let transport = MockModelServiceTransport(
            translateResponse: .init(
                pageID: "page-1",
                serviceTier: .free,
                model: previewModelOption(),
                segmentResults: [
                    .init(segmentID: "seg-1", translatedText: nil, errorCode: .quotaExceeded),
                ],
                quota: previewQuota(status: .exhausted, used: 20, limit: 20),
                error: .init(code: .quotaExceeded, message: "quota", retryable: false, requiredTier: nil)
            )
        )
        let client = TranslationProviderClient(
            modelServiceClient: ModelServiceClient(transport: transport)
        )

        let result = await client.translate(
            translationRequestFixture(),
            preferences: preferencesFixture()
        )

        XCTAssertEqual(result.failureReason, .quotaExceeded)
        XCTAssertEqual(result.segmentResults.first?.failureReason, .quotaExceeded)
    }

    private func translationRequestFixture() -> TranslationRequest {
        let pageContext = PageContext(
            pageId: "page-1",
            url: "https://example.com/article",
            title: "Example Article",
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            displayMode: .bilingual,
            capabilities: [.readablePage, .inlineTranslation, .selectionFallback],
            siteKind: "generic"
        )
        let pageTextSegment = PageTextSegment(
            pageId: "page-1",
            segmentId: "seg-1",
            sourceText: "Hello world.",
            containerPath: "body>article:nth-of-type(1)>p:nth-of-type(1)",
            sourceLanguage: "English",
            isVisible: true,
            capabilities: [.readablePage, .inlineTranslation]
        )

        return TranslationRequest(
            pageId: "page-1",
            pageContext: pageContext,
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            displayMode: .bilingual,
            capabilities: [.readablePage, .inlineTranslation, .selectionFallback],
            segments: [pageTextSegment]
        )
    }

    // Phase 8.5 起，Free 文本翻译走 translation-proxy；model-gateway 翻译路径由 Pro / Max 承载。
    // 本测试验证的是 model-gateway 翻译路径与错误映射，因此固定使用 Pro tier。
    private func preferencesFixture() -> TranslationPreferencesSnapshot {
        TranslationPreferencesSnapshot(
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            serviceTier: .pro,
            preferredModelID: "openai-gpt-4o",
            preferredModelLabel: "Pro 模型 · openai-gpt-4o",
            quota: previewQuota(),
            lastSyncedAt: .now,
            catalog: .preview(currentTier: .pro)
        )
    }
}

private func previewModelOption() -> ModelCatalogOption {
    ModelCatalogOption(
        id: "deepseek-chat",
        minTier: .free,
        displayName: "Free 服务 · deepseek-chat",
        summary: "适合通用网页翻译和快速释义。",
        capabilities: ["translation"],
        availability: .available,
        requiredTier: nil,
        quota: previewQuota()
    )
}

private func previewQuota(
    status: ModelQuotaStatus = .ok,
    used: Int = 3,
    limit: Int = 20
) -> ModelQuotaSnapshot {
    ModelQuotaSnapshot(
        status: status,
        used: used,
        limit: limit,
        remaining: max(0, limit - used),
        resetAt: ISO8601DateFormatter().string(from: .now.addingTimeInterval(86_400))
    )
}

private struct MockModelServiceTransport: ModelServiceTransport {
    var catalogSnapshot: ModelCatalogSnapshot = .preview(currentTier: .free)
    var translateResponse: ModelServiceTranslateResponse? = nil
    var explainResponse: ModelServiceExplainResponse? = nil

    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        _ = serviceTier
        return catalogSnapshot
    }

    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        _ = request
        return translateResponse ?? .init(
            pageID: request.pageID,
            serviceTier: request.serviceTier,
            model: previewModelOption(),
            segmentResults: [],
            quota: previewQuota(),
            error: nil
        )
    }

    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        _ = request
        return explainResponse ?? .init(
            pageID: request.pageID,
            serviceTier: request.serviceTier,
            model: previewModelOption(),
            translation: "",
            explanation: "",
            examples: [],
            quota: previewQuota(),
            error: nil
        )
    }
}
