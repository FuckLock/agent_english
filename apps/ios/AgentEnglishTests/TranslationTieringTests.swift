import Foundation
import XCTest
@testable import AgentEnglishCore

// Phase 8.5：Free 文本翻译解耦大模型后端的分流测试。
// 覆盖 E2 分流 / F1 gateway 缺位仍可翻 / F2 故障隔离 / E4 自报 tier 不越权。
final class TranslationTieringTests: XCTestCase {

    // E2（v2.13 / ADR-0007 统一）：Free 文本翻译统一走 model-gateway，translation-proxy 不再被调用。
    func testFreeRoutesToModelGatewayOnly() async {
        let proxyTransport = SpyTranslationProxyTransport()
        let gatewayTransport = SpyModelServiceTransport()
        let client = TranslationProviderClient(
            modelServiceClient: ModelServiceClient(transport: gatewayTransport),
            translationProxyClient: TranslationProxyClient(transport: proxyTransport)
        )

        let result = await client.translate(
            translationRequestFixture(),
            preferences: preferencesFixture(tier: .free)
        )

        let proxyCalls = await proxyTransport.callCount
        let gatewayCalls = await gatewayTransport.translateCallCount
        XCTAssertEqual(gatewayCalls, 1)
        XCTAssertEqual(proxyCalls, 0)
        XCTAssertEqual(result.segmentResults.first?.translatedText, "[gateway] Hello world.")
        XCTAssertNil(result.failureReason)
    }

    // E2: Pro 命中 model-gateway translate transport，proxy transport 未被调用。
    func testProRoutesToModelGatewayOnly() async {
        let proxyTransport = SpyTranslationProxyTransport()
        let gatewayTransport = SpyModelServiceTransport()
        let client = TranslationProviderClient(
            modelServiceClient: ModelServiceClient(transport: gatewayTransport),
            translationProxyClient: TranslationProxyClient(transport: proxyTransport)
        )

        let result = await client.translate(
            translationRequestFixture(),
            preferences: preferencesFixture(tier: .pro)
        )

        let proxyCalls = await proxyTransport.callCount
        let gatewayCalls = await gatewayTransport.translateCallCount
        XCTAssertEqual(gatewayCalls, 1)
        XCTAssertEqual(proxyCalls, 0)
        XCTAssertEqual(result.segmentResults.first?.translatedText, "[gateway] Hello world.")
    }

    // E2 (max 分支同样走 model-gateway)。
    func testMaxRoutesToModelGatewayOnly() async {
        let proxyTransport = SpyTranslationProxyTransport()
        let gatewayTransport = SpyModelServiceTransport()
        let client = TranslationProviderClient(
            modelServiceClient: ModelServiceClient(transport: gatewayTransport),
            translationProxyClient: TranslationProxyClient(transport: proxyTransport)
        )

        _ = await client.translate(
            translationRequestFixture(),
            preferences: preferencesFixture(tier: .max)
        )

        let proxyCalls = await proxyTransport.callCount
        let gatewayCalls = await gatewayTransport.translateCallCount
        XCTAssertEqual(gatewayCalls, 1)
        XCTAssertEqual(proxyCalls, 0)
    }

    // 注：原 F1（testFreeTranslatesWhenModelServiceRootMissing）/ F2（testFreeUnaffectedWhenModelGatewayUnavailable）
    // / E4（testProxyRequestCarriesNoClientReportedTier）已删除——它们测的是已退役的「Free 独立于 gateway / 走 proxy /
    // 故障隔离」语义（ADR-0005），v2.13 / ADR-0007 翻译统一入 model-gateway 后这些语义作废。

    // MARK: - Fixtures

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
        let segment = PageTextSegment(
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
            segments: [segment]
        )
    }

    private func preferencesFixture(tier: ModelServiceTier) -> TranslationPreferencesSnapshot {
        TranslationPreferencesSnapshot(
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            serviceTier: tier,
            preferredModelID: tier == .free ? "deepseek-chat" : "openai-gpt-4o",
            preferredModelLabel: tier.displayName,
            quota: ModelCatalogSnapshot.preview(currentTier: tier).quota,
            lastSyncedAt: .now,
            catalog: .preview(currentTier: tier)
        )
    }

    private func emptyBundle() -> Bundle {
        Bundle(for: TranslationTieringTests.self)
    }
}

// MARK: - Spies

private actor SpyTranslationProxyTransport: TranslationProxyTransport {
    private(set) var callCount = 0
    private(set) var lastRequest: TranslationProxyTranslateRequest?

    func translateText(
        _ request: TranslationProxyTranslateRequest
    ) async throws -> TranslationProxyResponse {
        callCount += 1
        lastRequest = request
        return TranslationProxyResponse(
            pageID: request.pageID,
            segmentResults: request.segments.map {
                .init(segmentID: $0.segmentID, translatedText: "[proxy] \($0.sourceText)")
            }
        )
    }
}

private actor SpyModelServiceTransport: ModelServiceTransport {
    private(set) var translateCallCount = 0
    private let translateError: Error?

    init(translateError: Error? = nil) {
        self.translateError = translateError
    }

    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        .preview(currentTier: serviceTier)
    }

    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        translateCallCount += 1
        if let translateError {
            throw translateError
        }
        let catalog = ModelCatalogSnapshot.preview(
            currentTier: request.serviceTier,
            preferredModelID: request.preferredModelID
        )
        let model = catalog.option(id: catalog.defaultModelID) ?? catalog.options[0]
        return ModelServiceTranslateResponse(
            pageID: request.pageID,
            serviceTier: request.serviceTier,
            model: model,
            segmentResults: request.segments.map {
                .init(segmentID: $0.segmentID, translatedText: "[gateway] \($0.sourceText)", errorCode: nil)
            },
            quota: catalog.quota,
            error: nil
        )
    }

    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        let catalog = ModelCatalogSnapshot.preview(
            currentTier: request.serviceTier,
            preferredModelID: request.preferredModelID
        )
        let model = catalog.option(id: catalog.defaultModelID) ?? catalog.options[0]
        return ModelServiceExplainResponse(
            pageID: request.pageID,
            serviceTier: request.serviceTier,
            model: model,
            translation: "",
            explanation: "",
            examples: [],
            quota: catalog.quota,
            error: nil
        )
    }
}
