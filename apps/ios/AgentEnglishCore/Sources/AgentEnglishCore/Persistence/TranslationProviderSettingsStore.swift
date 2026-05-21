import Foundation
import SwiftData

public struct TranslationPreferencesSnapshot: Equatable, Sendable {
    public let sourceLanguage: String
    public let targetLanguage: String
    public let credentialReference: String?

    public init(
        sourceLanguage: String,
        targetLanguage: String,
        credentialReference: String?
    ) {
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.credentialReference = credentialReference
    }
}

@MainActor
public final class TranslationProviderSettingsStore {
    private let modelContext: ModelContext
    private let credentialLookup: @Sendable (String) -> Bool

    public init(
        modelContext: ModelContext,
        credentialLookup: @escaping @Sendable (String) -> Bool = { credentialReference in
            KeychainCredentialStore.hasStoredCredential(for: credentialReference)
        }
    ) {
        self.modelContext = modelContext
        self.credentialLookup = credentialLookup
    }

    public static func makeDefault(seedSampleData: Bool = true) throws -> TranslationProviderSettingsStore {
        let container = try AppModelContainer.makeDefaultContainer(seedSampleData: seedSampleData)
        return TranslationProviderSettingsStore(modelContext: container.mainContext)
    }

    public func loadPreferences() throws -> TranslationPreferencesSnapshot {
        let settingsRecords = try modelContext.fetch(FetchDescriptor<AppSettingsRecord>())
        guard let settingsRecord = settingsRecords.first else {
            return TranslationPreferencesSnapshot(
                sourceLanguage: "English",
                targetLanguage: "简体中文",
                credentialReference: nil
            )
        }

        let credentialReference = try resolveCredentialReference(
            preferredProviderProfileId: settingsRecord.preferredProviderProfileId
        )

        return TranslationPreferencesSnapshot(
            sourceLanguage: settingsRecord.sourceLanguage,
            targetLanguage: settingsRecord.targetLanguage,
            credentialReference: credentialReference
        )
    }

    private func resolveCredentialReference(
        preferredProviderProfileId: UUID?
    ) throws -> String? {
        guard let preferredProviderProfileId else {
            return nil
        }

        let providerProfiles = try modelContext.fetch(FetchDescriptor<ProviderProfileRecord>())
        guard let providerProfile = providerProfiles.first(where: { profile in
            profile.providerProfileId == preferredProviderProfileId && profile.isEnabled
        }) else {
            return nil
        }

        let credentialReference = providerProfile.credentialReference
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !credentialReference.isEmpty, credentialLookup(credentialReference) else {
            return nil
        }

        return credentialReference
    }
}
