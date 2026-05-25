import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class StatisticsRepositoryTests: XCTestCase {
    @MainActor
    func testRecordsDailyStatsAndCurrentStreak() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let repository = StatisticsRepository(
            modelContext: container.mainContext,
            calendar: calendar
        )
        let formatter = ISO8601DateFormatter()
        let yesterday = try XCTUnwrap(formatter.date(from: "2026-05-20T12:00:00Z"))
        let today = try XCTUnwrap(formatter.date(from: "2026-05-21T12:00:00Z"))

        try repository.recordSavedItem(at: yesterday)
        try repository.recordTranslatedPage(at: today)
        try repository.recordSavedItem(at: today)
        try repository.recordReviewCompleted(at: today)

        let summary = try repository.summary(for: today)

        XCTAssertEqual(summary.translatedPageCount, 1)
        XCTAssertEqual(summary.savedItemCount, 1)
        XCTAssertEqual(summary.reviewCompletedCount, 1)
        XCTAssertEqual(summary.currentStreakDays, 2)
    }
}
