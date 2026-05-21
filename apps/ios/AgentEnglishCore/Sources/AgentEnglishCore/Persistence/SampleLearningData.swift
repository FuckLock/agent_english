import Foundation
import SwiftData

public enum SampleLearningData {
    public static func seedIfNeeded(in context: ModelContext) throws {
        let savedItems = try context.fetch(FetchDescriptor<SavedItemRecord>())
        let reviewCards = try context.fetch(FetchDescriptor<ReviewCardRecord>())
        let appSettings = try context.fetch(FetchDescriptor<AppSettingsRecord>())
        let providerProfiles = try context.fetch(FetchDescriptor<ProviderProfileRecord>())
        let translationCaches = try context.fetch(FetchDescriptor<TranslationCacheRecord>())

        guard
            savedItems.isEmpty,
            reviewCards.isEmpty,
            appSettings.isEmpty,
            providerProfiles.isEmpty,
            translationCaches.isEmpty
        else {
            return
        }

        let providerProfileId = UUID()
        let providerProfile = ProviderProfileRecord(
            providerProfileId: providerProfileId,
            providerName: "Custom AI Provider",
            displayName: "每日精读助手",
            credentialReference: KeychainCredentialStore.credentialReference(for: providerProfileId),
            isEnabled: false,
            capabilitySummary: "配置后可启用整页翻译与后续学习能力"
        )

        let appSettingsRecord = AppSettingsRecord(
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            preferredProviderName: "未配置翻译 Provider",
            preferredProviderProfileId: nil,
            privacySummary: "学习收藏与复习卡保存在本机；配置好 Provider 后才会发送页面文本进行翻译。"
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
