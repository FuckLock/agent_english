import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class SavedItemRepositoryTests: XCTestCase {
    @MainActor
    func testSaveSearchFilterAndDeleteSavedItems() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let repository = SavedItemRepository(modelContext: ModelContext(container))

        let firstSavedItem = SavedItem(
            sourceUrl: "https://example.com/article",
            sourceTitle: "Example Article",
            selectedText: "gloss over",
            contextBefore: "They tried to",
            contextAfter: "the policy change.",
            translation: "轻描淡写地带过",
            explanation: "这里表示故意弱化问题的重要性。",
            kind: .phrase,
            createdAt: "2026-05-21T00:00:00.000Z"
        )
        let secondSavedItem = SavedItem(
            sourceUrl: "https://news.example.com/story",
            sourceTitle: "Daily News",
            selectedText: "serendipity",
            contextBefore: "A rare sense of",
            contextAfter: "helps the character grow.",
            translation: "意外发现美好事物的能力",
            explanation: "这里强调偶然发现带来的正面结果。",
            kind: .word,
            createdAt: "2026-05-21T01:00:00.000Z"
        )

        let savedRecord = try repository.save(firstSavedItem)
        _ = try repository.save(secondSavedItem)

        XCTAssertEqual(try repository.fetchAll().count, 2)
        XCTAssertEqual(try repository.search(text: "gloss").count, 1)
        XCTAssertEqual(try repository.search(text: "", kind: .phrase).count, 1)
        XCTAssertEqual(try repository.search(text: "", source: "news.example.com").count, 1)
        XCTAssertTrue(
            try repository.contains(
                selectedText: "gloss over",
                sourceUrl: "https://example.com/article",
                contextBefore: "They tried to",
                contextAfter: "the policy change."
            )
        )

        try repository.delete(savedItemId: savedRecord.savedItemId)

        let remainingItems = try repository.fetchAll()
        XCTAssertEqual(remainingItems.count, 1)
        XCTAssertEqual(remainingItems.first?.selectedText, "serendipity")
    }
}
