import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class PrivacyDataManagerTests: XCTestCase {
    @MainActor
    func testClearsTranslationCacheAndLearningData() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        let savedItem = SavedItemRecord(
            sourceUrl: "https://example.com/article",
            sourceTitle: "Example",
            selectedText: "serendipity",
            contextBefore: "A rare sense of",
            contextAfter: "helps the character grow.",
            translation: "意外发现美好事物的能力",
            explanation: "强调偶然发现带来的正面结果。",
            kind: "word"
        )
        let reviewCard = ReviewCardRecord(
            prompt: "serendipity",
            answer: "意外发现美好事物的能力",
            savedItemId: savedItem.savedItemId,
            savedItem: savedItem
        )
        let historyEntry = HistoryEntryRecord(
            url: "https://example.com/article",
            title: "Example",
            siteHost: "example.com"
        )
        let dailyStat = DailyStatRecord(
            dayKey: "2026-05-21",
            translatedPageCount: 1,
            savedItemCount: 1,
            reviewCompletedCount: 1
        )
        let cacheRecord = TranslationCacheRecord(
            pageId: "page-1",
            pageHash: "page-hash",
            segmentId: "seg-1",
            textHash: "text-hash",
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            displayMode: "bilingual",
            capabilitiesKey: "readable-page",
            sourceText: "Hello world.",
            translatedText: "你好，世界。",
            failureReason: nil
        )

        modelContext.insert(savedItem)
        modelContext.insert(reviewCard)
        modelContext.insert(historyEntry)
        modelContext.insert(dailyStat)
        modelContext.insert(cacheRecord)
        try modelContext.save()

        let manager = PrivacyDataManager(modelContext: modelContext)
        try manager.clearTranslationCache()

        XCTAssertTrue(try modelContext.fetch(FetchDescriptor<TranslationCacheRecord>()).isEmpty)
        XCTAssertEqual(try modelContext.fetch(FetchDescriptor<SavedItemRecord>()).count, 1)

        try manager.clearLearningData()

        XCTAssertTrue(try modelContext.fetch(FetchDescriptor<SavedItemRecord>()).isEmpty)
        XCTAssertTrue(try modelContext.fetch(FetchDescriptor<ReviewCardRecord>()).isEmpty)
        XCTAssertTrue(try modelContext.fetch(FetchDescriptor<HistoryEntryRecord>()).isEmpty)
        XCTAssertTrue(try modelContext.fetch(FetchDescriptor<DailyStatRecord>()).isEmpty)
    }
}
