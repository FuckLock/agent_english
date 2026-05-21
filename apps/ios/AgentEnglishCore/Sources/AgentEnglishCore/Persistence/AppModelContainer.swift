import Foundation
import SwiftData

@MainActor
public enum AppModelContainer {
    public static let schema = Schema([
        SavedItemRecord.self,
        ReviewCardRecord.self,
        AppSettingsRecord.self,
        ProviderProfileRecord.self,
        TranslationCacheRecord.self,
    ])

    public static func makeDefaultContainer(seedSampleData: Bool = true) throws -> ModelContainer {
        try makeContainer(seedSampleData: seedSampleData)
    }

    public static func makeInMemoryContainer(seedSampleData: Bool = true) throws -> ModelContainer {
        try makeContainer(inMemory: true, seedSampleData: seedSampleData)
    }

    public static func makeContainer(
        inMemory: Bool = false,
        storeURL: URL? = nil,
        seedSampleData: Bool = true
    ) throws -> ModelContainer {
        let configuration: ModelConfiguration
        if let storeURL {
            configuration = ModelConfiguration(schema: schema, url: storeURL)
        } else {
            configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: inMemory)
        }

        let container = try ModelContainer(for: schema, configurations: configuration)
        if seedSampleData {
            try SampleLearningData.seedIfNeeded(in: container.mainContext)
        }
        return container
    }
}
