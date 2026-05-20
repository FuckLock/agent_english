import Foundation
import SwiftData

public enum SampleLearningData {
    public static func seedIfNeeded(in context: ModelContext) throws {
        let savedItems = try context.fetch(FetchDescriptor<SavedItemRecord>())
        let reviewCards = try context.fetch(FetchDescriptor<ReviewCardRecord>())
        let appSettings = try context.fetch(FetchDescriptor<AppSettingsRecord>())
        let providerProfiles = try context.fetch(FetchDescriptor<ProviderProfileRecord>())

        guard savedItems.isEmpty, reviewCards.isEmpty, appSettings.isEmpty, providerProfiles.isEmpty else {
            return
        }

        let providerProfileId = UUID()
        let providerProfile = ProviderProfileRecord(
            providerProfileId: providerProfileId,
            providerName: "Custom AI Provider",
            displayName: "每日精读助手",
            credentialReference: KeychainCredentialStore.credentialReference(for: providerProfileId),
            isEnabled: true,
            capabilitySummary: "双语解释、例句生成与后续复习联动"
        )

        let appSettingsRecord = AppSettingsRecord(
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            preferredProviderName: providerProfile.displayName,
            preferredProviderProfileId: providerProfile.providerProfileId,
            privacySummary: "学习收藏与复习卡保存在本机；网页浏览数据与学习记录分开管理。"
        )

        let firstSavedItem = SavedItemRecord(
            text: "serendipity",
            translation: "意外发现美好事物的能力",
            sourceTitle: "Wikipedia",
            sourceURL: "https://www.wikipedia.org/wiki/Serendipity",
            kind: "word"
        )
        let secondSavedItem = SavedItemRecord(
            text: "in the long run",
            translation: "从长远来看",
            sourceTitle: "Reddit",
            sourceURL: "https://www.reddit.com/r/EnglishLearning/",
            kind: "phrase"
        )

        let firstReviewCard = ReviewCardRecord(
            prompt: "serendipity",
            answer: "意外发现美好事物的能力",
            savedItemId: firstSavedItem.savedItemId,
            savedItem: firstSavedItem
        )
        let secondReviewCard = ReviewCardRecord(
            prompt: "in the long run",
            answer: "从长远来看",
            savedItemId: secondSavedItem.savedItemId,
            savedItem: secondSavedItem
        )

        context.insert(providerProfile)
        context.insert(appSettingsRecord)
        context.insert(firstSavedItem)
        context.insert(secondSavedItem)
        context.insert(firstReviewCard)
        context.insert(secondReviewCard)
        try context.save()
    }
}
