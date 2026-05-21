import Foundation
import SwiftData

@MainActor
public final class SavedItemRepository {
    private let modelContext: ModelContext
    private let iso8601Formatter = ISO8601DateFormatter()

    public init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    public static func makeDefault(seedSampleData: Bool = true) throws -> SavedItemRepository {
        let container = try AppModelContainer.makeDefaultContainer(seedSampleData: seedSampleData)
        return SavedItemRepository(modelContext: container.mainContext)
    }

    public func save(_ item: SavedItem) throws -> SavedItemRecord {
        if let existingRecord = try findExistingRecord(for: item) {
            existingRecord.sourceTitle = item.sourceTitle
            existingRecord.translation = item.translation
            existingRecord.explanation = item.explanation
            existingRecord.kind = item.kind.rawValue
            existingRecord.createdAt = parseDate(item.createdAt)
            try modelContext.save()
            return existingRecord
        }

        let record = SavedItemRecord(
            sourceUrl: item.sourceUrl,
            sourceTitle: item.sourceTitle,
            selectedText: item.selectedText,
            contextBefore: item.contextBefore,
            contextAfter: item.contextAfter,
            translation: item.translation,
            explanation: item.explanation,
            kind: item.kind.rawValue,
            createdAt: parseDate(item.createdAt)
        )
        modelContext.insert(record)
        try modelContext.save()
        return record
    }

    public func fetchAll() throws -> [SavedItemRecord] {
        var descriptor = FetchDescriptor<SavedItemRecord>()
        descriptor.sortBy = [SortDescriptor(\SavedItemRecord.createdAt, order: .reverse)]
        return try modelContext.fetch(descriptor)
    }

    public func search(
        text query: String = "",
        kind: SavedItemKind? = nil,
        source: String? = nil
    ) throws -> [SavedItemRecord] {
        try fetchAll().filter { record in
            matches(record: record, query: query, kind: kind, source: source)
        }
    }

    public func contains(
        selectedText: String,
        sourceUrl: String,
        contextBefore: String,
        contextAfter: String
    ) throws -> Bool {
        try fetchAll().contains { record in
            record.selectedText == selectedText &&
            record.sourceUrl == sourceUrl &&
            record.contextBefore == contextBefore &&
            record.contextAfter == contextAfter
        }
    }

    public func delete(savedItemId: UUID) throws {
        guard let record = try fetchAll().first(where: { $0.savedItemId == savedItemId }) else {
            return
        }

        modelContext.delete(record)
        try modelContext.save()
    }

    private func findExistingRecord(for item: SavedItem) throws -> SavedItemRecord? {
        try fetchAll().first { record in
            record.selectedText == item.selectedText &&
            record.sourceUrl == item.sourceUrl &&
            record.contextBefore == item.contextBefore &&
            record.contextAfter == item.contextAfter
        }
    }

    private func matches(
        record: SavedItemRecord,
        query: String,
        kind: SavedItemKind?,
        source: String?
    ) -> Bool {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let matchesQuery = normalizedQuery.isEmpty || [
            record.selectedText,
            record.translation,
            record.explanation,
            record.sourceTitle,
            record.sourceUrl,
            record.contextBefore,
            record.contextAfter,
        ].contains(where: { value in
            value.localizedCaseInsensitiveContains(normalizedQuery)
        })

        let matchesKind = kind == nil || record.kind == kind?.rawValue
        let matchesSource = source.map { filter in
            record.sourceTitle.localizedCaseInsensitiveContains(filter) ||
            record.sourceUrl.localizedCaseInsensitiveContains(filter)
        } ?? true

        return matchesQuery && matchesKind && matchesSource
    }

    private func parseDate(_ createdAt: String) -> Date {
        iso8601Formatter.date(from: createdAt) ?? .now
    }
}
