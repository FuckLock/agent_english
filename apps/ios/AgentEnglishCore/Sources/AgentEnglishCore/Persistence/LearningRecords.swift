import Foundation
import SwiftData

@Model
public final class SavedItemRecord {
    @Attribute(.unique) public var savedItemId: UUID
    public var sourceUrl: String
    public var sourceTitle: String
    public var selectedText: String
    public var contextBefore: String
    public var contextAfter: String
    public var translation: String
    public var explanation: String
    public var kind: String
    public var createdAt: Date
    @Relationship(deleteRule: .cascade, inverse: \ReviewCardRecord.savedItem)
    public var reviewCards: [ReviewCardRecord]

    public init(
        savedItemId: UUID = UUID(),
        sourceUrl: String,
        sourceTitle: String,
        selectedText: String,
        contextBefore: String,
        contextAfter: String,
        translation: String,
        explanation: String,
        kind: String,
        createdAt: Date = .now,
        reviewCards: [ReviewCardRecord] = []
    ) {
        self.savedItemId = savedItemId
        self.sourceUrl = sourceUrl
        self.sourceTitle = sourceTitle
        self.selectedText = selectedText
        self.contextBefore = contextBefore
        self.contextAfter = contextAfter
        self.translation = translation
        self.explanation = explanation
        self.kind = kind
        self.createdAt = createdAt
        self.reviewCards = reviewCards
    }
}

@Model
public final class ReviewCardRecord {
    @Attribute(.unique) public var reviewCardId: UUID
    public var prompt: String
    public var answer: String
    public var stage: String
    public var createdAt: Date
    public var savedItemId: UUID
    public var savedItem: SavedItemRecord?

    public init(
        reviewCardId: UUID = UUID(),
        prompt: String,
        answer: String,
        stage: String = "new",
        createdAt: Date = .now,
        savedItemId: UUID,
        savedItem: SavedItemRecord? = nil
    ) {
        self.reviewCardId = reviewCardId
        self.prompt = prompt
        self.answer = answer
        self.stage = stage
        self.createdAt = createdAt
        self.savedItemId = savedItemId
        self.savedItem = savedItem
    }
}

@Model
public final class AppSettingsRecord {
    @Attribute(.unique) public var settingsId: UUID
    public var sourceLanguage: String
    public var targetLanguage: String
    public var preferredProviderName: String
    public var preferredProviderProfileId: UUID?
    public var privacySummary: String
    public var inlineLearningEnabled: Bool

    public init(
        settingsId: UUID = UUID(),
        sourceLanguage: String,
        targetLanguage: String,
        preferredProviderName: String,
        preferredProviderProfileId: UUID? = nil,
        privacySummary: String,
        inlineLearningEnabled: Bool = true
    ) {
        self.settingsId = settingsId
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.preferredProviderName = preferredProviderName
        self.preferredProviderProfileId = preferredProviderProfileId
        self.privacySummary = privacySummary
        self.inlineLearningEnabled = inlineLearningEnabled
    }
}

@Model
public final class ProviderProfileRecord {
    @Attribute(.unique) public var providerProfileId: UUID
    public var providerName: String
    public var displayName: String
    public var credentialReference: String
    public var isEnabled: Bool
    public var capabilitySummary: String
    public var updatedAt: Date

    public init(
        providerProfileId: UUID = UUID(),
        providerName: String,
        displayName: String,
        credentialReference: String,
        isEnabled: Bool,
        capabilitySummary: String,
        updatedAt: Date = .now
    ) {
        self.providerProfileId = providerProfileId
        self.providerName = providerName
        self.displayName = displayName
        self.credentialReference = credentialReference
        self.isEnabled = isEnabled
        self.capabilitySummary = capabilitySummary
        self.updatedAt = updatedAt
    }
}

@Model
public final class TranslationCacheRecord {
    @Attribute(.unique) public var translationCacheId: UUID
    public var pageId: String
    public var pageHash: String
    public var segmentId: String
    public var textHash: String
    public var sourceLanguage: String
    public var targetLanguage: String
    public var displayMode: String
    public var capabilitiesKey: String
    public var sourceText: String
    public var translatedText: String?
    public var failureReason: String?
    public var cachedAt: Date

    public init(
        translationCacheId: UUID = UUID(),
        pageId: String,
        pageHash: String,
        segmentId: String,
        textHash: String,
        sourceLanguage: String,
        targetLanguage: String,
        displayMode: String,
        capabilitiesKey: String,
        sourceText: String,
        translatedText: String?,
        failureReason: String?,
        cachedAt: Date = .now
    ) {
        self.translationCacheId = translationCacheId
        self.pageId = pageId
        self.pageHash = pageHash
        self.segmentId = segmentId
        self.textHash = textHash
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.displayMode = displayMode
        self.capabilitiesKey = capabilitiesKey
        self.sourceText = sourceText
        self.translatedText = translatedText
        self.failureReason = failureReason
        self.cachedAt = cachedAt
    }
}
