import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class ReviewSchedulerTests: XCTestCase {
    @MainActor
    func testGeneratesDueCardsAndSchedulesFeedback() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let savedItem = SavedItemRecord(
            sourceUrl: "https://example.com/article",
            sourceTitle: "Example",
            selectedText: "gloss over",
            contextBefore: "They tried to",
            contextAfter: "the policy change.",
            translation: "轻描淡写地带过",
            explanation: "表示故意弱化问题。",
            kind: "phrase",
            createdAt: now.addingTimeInterval(-60)
        )
        modelContext.insert(savedItem)
        try modelContext.save()

        let scheduler = ReviewScheduler(modelContext: modelContext)
        let createdCount = try scheduler.generateMissingCards(now: now)
        let dueCards = try scheduler.dueCards(now: now)

        XCTAssertEqual(createdCount, 1)
        XCTAssertEqual(dueCards.count, 1)
        XCTAssertEqual(dueCards.first?.prompt, "gloss over")
        XCTAssertEqual(dueCards.first?.answer, "轻描淡写地带过")

        let card = try XCTUnwrap(dueCards.first)
        try scheduler.recordFeedback(.fuzzy, for: card, now: now)

        XCTAssertEqual(card.feedbackState, ReviewFeedbackState.fuzzy.rawValue)
        XCTAssertEqual(card.stage, "reviewing")
        XCTAssertEqual(card.lastReviewedAt, now)
        XCTAssertEqual(card.nextDueAt, now.addingTimeInterval(24 * 60 * 60))
        XCTAssertTrue(try scheduler.dueCards(now: now).isEmpty)
    }
}
