import Foundation
import SwiftData

public struct TranslationPreferencesSnapshot: Equatable, Sendable {
    public let sourceLanguage: String
    public let targetLanguage: String
    public let serviceTier: ModelServiceTier
    public let preferredModelID: String
    public let preferredModelLabel: String
    public let quota: ModelQuotaSnapshot
    public let lastSyncedAt: Date
    public let catalog: ModelCatalogSnapshot

    public init(
        sourceLanguage: String,
        targetLanguage: String,
        serviceTier: ModelServiceTier = .free,
        preferredModelID: String = "deepseek-chat",
        preferredModelLabel: String = "Free 服务 · deepseek-chat",
        quota: ModelQuotaSnapshot = ModelCatalogSnapshot.preview(currentTier: .free).quota,
        lastSyncedAt: Date = .now,
        catalog: ModelCatalogSnapshot = ModelCatalogSnapshot.preview(currentTier: .free)
    ) {
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.serviceTier = serviceTier
        self.preferredModelID = preferredModelID
        self.preferredModelLabel = preferredModelLabel
        self.quota = quota
        self.lastSyncedAt = lastSyncedAt
        self.catalog = catalog
    }
}

@MainActor
public final class ModelServiceSettingsStore {
    private let modelContext: ModelContext
    private let modelServiceClient: ModelServiceClient

    public init(
        modelContext: ModelContext,
        modelServiceClient: ModelServiceClient = ModelServiceClient()
    ) {
        self.modelContext = modelContext
        self.modelServiceClient = modelServiceClient
    }

    public static func makeDefault(seedSampleData: Bool = true) throws -> ModelServiceSettingsStore {
        let container = try AppModelContainer.makeDefaultContainer(seedSampleData: seedSampleData)
        return ModelServiceSettingsStore(modelContext: container.mainContext)
    }

    public func loadPreferences() throws -> TranslationPreferencesSnapshot {
        let settingsRecord = try editableSettingsRecord()
        let profile = try editableModelServiceProfile()
        return makeSnapshot(
            sourceLanguage: settingsRecord.sourceLanguage,
            targetLanguage: settingsRecord.targetLanguage,
            profile: profile
        )
    }

    public func updateLanguages(sourceLanguage: String, targetLanguage: String) throws {
        let settingsRecord = try editableSettingsRecord()
        settingsRecord.sourceLanguage = normalizedLanguage(sourceLanguage, fallback: "English")
        settingsRecord.targetLanguage = normalizedLanguage(targetLanguage, fallback: "简体中文")
        try modelContext.save()
    }

    public func updatePreferredModel(_ modelID: String) throws {
        let profile = try editableModelServiceProfile()
        let tier = ModelServiceTier(rawValue: profile.serviceTier) ?? .free
        let catalog = ModelCatalogSnapshot.preview(
            currentTier: tier,
            preferredModelID: modelID,
            used: profile.quotaUsed,
            syncedAt: .now
        )
        guard
            let option = catalog.option(id: modelID),
            option.availability == .available
        else {
            return
        }
        profile.preferredModelID = option.id
        profile.preferredModelLabel = option.displayName
        profile.lastSyncedAt = .now
        try modelContext.save()
    }

    public func updateQuota(_ quota: ModelQuotaSnapshot) throws {
        let profile = try editableModelServiceProfile()
        applyQuota(quota, to: profile)
        profile.lastSyncedAt = .now
        try modelContext.save()
    }

