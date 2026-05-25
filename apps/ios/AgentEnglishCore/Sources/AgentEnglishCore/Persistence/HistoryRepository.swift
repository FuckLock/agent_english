import Foundation
import SwiftData

@MainActor
public final class HistoryRepository {
    private let modelContext: ModelContext

    public init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    public func recordVisit(
        url: URL,
        title: String,
        visitedAt: Date = .now
    ) throws {
        guard let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme) else {
            return
        }

        let normalizedURL = url.absoluteString
        let siteHost = url.host(percentEncoded: false) ?? url.host ?? ""
        let records = try modelContext.fetch(FetchDescriptor<HistoryEntryRecord>())

        if let existing = records.first(where: { $0.url == normalizedURL }) {
            existing.title = title.isEmpty ? existing.title : title
            existing.siteHost = siteHost
            existing.lastVisitedAt = visitedAt
            existing.visitCount += 1
        } else {
            modelContext.insert(
                HistoryEntryRecord(
                    url: normalizedURL,
                    title: title.isEmpty ? normalizedURL : title,
                    siteHost: siteHost,
                    lastVisitedAt: visitedAt
                )
            )
        }

        try modelContext.save()
    }

    public func fetchRecent(limit: Int = 30) throws -> [HistoryEntryRecord] {
        let records = try modelContext.fetch(FetchDescriptor<HistoryEntryRecord>())
            .sorted { $0.lastVisitedAt > $1.lastVisitedAt }
        return Array(records.prefix(max(0, limit)))
    }

    public func clearSite(host: String) throws {
        let normalizedHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedHost.isEmpty else {
            return
        }

        let records = try modelContext.fetch(FetchDescriptor<HistoryEntryRecord>())
        for record in records where record.siteHost == normalizedHost {
            modelContext.delete(record)
        }
        try modelContext.save()
    }

    public func deleteAll() throws {
        let records = try modelContext.fetch(FetchDescriptor<HistoryEntryRecord>())
        for record in records {
            modelContext.delete(record)
        }
        try modelContext.save()
    }
}
