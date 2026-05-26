import Foundation
import XCTest
@testable import AgentEnglishCore

// Phase 8.5：Free 文本翻译解耦大模型后端的分流测试。
// 覆盖 E2 分流 / F1 gateway 缺位仍可翻 / F2 故障隔离 / E4 自报 tier 不越权。
final class TranslationTieringTests: XCTestCase {

    // E2: Free 文本翻译只命中 translation-proxy，model-gateway translate transport 未被调用。
    func testFreeRoutesToTranslationProxyOnly() async {
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
        XCTAssertEqual(proxyCalls, 1)
        XCTAssertEqual(gatewayCalls, 0)
        XCTAssertEqual(result.segmentResults.first?.translatedText, "[proxy] Hello world.")
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

    // F1: MODEL_SERVICE_ROOT 解析为 nil（大模型端点缺位）+ 可用 proxy stub，
    //     Free 翻译仍返回非空译文且 failureReason == nil；且不调用任何 model-gateway transport。
    func testFreeTranslatesWhenModelServiceRootMissing() async {
        XCTAssertNil(
            ModelServiceEndpointConfiguration.resolvedURL(
                environment: [:],
                bundle: emptyBundle()
            ),
            "MODEL_SERVICE_ROOT should resolve to nil in this scenario"
        )

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

        let gatewayCalls = await gatewayTransport.translateCallCount
        XCTAssertEqual(gatewayCalls, 0, "model-gateway transport must not be called for Free")
        XCTAssertNil(result.failureReason)
        for segment in result.segmentResults {
            XCTAssertNotNil(segment.translatedText)
            XCTAssertFalse(segment.translatedText?.isEmpty ?? true)
            XCTAssertNil(segment.failureReason)
        }
    }

    // F2: model-gateway transport 抛 serviceUnavailable、proxy transport 正常，
    //     Free 翻译仍返回成功译文（两条链路故障隔离）。
    func testFreeUnaffectedWhenModelGatewayUnavailable() async {
        let proxyTransport = SpyTranslationProxyTransport()
        let gatewayTransport = SpyModelServiceTransport(
            translateError: ModelServiceTransportError.transport(.serviceUnavailable)
        )
        let client = TranslationProviderClient(
            modelServiceClient: ModelServiceClient(transport: gatewayTransport),
            translationProxyClient: TranslationProxyClient(transport: proxyTransport)
        )

        let result = await client.translate(
            translationRequestFixture(),
            preferences: preferencesFixture(tier: .free)
        )

        XCTAssertNil(result.failureReason)
        XCTAssertEqual(result.segmentResults.first?.translatedText, "[proxy] Hello world.")
    }

    // E4: iOS tier 以后端 session 派生的 entitlement 快照为输入；
    //     proxy 请求体不含客户端 tier 字段，客户端无法自报 tier 改变后端限额归属。
    func testProxyRequestCarriesNoClientReportedTier() async throws {
        let proxyTransport = SpyTranslationProxyTransport()
        let client = TranslationProviderClient(
            modelServiceClient: ModelServiceClient(transport: SpyModelServiceTransport()),
            translationProxyClient: TranslationProxyClient(transport: proxyTransport)
        )

        _ = await client.translate(
            translationRequestFixture(),
            preferences: preferencesFixture(tier: .free)
        )

        let capturedRequest = await proxyTransport.lastRequest
        let encoded = try JSONEncoder().encode(XCTUnwrap(capturedRequest))
        let json = String(decoding: encoded, as: UTF8.self)
        XCTAssertFalse(json.contains("\"tier\""), "proxy request must not carry a client-reported tier")
        XCTAssertFalse(json.contains("serviceTier"), "proxy request must not carry a client-reported serviceTier")
    }

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
            preferredModelID: tier == .free ? "free-translate" : "pro-context",
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