    public func refreshCatalog() async throws -> TranslationPreferencesSnapshot {
        let settingsRecord = try editableSettingsRecord()
        let profile = try editableModelServiceProfile()
        let requestedTier = ModelServiceTier(rawValue: profile.serviceTier) ?? .free
        let remoteCatalog = try await modelServiceClient.catalog(for: requestedTier)
        let selectedOption: ModelCatalogOption
        if
            let preferredOption = remoteCatalog.option(id: profile.preferredModelID),
            preferredOption.availability == .available
        {
            selectedOption = preferredOption
        } else {
            selectedOption = remoteCatalog.option(id: remoteCatalog.defaultModelID)
                ?? remoteCatalog.options[0]
        }

        profile.serviceTier = remoteCatalog.currentTier.rawValue
        profile.preferredModelID = selectedOption.id
        profile.preferredModelLabel = selectedOption.displayName
        applyQuota(remoteCatalog.quota, to: profile)
        profile.lastSyncedAt = iso8601Date(from: remoteCatalog.lastUpdatedAt) ?? .now
        try modelContext.save()

        return TranslationPreferencesSnapshot(
            sourceLanguage: settingsRecord.sourceLanguage,
            targetLanguage: settingsRecord.targetLanguage,
            serviceTier: remoteCatalog.currentTier,
            preferredModelID: selectedOption.id,
            preferredModelLabel: selectedOption.displayName,
            quota: remoteCatalog.quota,
            lastSyncedAt: profile.lastSyncedAt,
            catalog: remoteCatalog
        )
    }

    private func editableSettingsRecord() throws -> AppSettingsRecord {
        let records = try modelContext.fetch(FetchDescriptor<AppSettingsRecord>())
        if let record = records.first {
            return record
        }

        let record = AppSettingsRecord(
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            privacySummary: "学习收藏、历史和复习数据保存在本机；翻译或解释时才会把页面文本发送到自有后端模型服务。"
        )
        modelContext.insert(record)
        return record
    }

    private func editableModelServiceProfile() throws -> ModelServiceProfileRecord {
        let profiles = try modelContext.fetch(FetchDescriptor<ModelServiceProfileRecord>())
        if let profile = profiles.first {
            return profile
        }

        let profile = ModelServiceProfileRecord(
            serviceTier: ModelServiceTier.free.rawValue,
            preferredModelID: "deepseek-chat",
            preferredModelLabel: "Free 服务 · deepseek-chat",
            quotaStatus: ModelQuotaStatus.ok.rawValue,
            quotaUsed: 3,
            quotaLimit: 20
        )
        modelContext.insert(profile)
        return profile
    }

    private func makeSnapshot(
        sourceLanguage: String,
        targetLanguage: String,
        profile: ModelServiceProfileRecord
    ) -> TranslationPreferencesSnapshot {
        let serviceTier = ModelServiceTier(rawValue: profile.serviceTier) ?? .free
        let catalog = ModelCatalogSnapshot.preview(
            currentTier: serviceTier,
            preferredModelID: profile.preferredModelID,
            used: profile.quotaUsed,
            syncedAt: profile.lastSyncedAt
        )
        let selectedOption = catalog.option(id: profile.preferredModelID)
            ?? catalog.option(id: catalog.defaultModelID)
            ?? catalog.options[0]
        let quota = ModelQuotaSnapshot(
            status: ModelQuotaStatus(rawValue: profile.quotaStatus) ?? catalog.quota.status,
            used: profile.quotaUsed,
            limit: profile.quotaLimit,
            remaining: max(0, profile.quotaLimit - profile.quotaUsed),
            resetAt: catalog.quota.resetAt
        )

        return TranslationPreferencesSnapshot(
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            serviceTier: serviceTier,
            preferredModelID: selectedOption.id,
            preferredModelLabel: selectedOption.displayName,
            quota: quota,
            lastSyncedAt: profile.lastSyncedAt,
            catalog: catalog
        )
    }

    private func applyQuota(_ quota: ModelQuotaSnapshot, to profile: ModelServiceProfileRecord) {
        profile.quotaStatus = quota.status.rawValue
        profile.quotaUsed = quota.used
        profile.quotaLimit = quota.limit
    }

    private func normalizedLanguage(_ value: String, fallback: String) -> String {
        let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedValue.isEmpty ? fallback : trimmedValue
    }

    private func iso8601Date(from value: String) -> Date? {
        ISO8601DateFormatter().date(from: value)
    }
}
