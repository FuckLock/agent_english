import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class LocalLearningLoopTests: XCTestCase {
    @MainActor
    func testSavedItemAndReviewCardPersistAcrossContainerReload() throws {
        let storeURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        defer {
            removeStoreArtifacts(at: storeURL)
        }

        let savedItemId = UUID()
        try createSavedItemAndReviewCard(at: storeURL, savedItemId: savedItemId)

        let secondContainer = try AppModelContainer.makeContainer(
            storeURL: storeURL,
            seedSampleData: false
        )
        let reloadedContext = ModelContext(secondContainer)

        let reloadedItems = try reloadedContext.fetch(FetchDescriptor<SavedItemRecord>())
        let reloadedCards = try reloadedContext.fetch(FetchDescriptor<ReviewCardRecord>())

        XCTAssertEqual(reloadedItems.count, 1)
        XCTAssertEqual(reloadedCards.count, 1)
        XCTAssertEqual(reloadedCards.first?.savedItemId, savedItemId)
        XCTAssertEqual(reloadedCards.first?.savedItem?.savedItemId, savedItemId)
        XCTAssertEqual(reloadedCards.first?.savedItem?.selectedText, "gloss over")
    }

    @MainActor
    private func createSavedItemAndReviewCard(at storeURL: URL, savedItemId: UUID) throws {
        let firstContainer = try AppModelContainer.makeContainer(
            storeURL: storeURL,
            seedSampleData: false
        )
        let firstContext = ModelContext(firstContainer)

        let savedItem = SavedItemRecord(
            savedItemId: savedItemId,
            sourceUrl: "https://www.youtube.com/watch?v=sample",
            sourceTitle: "YouTube",
            selectedText: "gloss over",
            contextBefore: "They tried to",
            contextAfter: "the policy change on camera.",
            translation: "轻描淡写地带过",
            explanation: "这里表示故意弱化问题的重要性。",
            kind: "phrase"
        )
        let reviewCard = ReviewCardRecord(
            prompt: "gloss over",
            answer: "轻描淡写地带过",
            savedItemId: savedItem.savedItemId,
            savedItem: savedItem
        )

        firstContext.insert(savedItem)
        firstContext.insert(reviewCard)
        try firstContext.save()
    }

    private func removeStoreArtifacts(at storeURL: URL) {
        let fileManager = FileManager.default
        let siblingURLs = [
            storeURL,
            storeURL.appendingPathExtension("-shm"),
            storeURL.appendingPathExtension("-wal"),
        ]

        for url in siblingURLs where fileManager.fileExists(atPath: url.path()) {
            try? fileManager.removeItem(at: url)
        }
    }
}
