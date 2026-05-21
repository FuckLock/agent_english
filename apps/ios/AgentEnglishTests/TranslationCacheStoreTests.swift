import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class TranslationCacheStoreTests: XCTestCase {
    @MainActor
    func testStoresAndLoadsCachedTranslationResultByPageHashAndTextHash() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let cacheStore = TranslationCacheStore(modelContext: container.mainContext)
        let translationRequest = translationRequestFixture()
        let translationResult = TranslationResult(
            pageId: "page-1",
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            displayMode: .bilingual,
            capabilities: [.readablePage, .inlineTranslation, .selectionFallback],
            segmentResults: [
                TranslationSegmentResult(
                    segmentId: "seg-1",
                    translatedText: "你好，世界。",
                    failureReason: nil
                )
            ],
            resultsBySegmentId: [
                "seg-1": TranslationSegmentResult(
                    segmentId: "seg-1",
                    translatedText: "你好，世界。",
                    failureReason: nil
                )
            ],
            failureReason: nil
        )

        try cacheStore.store(translationResult, for: translationRequest)
        let cachedTranslationResult = try cacheStore.cachedResult(for: translationRequest)

        XCTAssertEqual(cachedTranslationResult?.pageId, "page-1")
        XCTAssertEqual(cachedTranslationResult?.resultsBySegmentId["seg-1"]?.translatedText, "你好，世界。")
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
