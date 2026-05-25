#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

struct ReviewView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \ReviewCardRecord.nextDueAt, order: .forward) private var reviewCards: [ReviewCardRecord]

    @State private var revealedCardIds: Set<UUID> = []
    @State private var statusMessage: String?

    var body: some View {
        ScrollView {
            if dueCards.isEmpty {
                ContentUnavailableView(
                    "今天没有待复习卡片",
                    systemImage: "rectangle.stack.badge.person.crop",
                    description: Text(emptyStateDescription)
                )
                .padding(.top, 48)
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    if let statusMessage {
                        Text(statusMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    ForEach(dueCards) { card in
                        reviewCard(card)
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("今日复习")
        .onAppear(perform: refreshReviewQueue)
    }

    private var dueCards: [ReviewCardRecord] {
        let now = Date()
        return reviewCards
            .filter { $0.nextDueAt <= now }
            .sorted {
                if $0.nextDueAt == $1.nextDueAt {
                    return $0.createdAt < $1.createdAt
                }
                return $0.nextDueAt < $1.nextDueAt
            }
    }

    private var emptyStateDescription: String {
        reviewCards.isEmpty
            ? "在网页里收藏词句后，系统会自动生成主动回忆卡。"
            : "现有卡片已经安排到稍后复习。"
    }

    private func reviewCard(_ card: ReviewCardRecord) -> some View {
        let isRevealed = revealedCardIds.contains(card.reviewCardId)

        return GroupBox {
            VStack(alignment: .leading, spacing: 14) {
                Text(card.prompt)
                    .font(.title3.weight(.semibold))
                    .textSelection(.enabled)

                if isRevealed {
                    answerBlock(for: card)
                    feedbackRow(for: card)
                } else {
                    Button {
                        revealedCardIds.insert(card.reviewCardId)
                    } label: {
                        Label("查看答案", systemImage: "eye")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }

                if let savedItem = card.savedItem {
                    Text("来源：\(savedItem.sourceTitle.isEmpty ? savedItem.sourceUrl : savedItem.sourceTitle)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func answerBlock(for card: ReviewCardRecord) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(card.answer)
                .font(.body.weight(.medium))

            if let savedItem = card.savedItem, !savedItem.explanation.isEmpty {
                Text(savedItem.explanation)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .textSelection(.enabled)
    }

    private func feedbackRow(for card: ReviewCardRecord) -> some View {
        HStack(spacing: 10) {
            feedbackButton("记住", systemImage: "checkmark.circle", state: .remembered, card: card)
            feedbackButton("模糊", systemImage: "questionmark.circle", state: .fuzzy, card: card)
            feedbackButton("不会", systemImage: "arrow.counterclockwise.circle", state: .forgotten, card: card)
        }
        .font(.subheadline.weight(.medium))
    }

    private func feedbackButton(
        _ title: String,
        systemImage: String,
        state: ReviewFeedbackState,
        card: ReviewCardRecord
    ) -> some View {
        Button {
            recordFeedback(state, for: card)
        } label: {
            Label(title, systemImage: systemImage)
                .labelStyle(.titleAndIcon)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
    }

    private func refreshReviewQueue() {
        do {
            let createdCount = try ReviewScheduler(modelContext: modelContext).generateMissingCards()
            if createdCount > 0 {
                statusMessage = "已从收藏生成 \(createdCount) 张复习卡。"
            }
        } catch {
            statusMessage = "复习队列更新失败：\(error.localizedDescription)"
        }
    }

    private func recordFeedback(
        _ feedbackState: ReviewFeedbackState,
        for card: ReviewCardRecord
    ) {
        do {
            let now = Date()
            try ReviewScheduler(modelContext: modelContext).recordFeedback(feedbackState, for: card, now: now)
            try StatisticsRepository(modelContext: modelContext).recordReviewCompleted(at: now)
            revealedCardIds.remove(card.reviewCardId)
            statusMessage = feedbackMessage(for: feedbackState)
        } catch {
            statusMessage = "复习反馈保存失败：\(error.localizedDescription)"
        }
    }

    private func feedbackMessage(for feedbackState: ReviewFeedbackState) -> String {
        switch feedbackState {
        case .remembered:
            return "已安排 3 天后复习。"
        case .fuzzy:
            return "已安排明天再看一次。"
        case .forgotten:
            return "已安排 10 分钟后重试。"
        }
    }
}
