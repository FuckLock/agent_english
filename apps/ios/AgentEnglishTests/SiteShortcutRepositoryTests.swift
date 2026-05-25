import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class SiteShortcutRepositoryTests: XCTestCase {
    @MainActor
    func testSeedsAddsMovesAndDeletesShortcuts() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let repository = SiteShortcutRepository(modelContext: container.mainContext)

        XCTAssertEqual(try repository.seedDefaultsIfNeeded(), 5)
        XCTAssertEqual(try repository.seedDefaultsIfNeeded(), 0)
        XCTAssertEqual(try repository.fetchAll().map(\.name), [
            "YouTube",
            "Reddit",
            "Wikipedia",
            "AO3",
            "X",
        ])

        let custom = try repository.addOrUpdate(
            name: "News",
            symbol: "newspaper",
            note: "文章",
            url: try XCTUnwrap(URL(string: "https://example.com/news"))
        )
        XCTAssertEqual(custom.orderIndex, 5)

        try repository.move(records: try repository.fetchAll(), from: IndexSet(integer: 5), to: 0)
        XCTAssertEqual(try repository.fetchAll().first?.name, "News")

        try repository.delete(custom)
        XCTAssertEqual(try repository.fetchAll().count, 5)
        XCTAssertEqual(try repository.fetchAll().map(\.orderIndex), [0, 1, 2, 3, 4])
    }
}
