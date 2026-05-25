import Foundation
import SwiftData

public struct DailyStatsSummary: Equatable, Sendable {
    public let translatedPageCount: Int
    public let savedItemCount: Int
    public let reviewCompletedCount: Int
    public let currentStreakDays: Int

    public init(
        translatedPageCount: Int,
        savedItemCount: Int,
        reviewCompletedCount: Int,
        currentStreakDays: Int
    ) {
        self.translatedPageCount = translatedPageCount
        self.savedItemCount = savedItemCount
        self.reviewCompletedCount = reviewCompletedCount
        self.currentStreakDays = currentStreakDays
    }
}

@MainActor
public final class StatisticsRepository {
    private let modelContext: ModelContext
    private var calendar: Calendar

    public init(modelContext: ModelContext, calendar: Calendar = .current) {
        self.modelContext = modelContext
        self.calendar = calendar
    }

    public func recordTranslatedPage(at date: Date = .now) throws {
        let record = try dailyRecord(for: date)
        record.translatedPageCount += 1
        record.updatedAt = date
        try modelContext.save()
    }

    public func recordSavedItem(at date: Date = .now) throws {
        let record = try dailyRecord(for: date)
        record.savedItemCount += 1
        record.updatedAt = date
        try modelContext.save()
    }

    public func recordReviewCompleted(at date: Date = .now) throws {
        let record = try dailyRecord(for: date)
        record.reviewCompletedCount += 1
        record.updatedAt = date
        try modelContext.save()
    }

    public func summary(for date: Date = .now) throws -> DailyStatsSummary {
        let records = try modelContext.fetch(FetchDescriptor<DailyStatRecord>())
        let todayKey = dayKey(for: date)
        let today = records.first(where: { $0.dayKey == todayKey })
        let activityKeys = Set(records.filter { record in
            record.translatedPageCount + record.savedItemCount + record.reviewCompletedCount > 0
        }.map(\.dayKey))

        return DailyStatsSummary(
            translatedPageCount: today?.translatedPageCount ?? 0,
            savedItemCount: today?.savedItemCount ?? 0,
            reviewCompletedCount: today?.reviewCompletedCount ?? 0,
            currentStreakDays: currentStreakDays(from: date, activityKeys: activityKeys)
        )
    }

    private func dailyRecord(for date: Date) throws -> DailyStatRecord {
        let key = dayKey(for: date)
        let records = try modelContext.fetch(FetchDescriptor<DailyStatRecord>())
        if let existing = records.first(where: { $0.dayKey == key }) {
            return existing
        }

        let record = DailyStatRecord(dayKey: key, updatedAt: date)
        modelContext.insert(record)
        return record
    }

    private func currentStreakDays(from date: Date, activityKeys: Set<String>) -> Int {
        var count = 0
        var currentDate = date

        while activityKeys.contains(dayKey(for: currentDate)) {
            count += 1
            guard let previousDate = calendar.date(byAdding: .day, value: -1, to: currentDate) else {
                break
            }
            currentDate = previousDate
        }

        return count
    }

    private func dayKey(for date: Date) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let year = components.year ?? 0
        let month = components.month ?? 0
        let day = components.day ?? 0
        return String(format: "%04d-%02d-%02d", year, month, day)
    }
}
