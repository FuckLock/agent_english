import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class HistoryRepositoryTests: XCTestCase {
    @MainActor
    func testRecordsDeduplicatesAndClearsHistory() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let repository = HistoryRepository(modelContext: container.mainContext)
        let firstVisit = Date(timeIntervalSince1970: 1_800_000_000)
        let secondVisit = firstVisit.addingTimeInterval(120)

        try repository.recordVisit(
            url: try XCTUnwrap(URL(string: "https://example.com/article")),
            title: "First title",
            visitedAt: firstVisit
        )
        try repository.recordVisit(
            url: try XCTUnwrap(URL(string: "https://example.com/article")),
            title: "Updated title",
            visitedAt: secondVisit
        )
        try repository.recordVisit(
            url: try XCTUnwrap(URL(string: "about:blank")),
            title: "Blank",
            visitedAt: secondVisit
        )

        let recentEntries = try repository.fetchRecent()

        XCTAssertEqual(recentEntries.count, 1)
        XCTAssertEqual(recentEntries.first?.title, "Updated title")
        XCTAssertEqual(recentEntries.first?.siteHost, "example.com")
        XCTAssertEqual(recentEntries.first?.visitCount, 2)
        XCTAssertEqual(recentEntries.first?.lastVisitedAt, secondVisit)

        try repository.clearSite(host: "example.com")
        XCTAssertTrue(try repository.fetchRecent().isEmpty)
    }
}
