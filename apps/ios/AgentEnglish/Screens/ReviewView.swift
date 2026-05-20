import AgentEnglishCore
import SwiftData
import SwiftUI

struct ReviewView: View {
    @Query(sort: \ReviewCardRecord.createdAt, order: .forward) private var reviewCards: [ReviewCardRecord]

    var body: some View {
        ScrollView {
            if reviewCards.isEmpty {
                ContentUnavailableView(
                    "今天没有待复习卡片",
                    systemImage: "rectangle.stack.badge.person.crop",
                    description: Text("新收藏生成复习卡后，会在这里出现。")
                )
                .padding(.top, 48)
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(reviewCards) { card in
                        GroupBox {
                            VStack(alignment: .leading, spacing: 12) {
                                Text(card.prompt)
                                    .font(.title3.weight(.semibold))

                                Text(card.answer)
                                    .font(.body)
                                    .foregroundStyle(.secondary)

                                if let savedItem = card.savedItem {
                                    Text("来源：\(savedItem.sourceTitle)")
                                        .font(.caption)
                                        .foregroundStyle(.tertiary)
                                }

                                HStack {
                                    Label("记住", systemImage: "checkmark.circle")
                                    Spacer()
                                    Label("模糊", systemImage: "questionmark.circle")
                                    Spacer()
                                    Label("不会", systemImage: "arrow.counterclockwise.circle")
                                }
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("今日复习")
    }
}
