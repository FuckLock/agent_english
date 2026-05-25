import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class ModelServiceSettingsStoreTests: XCTestCase {
    @MainActor
    func testReturnsDefaultServiceSnapshotWhenProfileIsMissing() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        modelContext.insert(
            AppSettingsRecord(
                sourceLanguage: "English",
                targetLanguage: "简体中文",
                privacySummary: "Uses model service only."
            )
        )
        try modelContext.save()

        let settingsStore = ModelServiceSettingsStore(modelContext: modelContext)
        let preferences = try settingsStore.loadPreferences()

        XCTAssertEqual(preferences.sourceLanguage, "English")
        XCTAssertEqual(preferences.targetLanguage, "简体中文")
        XCTAssertEqual(preferences.serviceTier, .free)
        XCTAssertEqual(preferences.preferredModelID, "free-translate")
        XCTAssertEqual(preferences.quota.limit, 20)
    }

    @MainActor
    func testLoadsPreferredModelAndTierFromSnapshot() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        modelContext.insert(
            AppSettingsRecord(
                sourceLanguage: "English",
                targetLanguage: "繁體中文",
                privacySummary: "Uses model service only."
            )
        )
        modelContext.insert(
            ModelServiceProfileRecord(
                serviceTier: ModelServiceTier.pro.rawValue,
                preferredModelID: "pro-context",
                preferredModelLabel: "Pro 模型 · 语境精读",
                quotaStatus: ModelQuotaStatus.ok.rawValue,
                quotaUsed: 9,
                quotaLimit: 200
            )
        )
        try modelContext.save()

        let settingsStore = ModelServiceSettingsStore(modelContext: modelContext)
        let preferences = try settingsStore.loadPreferences()

        XCTAssertEqual(preferences.serviceTier, .pro)
        XCTAssertEqual(preferences.preferredModelID, "pro-context")
        XCTAssertEqual(preferences.preferredModelLabel, "Pro 模型 · 语境精读")
        XCTAssertEqual(preferences.quota.used, 9)
    }

    @MainActor
    func testUpdatesLanguagesAndModelPreferenceWithinEntitledTier() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        modelContext.insert(
            ModelServiceProfileRecord(
                serviceTier: ModelServiceTier.pro.rawValue,
                preferredModelID: "pro-context",
                preferredModelLabel: "Pro 模型 · 语境精读",
                quotaStatus: ModelQuotaStatus.ok.rawValue,
                quotaUsed: 0,
                quotaLimit: 200
            )
        )
        try modelContext.save()

        let settingsStore = ModelServiceSettingsStore(modelContext: modelContext)

        try settingsStore.updateLanguages(sourceLanguage: "English", targetLanguage: "繁體中文")
        try settingsStore.updatePreferredModel("pro-context")

        let preferences = try settingsStore.loadPreferences()

        XCTAssertEqual(preferences.targetLanguage, "繁體中文")
        XCTAssertEqual(preferences.serviceTier, .pro)
        XCTAssertEqual(preferences.preferredModelID, "pro-context")
        XCTAssertEqual(preferences.catalog.option(id: "pro-context")?.availability, .available)
    }

    @MainActor
    func testRefreshCatalogUsesRemoteSnapshotWhenServiceIsReachable() async throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        modelContext.insert(
            AppSettingsRecord(
                sourceLanguage: "English",
                targetLanguage: "简体中文",
                privacySummary: "Uses model service only."
            )
        )
        try modelContext.save()

        let remoteCatalog = ModelCatalogSnapshot(
            currentTier: .pro,
            availableTiers: [.free, .pro, .max],
            defaultModelID: "pro-context",
            options: [
                ModelCatalogOption(
                    id: "pro-context",
                    tier: .pro,
                    displayName: "Pro 模型 · 语境精读",
                    summary: "适合整段语境解释。",
                    capabilities: ["translation", "explanation"],
                    availability: .available,
                    requiredTier: nil,
                    quota: ModelQuotaSnapshot(
                        status: .ok,
                        used: 12,
                        limit: 200,
                        remaining: 188,
                        resetAt: "2026-05-22T00:00:00Z"
                    )
                )
            ],
            quota: ModelQuotaSnapshot(
                status: .ok,
                used: 12,
                limit: 200,
                remaining: 188,
                resetAt: "2026-05-22T00:00:00Z"
            ),
            lastUpdatedAt: "2026-05-22T00:00:00Z"
        )
        let settingsStore = ModelServiceSettingsStore(
            modelContext: modelContext,
            modelServiceClient: ModelServiceClient(
                transport: CatalogOnlyTransport(catalog: remoteCatalog)
            )
        )

        let preferences = try await settingsStore.refreshCatalog()

        XCTAssertEqual(preferences.serviceTier, .pro)
        XCTAssertEqual(preferences.preferredModelID, "pro-context")
        XCTAssertEqual(preferences.quota.limit, 200)
        XCTAssertEqual(preferences.catalog.defaultModelID, "pro-context")
    }

    @MainActor
    func testRefreshCatalogFailureDoesNotOverwriteLastSyncedAt() async throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        let lastSyncedAt = Date(timeIntervalSince1970: 1_716_331_200)
        modelContext.insert(
            AppSettingsRecord(
                sourceLanguage: "English",
                targetLanguage: "简体中文",
                privacySummary: "Uses model service only."
            )
        )
        modelContext.insert(
            ModelServiceProfileRecord(
                serviceTier: ModelServiceTier.free.rawValue,
                preferredModelID: "free-translate",
                preferredModelLabel: "Free 服务 · 轻量翻译",
                quotaStatus: ModelQuotaStatus.ok.rawValue,
                quotaUsed: 3,
                quotaLimit: 20,
                lastSyncedAt: lastSyncedAt
            )
        )
        try modelContext.save()

        let settingsStore = ModelServiceSettingsStore(
            modelContext: modelContext,
            modelServiceClient: ModelServiceClient(
                transport: FailingCatalogTransport()
            )
        )

        do {
            _ = try await settingsStore.refreshCatalog()
            XCTFail("Expected refreshCatalog to throw.")
        } catch {
            XCTAssertTrue(true)
        }

        let profile = try modelContext.fetch(FetchDescriptor<ModelServiceProfileRecord>()).first
        XCTAssertEqual(profile?.lastSyncedAt, lastSyncedAt)
        XCTAssertEqual(profile?.serviceTier, ModelServiceTier.free.rawValue)
    }
}

private struct CatalogOnlyTransport: ModelServiceTransport {
    let catalog: ModelCatalogSnapshot

    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        _ = serviceTier
        return catalog
    }

    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }

    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }
}

private struct FailingCatalogTransport: ModelServiceTransport {
    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        _ = serviceTier
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }

    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }

    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }
}
