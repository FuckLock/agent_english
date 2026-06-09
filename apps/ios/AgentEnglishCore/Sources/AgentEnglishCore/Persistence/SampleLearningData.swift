import Foundation
import SwiftData

public enum SampleLearningData {
    public static func seedIfNeeded(in context: ModelContext) throws {
        let savedItems = try context.fetch(FetchDescriptor<SavedItemRecord>())
        let reviewCards = try context.fetch(FetchDescriptor<ReviewCardRecord>())
        let appSettings = try context.fetch(FetchDescriptor<AppSettingsRecord>())
        let modelProfiles = try context.fetch(FetchDescriptor<ModelServiceProfileRecord>())
        let translationCaches = try context.fetch(FetchDescriptor<TranslationCacheRecord>())
        let historyEntries = try context.fetch(FetchDescriptor<HistoryEntryRecord>())
        let dailyStats = try context.fetch(FetchDescriptor<DailyStatRecord>())
        let siteShortcuts = try context.fetch(FetchDescriptor<SiteShortcutRecord>())

        guard
            savedItems.isEmpty,
            reviewCards.isEmpty,
            appSettings.isEmpty,
            modelProfiles.isEmpty,
            translationCaches.isEmpty,
            historyEntries.isEmpty,
            dailyStats.isEmpty,
            siteShortcuts.isEmpty
        else {
            return
        }

        let modelProfile = ModelServiceProfileRecord(
            serviceTier: ModelServiceTier.free.rawValue,
            preferredModelID: "deepseek-chat",
            preferredModelLabel: "Free 服务 · deepseek-chat",
            quotaStatus: ModelQuotaStatus.ok.rawValue,
            quotaUsed: 3,
            quotaLimit: 20
        )

        let appSettingsRecord = AppSettingsRecord(
            sourceLanguage: "English",
            targetLanguage: "简体中文",
            privacySummary: "学习收藏、历史和复习数据保存在本机；翻译或解释时才会把页面文本发送到自有后端模型服务。"
        )

        let firstSavedItem = SavedItemRecord(
            sourceUrl: "https://www.wikipedia.org/wiki/Serendipity",
            sourceTitle: "Wikipedia",
            selectedText: "serendipity",
            contextBefore: "A knack for making",
            contextAfter: "valuable discoveries by accident.",
            translation: "意外发现美好事物的能力",
            explanation: "这里指人在偶然情况下发现有价值事物的能力。",
            kind: "word"
        )
        let secondSavedItem = SavedItemRecord(
            sourceUrl: "https://www.reddit.com/r/EnglishLearning/",
            sourceTitle: "Reddit",
            selectedText: "in the long run",
            contextBefore: "It helps you stay consistent",
            contextAfter: "when motivation drops.",
            translation: "从长远来看",
            explanation: "这里强调长期结果，而不是眼前的短期变化。",
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
        let historyEntry = HistoryEntryRecord(
            url: "https://www.wikipedia.org/wiki/Serendipity",
            title: "Wikipedia · Serendipity",
            siteHost: "www.wikipedia.org",
            visitCount: 2
        )
        let dailyStat = DailyStatRecord(
            dayKey: Self.dayKey(for: .now),
            translatedPageCount: 1,
            savedItemCount: 2,
            reviewCompletedCount: 0
        )

        context.insert(modelProfile)
        context.insert(appSettingsRecord)
        context.insert(firstSavedItem)
        context.insert(secondSavedItem)
        context.insert(firstReviewCard)
        context.insert(secondReviewCard)
        context.insert(historyEntry)
        context.insert(dailyStat)
        for (index, shortcut) in SiteShortcutRepository.defaultShortcuts.enumerated() {
            context.insert(
                SiteShortcutRecord(
                    url: shortcut.url,
                    name: shortcut.name,
                    symbol: shortcut.symbol,
                    note: shortcut.note,
                    orderIndex: index
                )
            )
        }
        try context.save()
    }

    private static func dayKey(for date: Date, calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
    }
}
