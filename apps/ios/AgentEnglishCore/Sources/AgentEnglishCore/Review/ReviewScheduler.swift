import Foundation
import SwiftData

public enum ReviewFeedbackState: String, CaseIterable, Sendable {
    case remembered
    case fuzzy
    case forgotten
}

@MainActor
public final class ReviewScheduler {
    private let modelContext: ModelContext

    public init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    @discardableResult
    public func generateMissingCards(now: Date = .now) throws -> Int {
        let savedItems = try modelContext.fetch(FetchDescriptor<SavedItemRecord>())
        let reviewCards = try modelContext.fetch(FetchDescriptor<ReviewCardRecord>())
        let cardItemIds = Set(reviewCards.map(\.savedItemId))
        var createdCount = 0

        for savedItem in savedItems where !cardItemIds.contains(savedItem.savedItemId) {
            modelContext.insert(
                ReviewCardRecord(
                    prompt: savedItem.selectedText,
                    answer: savedItem.translation,
                    stage: "new",
                    createdAt: now,
                    nextDueAt: savedItem.createdAt,
                    savedItemId: savedItem.savedItemId,
                    savedItem: savedItem
                )
            )
            createdCount += 1
        }

        if createdCount > 0 {
            try modelContext.save()
        }

        return createdCount
    }

    public func dueCards(now: Date = .now) throws -> [ReviewCardRecord] {
        let cards = try modelContext.fetch(FetchDescriptor<ReviewCardRecord>())
        return cards
            .filter { $0.nextDueAt <= now }
            .sorted {
                if $0.nextDueAt == $1.nextDueAt {
                    return $0.createdAt < $1.createdAt
                }
                return $0.nextDueAt < $1.nextDueAt
            }
    }

    public func recordFeedback(
        _ feedbackState: ReviewFeedbackState,
        for card: ReviewCardRecord,
        now: Date = .now
    ) throws {
        card.feedbackState = feedbackState.rawValue
        card.lastReviewedAt = now
        card.stage = "reviewing"
        card.nextDueAt = nextDueDate(after: now, feedbackState: feedbackState)
        try modelContext.save()
    }

    private func nextDueDate(
        after date: Date,
        feedbackState: ReviewFeedbackState
    ) -> Date {
        switch feedbackState {
        case .remembered:
            return date.addingTimeInterval(3 * 24 * 60 * 60)
        case .fuzzy:
            return date.addingTimeInterval(24 * 60 * 60)
        case .forgotten:
            return date.addingTimeInterval(10 * 60)
        }
    }
}
