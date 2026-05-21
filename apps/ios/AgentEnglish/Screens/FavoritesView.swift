#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

enum FavoritesKindFilter: String, CaseIterable, Identifiable {
    case all
    case word
    case phrase
    case sentence

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all:
            return "全部"
        case .word:
            return "单词"
        case .phrase:
            return "短语"
        case .sentence:
            return "句子"
        }
    }
}

struct FavoritesSourceFilter: Hashable, Identifiable {
    let value: String
    let title: String

    static let all = FavoritesSourceFilter(value: "all", title: "全部来源")

    var id: String { value }
}

struct FavoritesPresentationItem: Identifiable, Equatable {
    let savedItemId: UUID
    let selectedText: String
    let translation: String
    let explanation: String
    let sourceTitle: String
    let sourceUrl: String
    let contextBefore: String
    let contextAfter: String
    let kind: String
    let createdAt: Date

    var id: UUID { savedItemId }

    var revisitURL: URL? {
        URL(string: sourceUrl)
    }

    var sourceFilterValue: String {
        revisitURL?.host ?? sourceTitle
    }

    var sourceSummary: String {
        sourceTitle.isEmpty ? sourceUrl : "\(sourceTitle) · \(sourceUrl)"
    }

    var contextSummary: String {
        [contextBefore, selectedText, contextAfter]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    init(record: SavedItemRecord) {
        self.savedItemId = record.savedItemId
        self.selectedText = record.selectedText
        self.translation = record.translation
        self.explanation = record.explanation
        self.sourceTitle = record.sourceTitle
        self.sourceUrl = record.sourceUrl
        self.contextBefore = record.contextBefore
        self.contextAfter = record.contextAfter
        self.kind = record.kind
        self.createdAt = record.createdAt
    }
}

enum FavoritesContentState: Equatable {
    case emptyCollection
    case emptyResults
    case results
}

enum FavoritesViewModel {
    static func contentState(
        totalItemCount: Int,
        visibleItemCount: Int
    ) -> FavoritesContentState {
        if totalItemCount == 0 {
            return .emptyCollection
        }

        return visibleItemCount == 0 ? .emptyResults : .results
    }

    static func sourceFilters(
        from records: [SavedItemRecord]
    ) -> [FavoritesSourceFilter] {
        let values = Set(records.map { FavoritesPresentationItem(record: $0).sourceFilterValue })

        return [.all] + values.sorted().map { value in
            FavoritesSourceFilter(value: value, title: value)
        }
    }

    static func visibleItems(
        from records: [SavedItemRecord],
        searchText: String,
        kindFilter: FavoritesKindFilter,
        sourceFilter: FavoritesSourceFilter
    ) -> [FavoritesPresentationItem] {
        let normalizedQuery = searchText.trimmingCharacters(in: .whitespacesAndNewlines)

        return records.map(FavoritesPresentationItem.init).filter { item in
            let matchesQuery = normalizedQuery.isEmpty || [
                item.selectedText,
                item.translation,
                item.explanation,
                item.sourceTitle,
                item.sourceUrl,
                item.contextBefore,
                item.contextAfter,
            ].contains { value in
                value.localizedCaseInsensitiveContains(normalizedQuery)
            }
            let matchesKind = kindFilter == .all || item.kind == kindFilter.rawValue
            let matchesSource = sourceFilter == .all || item.sourceFilterValue == sourceFilter.value

            return matchesQuery && matchesKind && matchesSource
        }
    }
}

struct FavoritesView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.openURL) private var openURL
    @Query(sort: \SavedItemRecord.createdAt, order: .reverse) private var savedItems: [SavedItemRecord]

    @State private var searchText = ""
    @State private var selectedKindFilter: FavoritesKindFilter = .all
    @State private var selectedSourceFilter: FavoritesSourceFilter = .all

    var body: some View {
        Group {
            switch contentState {
            case .emptyCollection:
                emptyState(
                    title: "还没有收藏内容",
                    description: "在网页里点词或选句后，收藏会出现在这里。"
                )
            case .emptyResults, .results:
                List {
                    filterSection
                    if visibleItems.isEmpty {
                        emptyResultsSection
                    } else {
                        itemsSection
                    }
                }
                .listStyle(.inset)
                .searchable(text: $searchText, prompt: "搜索词句、解释、来源")
            }
        }
        .navigationTitle("学习收藏")
    }

    private var contentState: FavoritesContentState {
        FavoritesViewModel.contentState(
            totalItemCount: savedItems.count,
            visibleItemCount: visibleItems.count
        )
    }

    private var visibleItems: [FavoritesPresentationItem] {
        FavoritesViewModel.visibleItems(
            from: savedItems,
            searchText: searchText,
            kindFilter: selectedKindFilter,
            sourceFilter: selectedSourceFilter
        )
    }

    private var sourceFilters: [FavoritesSourceFilter] {
        FavoritesViewModel.sourceFilters(from: savedItems)
    }

    private var filterSection: some View {
        Section("筛选") {
            Picker("类型", selection: $selectedKindFilter) {
                ForEach(FavoritesKindFilter.allCases) { filter in
                    Text(filter.title).tag(filter)
                }
            }
            .pickerStyle(.segmented)

            Picker("来源", selection: $selectedSourceFilter) {
                ForEach(sourceFilters) { filter in
                    Text(filter.title).tag(filter)
                }
            }
            .pickerStyle(.menu)
        }
    }

    private var itemsSection: some View {
        Section("收藏列表") {
            ForEach(visibleItems) { item in
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top) {
                        Text(item.selectedText)
                            .font(.headline)
                        Spacer()
                        Text(item.kind.uppercased())
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    Text(item.translation)
                        .font(.body.weight(.medium))

                    Text(item.explanation)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Text(item.contextSummary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    Text(item.sourceSummary)
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                        .lineLimit(2)

                    Button {
                        reopenSource(for: item)
                    } label: {
                        Label("回看来源", systemImage: "arrow.uturn.backward.circle")
                    }
                    .buttonStyle(.borderless)
                }
                .padding(.vertical, 6)
                .swipeActions {
                    Button(role: .destructive) {
                        delete(item: item)
                    } label: {
                        Label("删除", systemImage: "trash")
                    }
                }
            }
        }
    }

    private var emptyResultsSection: some View {
        Section("收藏列表") {
            ContentUnavailableView(
                "没有匹配的收藏",
                systemImage: "line.3.horizontal.decrease.circle",
                description: Text("可以换个关键词，或者放宽类型和来源筛选。")
            )
            .frame(maxWidth: .infinity, minHeight: 180)
        }
    }

    private func emptyState(
        title: String,
        description: String
    ) -> some View {
        ContentUnavailableView(
            title,
            systemImage: "bookmark.slash",
            description: Text(description)
        )
    }

    private func reopenSource(for item: FavoritesPresentationItem) {
        guard let url = item.revisitURL else {
            return
        }

        openURL(url)
    }

    private func delete(item: FavoritesPresentationItem) {
        do {
            try SavedItemRepository(modelContext: modelContext).delete(savedItemId: item.savedItemId)
        } catch {
            assertionFailure("Failed to delete saved item: \(error)")
        }
    }
}
