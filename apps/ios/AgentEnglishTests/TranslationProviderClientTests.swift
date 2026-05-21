import Foundation
import XCTest
@testable import AgentEnglishCore

final class TranslationProviderClientTests: XCTestCase {
    func testRetriesFailedBatchBeforeReturningTranslationResult() async {
        let transport = FlakyTransport()
        let client = TranslationProviderClient(
            transport: transport,
            configuration: TranslationProviderClientConfiguration(
                maxSegmentsPerBatch: 1,
                maxRetryAttempts: 1
            )
        )

        let translationResult = await client.translate(
            translationRequestFixture(),
            credentialReference: "keychain.provider.preview"
        )
        let attemptCount = await transport.attemptCount()

        XCTAssertEqual(attemptCount, 2)
        XCTAssertEqual(translationResult.segmentResults.first?.translatedText, "[ZH] Hello world.")
        XCTAssertNil(translationResult.failureReason)
    }

    func testReturnsProviderNotConfiguredFailureWithoutCredentialReference() async {
        let client = TranslationProviderClient()
        let translationResult = await client.translate(
            translationRequestFixture(),
            credentialReference: nil
        )

        XCTAssertEqual(translationResult.failureReason, .providerNotConfigured)
        XCTAssertEqual(translationResult.segmentResults.first?.failureReason, .providerNotConfigured)
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
}

private actor FlakyTransport: TranslationProviderTransport {
    private var attempts = 0

    func translateBatch(
        request: TranslationRequest,
        segments: [PageTextSegment],
        credentialReference: String
    ) async throws -> [TranslationSegmentResult] {
        _ = request
        _ = credentialReference
        attempts += 1

        if attempts == 1 {
            throw NSError(domain: "FlakyTransport", code: 1)
        }

        return segments.map { segment in
            TranslationSegmentResult(
                segmentId: segment.segmentId,
                translatedText: "[ZH] \(segment.sourceText)",
                failureReason: nil
            )
        }
    }

    func attemptCount() -> Int {
        attempts
    }
}
