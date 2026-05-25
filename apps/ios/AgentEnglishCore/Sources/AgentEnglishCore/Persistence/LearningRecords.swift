import Foundation
import SwiftData

@Model
public final class SavedItemRecord {
    @Attribute(.unique) public var savedItemId: UUID
    @Attribute(originalName: "sourceURL")
    public var sourceUrl: String
    public var sourceTitle: String
    @Attribute(originalName: "text")
    public var selectedText: String
    public var contextBefore: String = ""
    public var contextAfter: String = ""
    public var translation: String
    public var explanation: String = ""
    public var kind: String
    @Attribute(originalName: "savedAt")
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
    public var lastReviewedAt: Date?
    public var nextDueAt: Date = Date.distantPast
    public var feedbackState: String?
    public var savedItemId: UUID
    public var savedItem: SavedItemRecord?

    public init(
        reviewCardId: UUID = UUID(),
        prompt: String,
        answer: String,
        stage: String = "new",
        createdAt: Date = .now,
        lastReviewedAt: Date? = nil,
        nextDueAt: Date = .now,
        feedbackState: String? = nil,
        savedItemId: UUID,
        savedItem: SavedItemRecord? = nil
    ) {
        self.reviewCardId = reviewCardId
        self.prompt = prompt
        self.answer = answer
        self.stage = stage
        self.createdAt = createdAt
        self.lastReviewedAt = lastReviewedAt
        self.nextDueAt = nextDueAt
        self.feedbackState = feedbackState
        self.savedItemId = savedItemId
        self.savedItem = savedItem
    }
}

@Model
public final class AppSettingsRecord {
    @Attribute(.unique) public var settingsId: UUID
    public var sourceLanguage: String
    public var targetLanguage: String
    public var privacySummary: String
    public var inlineLearningEnabled: Bool

    public init(
        settingsId: UUID = UUID(),
        sourceLanguage: String,
        targetLanguage: String,
        privacySummary: String,
        inlineLearningEnabled: Bool = true
    ) {
        self.settingsId = settingsId
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.privacySummary = privacySummary
        self.inlineLearningEnabled = inlineLearningEnabled
    }
}

@Model
public final class ModelServiceProfileRecord {
    @Attribute(.unique) public var profileId: UUID
    public var serviceTier: String
    public var preferredModelID: String
    public var preferredModelLabel: String
    public var quotaStatus: String
    public var quotaUsed: Int
    public var quotaLimit: Int
    public var lastSyncedAt: Date

    public init(
        profileId: UUID = UUID(),
        serviceTier: String,
        preferredModelID: String,
        preferredModelLabel: String,
        quotaStatus: String,
        quotaUsed: Int,
        quotaLimit: Int,
        lastSyncedAt: Date = .now
    ) {
        self.profileId = profileId
        self.serviceTier = serviceTier
        self.preferredModelID = preferredModelID
        self.preferredModelLabel = preferredModelLabel
        self.quotaStatus = quotaStatus
        self.quotaUsed = quotaUsed
        self.quotaLimit = quotaLimit
        self.lastSyncedAt = lastSyncedAt
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

@Model
public final class HistoryEntryRecord {
    @Attribute(.unique) public var historyEntryId: UUID
    @Attribute(.unique) public var url: String
    public var title: String
    public var siteHost: String
    public var lastVisitedAt: Date
    public var visitCount: Int

    public init(
        historyEntryId: UUID = UUID(),
        url: String,
        title: String,
        siteHost: String,
        lastVisitedAt: Date = .now,
        visitCount: Int = 1
    ) {
        self.historyEntryId = historyEntryId
        self.url = url
        self.title = title
        self.siteHost = siteHost
        self.lastVisitedAt = lastVisitedAt
        self.visitCount = visitCount
    }
}

@Model
public final class DailyStatRecord {
    @Attribute(.unique) public var dayKey: String
    public var translatedPageCount: Int
    public var savedItemCount: Int
    public var reviewCompletedCount: Int
    public var updatedAt: Date

    public init(
        dayKey: String,
        translatedPageCount: Int = 0,
        savedItemCount: Int = 0,
        reviewCompletedCount: Int = 0,
        updatedAt: Date = .now
    ) {
        self.dayKey = dayKey
        self.translatedPageCount = translatedPageCount
        self.savedItemCount = savedItemCount
        self.reviewCompletedCount = reviewCompletedCount
        self.updatedAt = updatedAt
    }
}

@Model
public final class SiteShortcutRecord {
    @Attribute(.unique) public var shortcutId: UUID
    @Attribute(.unique) public var url: String
    public var name: String
    public var symbol: String
    public var note: String
    public var orderIndex: Int
    public var isEnabled: Bool
    public var updatedAt: Date

    public init(
        shortcutId: UUID = UUID(),
        url: String,
        name: String,
        symbol: String,
        note: String,
        orderIndex: Int,
        isEnabled: Bool = true,
        updatedAt: Date = .now
    ) {
        self.shortcutId = shortcutId
        self.url = url
        self.name = name
        self.symbol = symbol
        self.note = note
        self.orderIndex = orderIndex
        self.isEnabled = isEnabled
        self.updatedAt = updatedAt
    }
}
