#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

struct FavoritesView: View {
    @Query(sort: \SavedItemRecord.savedAt, order: .reverse) private var savedItems: [SavedItemRecord]

    var body: some View {
        Group {
            if savedItems.isEmpty {
                ContentUnavailableView(
                    "还没有收藏内容",
                    systemImage: "bookmark.slash",
                    description: Text("在网页里点词或选句后，收藏会出现在这里。")
                )
            } else {
                List {
                    Section("最近保存") {
                        ForEach(savedItems) { item in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(alignment: .top) {
                                    Text(item.text)
                                        .font(.headline)
                                    Spacer()
                                    Text(item.kind.uppercased())
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }

                                Text(item.translation)
                                    .font(.body)

                                Text(item.sourceTitle)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)

                                Text(item.sourceURL)
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                                    .lineLimit(1)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                .listStyle(.inset)
            }
        }
        .navigationTitle("学习收藏")
    }
}
