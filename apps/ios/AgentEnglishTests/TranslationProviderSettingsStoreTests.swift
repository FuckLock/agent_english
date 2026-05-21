import AgentEnglishCore
import Foundation
import SwiftData
import XCTest

final class TranslationProviderSettingsStoreTests: XCTestCase {
    @MainActor
    func testReturnsNilCredentialReferenceWhenProviderProfileIsMissing() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        modelContext.insert(
            AppSettingsRecord(
                sourceLanguage: "English",
                targetLanguage: "简体中文",
                preferredProviderName: "Unset",
                preferredProviderProfileId: nil,
                privacySummary: "Provider not configured."
            )
        )
        try modelContext.save()

        let settingsStore = TranslationProviderSettingsStore(modelContext: modelContext)
        let preferences = try settingsStore.loadPreferences()

        XCTAssertEqual(preferences.sourceLanguage, "English")
        XCTAssertEqual(preferences.targetLanguage, "简体中文")
        XCTAssertNil(preferences.credentialReference)
    }

    @MainActor
    func testReturnsNilCredentialReferenceForDefaultSeededContainer() throws {
        let storeURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        defer {
            removeStoreArtifacts(at: storeURL)
        }

        let container = try AppModelContainer.makeContainer(
            storeURL: storeURL,
            seedSampleData: true
        )
        let settingsStore = TranslationProviderSettingsStore(modelContext: container.mainContext)
        let preferences = try settingsStore.loadPreferences()

        XCTAssertEqual(preferences.sourceLanguage, "English")
        XCTAssertEqual(preferences.targetLanguage, "简体中文")
        XCTAssertNil(preferences.credentialReference)
    }

    @MainActor
    func testLoadsCredentialReferenceFromPreferredProviderProfile() throws {
        let container = try AppModelContainer.makeInMemoryContainer(seedSampleData: false)
        let modelContext = container.mainContext
        let providerProfileId = UUID()

        modelContext.insert(
            ProviderProfileRecord(
                providerProfileId: providerProfileId,
                providerName: "Custom AI Provider",
                displayName: "Preview Translator",
                credentialReference: KeychainCredentialStore.credentialReference(for: providerProfileId),
                isEnabled: true,
                capabilitySummary: "Inline translation"
            )
        )
        modelContext.insert(
            AppSettingsRecord(
                sourceLanguage: "English",
                targetLanguage: "简体中文",
                preferredProviderName: "Preview Translator",
                preferredProviderProfileId: providerProfileId,
                privacySummary: "Uses Keychain reference only."
            )
        )
        try modelContext.save()

        let expectedCredentialReference = KeychainCredentialStore.credentialReference(for: providerProfileId)
        let settingsStore = TranslationProviderSettingsStore(
            modelContext: modelContext,
            credentialLookup: { credentialReference in
                credentialReference == expectedCredentialReference
            }
        )
        let preferences = try settingsStore.loadPreferences()

        XCTAssertEqual(preferences.credentialReference, expectedCredentialReference)
    }

    private func removeStoreArtifacts(at storeURL: URL) {
        let fileManager = FileManager.default
        let siblingURLs = [
            storeURL,
            storeURL.appendingPathExtension("-shm"),
            storeURL.appendingPathExtension("-wal"),
        ]

        for url in siblingURLs where fileManager.fileExists(atPath: url.path()) {
            try? fileManager.removeItem(at: url)
        }
    }
}
