import Foundation
import SwiftData

public struct SiteShortcutTemplate: Equatable, Sendable {
    public let name: String
    public let symbol: String
    public let note: String
    public let url: String

    public init(name: String, symbol: String, note: String, url: String) {
        self.name = name
        self.symbol = symbol
        self.note = note
        self.url = url
    }
}

@MainActor
public final class SiteShortcutRepository {
    public nonisolated static let defaultShortcuts = [
        SiteShortcutTemplate(name: "YouTube", symbol: "play.rectangle.fill", note: "视频与字幕", url: "https://www.youtube.com"),
        SiteShortcutTemplate(name: "Reddit", symbol: "bubble.left.and.bubble.right.fill", note: "真实讨论", url: "https://www.reddit.com/r/EnglishLearning/"),
        SiteShortcutTemplate(name: "Wikipedia", symbol: "book.closed.fill", note: "长文阅读", url: "https://www.wikipedia.org"),
        SiteShortcutTemplate(name: "AO3", symbol: "text.book.closed.fill", note: "同人小说", url: "https://archiveofourown.org"),
        SiteShortcutTemplate(name: "X", symbol: "bolt.horizontal.fill", note: "短内容流", url: "https://x.com"),
    ]

    private let modelContext: ModelContext

    public init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    @discardableResult
    public func seedDefaultsIfNeeded() throws -> Int {
        let existingShortcuts = try fetchAll()
        guard existingShortcuts.isEmpty else {
            return 0
        }

        for (index, shortcut) in Self.defaultShortcuts.enumerated() {
            modelContext.insert(
                SiteShortcutRecord(
                    url: shortcut.url,
                    name: shortcut.name,
                    symbol: shortcut.symbol,
                    note: shortcut.note,
                    orderIndex: index
                )
            )
        }

        try modelContext.save()
        return Self.defaultShortcuts.count
    }

    public func fetchAll() throws -> [SiteShortcutRecord] {
        let records = try modelContext.fetch(FetchDescriptor<SiteShortcutRecord>())
        return records.sorted { $0.orderIndex < $1.orderIndex }
    }

    @discardableResult
    public func addOrUpdate(
        name: String,
        symbol: String,
        note: String,
        url: URL
    ) throws -> SiteShortcutRecord {
        let normalizedURL = normalizedURLString(url)
        let normalizedName = normalized(name, fallback: url.host(percentEncoded: false) ?? url.host ?? normalizedURL)
        let normalizedSymbol = normalized(symbol, fallback: "globe")
        let existingRecords = try fetchAll()

        if let existing = existingRecords.first(where: { $0.url == normalizedURL }) {
            existing.name = normalizedName
            existing.symbol = normalizedSymbol
            existing.note = note.trimmingCharacters(in: .whitespacesAndNewlines)
            existing.isEnabled = true
            existing.updatedAt = .now
            try modelContext.save()
            return existing
        }

        let record = SiteShortcutRecord(
            url: normalizedURL,
            name: normalizedName,
            symbol: normalizedSymbol,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
            orderIndex: existingRecords.count
        )
        modelContext.insert(record)
        try modelContext.save()
        return record
    }

    public func delete(_ record: SiteShortcutRecord) throws {
        modelContext.delete(record)
        try reindexAndSave()
    }

    public func move(
        records: [SiteShortcutRecord],
        from source: IndexSet,
        to destination: Int
    ) throws {
        let reorderedRecords = moved(records, from: source, to: destination)
        for (index, record) in reorderedRecords.enumerated() {
            record.orderIndex = index
            record.updatedAt = .now
        }
        try modelContext.save()
    }

    private func reindexAndSave() throws {
        let records = try fetchAll()
        for (index, record) in records.enumerated() {
            record.orderIndex = index
            record.updatedAt = .now
        }
        try modelContext.save()
    }

    private func moved(
        _ records: [SiteShortcutRecord],
        from source: IndexSet,
        to destination: Int
    ) -> [SiteShortcutRecord] {
        let movingRecords = source.sorted().map { records[$0] }
        var remainingRecords = records
        for index in source.sorted(by: >) {
            remainingRecords.remove(at: index)
        }

        let insertionIndex = min(destination, remainingRecords.count)
        remainingRecords.insert(contentsOf: movingRecords, at: insertionIndex)
        return remainingRecords
    }

    private func normalizedURLString(_ url: URL) -> String {
        url.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func normalized(_ value: String, fallback: String) -> String {
        let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedValue.isEmpty ? fallback : trimmedValue
    }
}
