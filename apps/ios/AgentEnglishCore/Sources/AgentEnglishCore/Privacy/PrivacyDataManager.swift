import Foundation
import SwiftData
import WebKit

@MainActor
public final class PrivacyDataManager {
    private let modelContext: ModelContext
    private let websiteDataStore: WKWebsiteDataStore

    public init(
        modelContext: ModelContext,
        websiteDataStore: WKWebsiteDataStore = .default()
    ) {
        self.modelContext = modelContext
        self.websiteDataStore = websiteDataStore
    }

    public func clearLearningData() throws {
        try deleteAll(ReviewCardRecord.self)
        try deleteAll(SavedItemRecord.self)
        try deleteAll(HistoryEntryRecord.self)
        try deleteAll(DailyStatRecord.self)
        try deleteAll(TranslationCacheRecord.self)
        try modelContext.save()
    }

    public func clearTranslationCache() throws {
        try deleteAll(TranslationCacheRecord.self)
        try modelContext.save()
    }

    public func clearWebsiteData(since date: Date = .distantPast) async {
        await withCheckedContinuation { continuation in
            websiteDataStore.removeData(
                ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
                modifiedSince: date
            ) {
                continuation.resume()
            }
        }
    }

    private func deleteAll<T: PersistentModel>(_ type: T.Type) throws {
        let records = try modelContext.fetch(FetchDescriptor<T>())
        for record in records {
            modelContext.delete(record)
        }
    }
}
