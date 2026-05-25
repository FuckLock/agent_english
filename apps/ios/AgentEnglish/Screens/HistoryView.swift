#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

struct HistoryPresentationItem: Identifiable, Equatable {
    let historyEntryId: UUID
    let url: String
    let title: String
    let siteHost: String
    let lastVisitedAt: Date
    let visitCount: Int

    var id: UUID { historyEntryId }

    var openURL: URL? {
        URL(string: url)
    }

    var displayTitle: String {
        title.isEmpty ? url : title
    }

    var visitSummary: String {
        "\(siteHost.isEmpty ? url : siteHost) · \(visitCount) 次"
    }

    init(record: HistoryEntryRecord) {
        self.historyEntryId = record.historyEntryId
        self.url = record.url
        self.title = record.title
        self.siteHost = record.siteHost
        self.lastVisitedAt = record.lastVisitedAt
        self.visitCount = record.visitCount
    }
}

struct HistoryView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \HistoryEntryRecord.lastVisitedAt, order: .reverse) private var historyEntries: [HistoryEntryRecord]

    let onOpenURL: (URL) -> Void

    @State private var statusMessage: String?
    @State private var isConfirmingClearAll = false

    var body: some View {
        List {
            if let statusMessage {
                Section {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            if historyItems.isEmpty {
                emptySection
            } else {
                Section("最近浏览") {
                    ForEach(historyItems) { item in
                        historyRow(item)
                            .swipeActions {
                                if !item.siteHost.isEmpty {
                                    Button(role: .destructive) {
                                        clearSite(host: item.siteHost)
                                    } label: {
                                        Label("清理站点", systemImage: "trash")
                                    }
                                }
                            }
                    }
                }

                Section("数据管理") {
                    Button(role: .destructive) {
                        isConfirmingClearAll = true
                    } label: {
                        Label("清空浏览历史", systemImage: "trash")
                    }
                }
            }
        }
        .navigationTitle("浏览历史")
        .confirmationDialog(
            "清空所有浏览历史？",
            isPresented: $isConfirmingClearAll,
            titleVisibility: .visible
        ) {
            Button("清空浏览历史", role: .destructive, action: clearAllHistory)
            Button("取消", role: .cancel) {}
        } message: {
            Text("这只会删除 App 内的继续学习记录，不会清理网站登录状态。")
        }
    }

    private var historyItems: [HistoryPresentationItem] {
        historyEntries.map(HistoryPresentationItem.init)
    }

    private var emptySection: some View {
        Section {
            ContentUnavailableView(
                "还没有浏览历史",
                systemImage: "clock.arrow.circlepath",
                description: Text("从首页打开网页后，最近访问会显示在这里。")
            )
            .frame(maxWidth: .infinity, minHeight: 220)
        }
    }

    private func historyRow(_ item: HistoryPresentationItem) -> some View {
        Button {
            open(item)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text(item.displayTitle)
                        .font(.headline)
                        .lineLimit(2)
                    Spacer()
                    Text(item.lastVisitedAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Text(item.url)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Text(item.visitSummary)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    private func open(_ item: HistoryPresentationItem) {
        guard let url = item.openURL else {
            statusMessage = "这个历史地址不可打开。"
            return
        }

        onOpenURL(url)
        dismiss()
    }

    private func clearSite(host: String) {
        do {
            try HistoryRepository(modelContext: modelContext).clearSite(host: host)
            statusMessage = "已清理 \(host) 的历史。"
        } catch {
            statusMessage = "站点历史清理失败：\(error.localizedDescription)"
        }
    }

    private func clearAllHistory() {
        do {
            try HistoryRepository(modelContext: modelContext).deleteAll()
            statusMessage = "浏览历史已清空。"
        } catch {
            statusMessage = "浏览历史清空失败：\(error.localizedDescription)"
        }
    }
}
