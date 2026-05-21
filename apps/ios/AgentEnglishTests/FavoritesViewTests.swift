import AgentEnglishCore
import Foundation
import XCTest
@testable import AgentEnglish

final class FavoritesViewTests: XCTestCase {
    @MainActor
    func testVisibleItemsSupportSearchKindFilterAndSourceRevisit() {
        let records = [
            SavedItemRecord(
                sourceUrl: "https://example.com/article",
                sourceTitle: "Example Article",
                selectedText: "gloss over",
                contextBefore: "They tried to",
                contextAfter: "the policy change.",
                translation: "轻描淡写地带过",
                explanation: "这里表示故意弱化问题的重要性。",
                kind: "phrase"
            ),
            SavedItemRecord(
                sourceUrl: "https://news.example.com/story",
                sourceTitle: "Daily News",
                selectedText: "serendipity",
                contextBefore: "A rare sense of",
                contextAfter: "helps the character grow.",
                translation: "意外发现美好事物的能力",
                explanation: "这里强调偶然发现带来的正面结果。",
                kind: "word"
            ),
        ]

        let sourceFilters = FavoritesViewModel.sourceFilters(from: records)
        XCTAssertTrue(sourceFilters.contains(where: { $0.value == "example.com" }))
        XCTAssertTrue(sourceFilters.contains(where: { $0.value == "news.example.com" }))

        let visibleItems = FavoritesViewModel.visibleItems(
            from: records,
            searchText: "gloss",
            kindFilter: .phrase,
            sourceFilter: FavoritesSourceFilter(value: "example.com", title: "example.com")
        )

        XCTAssertEqual(visibleItems.count, 1)
        XCTAssertEqual(visibleItems.first?.selectedText, "gloss over")
        XCTAssertTrue(visibleItems.first?.sourceSummary.contains("Example Article") == true)
        XCTAssertEqual(
            visibleItems.first?.revisitURL?.absoluteString,
            "https://example.com/article"
        )
    }

    func testContentStateKeepsFilteredEmptySeparateFromEmptyCollection() {
        XCTAssertEqual(
            FavoritesViewModel.contentState(totalItemCount: 0, visibleItemCount: 0),
            .emptyCollection
        )
        XCTAssertEqual(
            FavoritesViewModel.contentState(totalItemCount: 2, visibleItemCount: 0),
            .emptyResults
        )
        XCTAssertEqual(
            FavoritesViewModel.contentState(totalItemCount: 2, visibleItemCount: 1),
            .results
        )
    }
}
