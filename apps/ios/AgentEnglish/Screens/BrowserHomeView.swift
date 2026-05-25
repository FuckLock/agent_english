#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

struct BrowserLaunch: Hashable, Identifiable {
    let id = UUID()
    let url: URL
}

struct BrowserHomeView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \HistoryEntryRecord.lastVisitedAt, order: .reverse) private var historyEntries: [HistoryEntryRecord]
    @Query(sort: \SiteShortcutRecord.orderIndex, order: .forward) private var siteShortcuts: [SiteShortcutRecord]

    @State private var addressInput = ""
    @State private var showAddressError = false
    @State private var shortcutStatusMessage: String?
    @Binding private var launch: BrowserLaunch?

    init(launch: Binding<BrowserLaunch?>) {
        self._launch = launch
    }

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerSection
                searchField
                continueSection
                quickSiteSection
            }
            .padding(20)
        }
        .navigationTitle("浏览首页")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink {
                    HistoryView { url in
                        launch = BrowserLaunch(url: url)
                    }
                } label: {
                    Image(systemName: "clock.arrow.circlepath")
                }
                .accessibilityLabel("浏览历史")
            }
            ToolbarItem(placement: .primaryAction) {
                NavigationLink {
                    SiteShortcutEditorView()
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
                .accessibilityLabel("编辑快捷入口")
            }
        }
        .onAppear(perform: seedDefaultShortcuts)
        .alert("无法打开这个地址", isPresented: $showAddressError) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text("请输入完整网址，或输入英文关键词进行搜索。")
        }
        .navigationDestination(item: $launch) { launch in
            WebBrowserView(initialURL: launch.url)
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Agent English")
                .font(.largeTitle.bold())
            Text("输入网址或关键词，先从熟悉的网站开始建立你的英语素材库。")
                .font(.body)
                .foregroundStyle(.secondary)
        }
    }

    private var searchField: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("输入网址或搜索英文内容", text: $addressInput)
                .autocorrectionDisabled()
                .onSubmit(openAddressInput)

            Button {
                openAddressInput()
            } label: {
                Image(systemName: "arrow.forward.circle.fill")
                    .font(.title3)
            }
            .disabled(addressInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("打开")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var continueSection: some View {
        Group {
            if !historyEntries.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("继续学习")
                        .font(.headline)

                    ForEach(Array(historyEntries.prefix(3))) { entry in
                        Button {
                            if let url = URL(string: entry.url) {
                                launch = BrowserLaunch(url: url)
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "clock.arrow.circlepath")
                                    .font(.headline)
                                    .foregroundStyle(.purple)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(entry.title.isEmpty ? entry.url : entry.title)
                                        .font(.subheadline.weight(.semibold))
                                        .lineLimit(1)
                                    Text(entry.siteHost.isEmpty ? entry.url : entry.siteHost)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }

                                Spacer()

                                Image(systemName: "chevron.forward")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(.tertiary)
                            }
                            .padding(14)
                            .background(
                                Color.secondary.opacity(0.08),
                                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var quickSiteSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("常用站点")
                    .font(.headline)
                Spacer()
                if let shortcutStatusMessage {
                    Text(shortcutStatusMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(enabledShortcuts) { shortcut in
                    quickSiteCard(for: shortcut)
                }
            }
        }
    }

    private var enabledShortcuts: [SiteShortcutRecord] {
        siteShortcuts.filter(\.isEnabled)
    }

    private func quickSiteCard(for shortcut: SiteShortcutRecord) -> some View {
        Button {
            if let url = URL(string: shortcut.url) {
                launch = BrowserLaunch(url: url)
            }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: shortcut.symbol)
                    .font(.title3)
                Text(shortcut.name)
                    .font(.headline)
                Text(shortcut.note)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func seedDefaultShortcuts() {
        do {
            let createdCount = try SiteShortcutRepository(modelContext: modelContext).seedDefaultsIfNeeded()
            if createdCount > 0 {
                shortcutStatusMessage = "已创建默认入口"
            }
        } catch {
            shortcutStatusMessage = "入口加载失败"
        }
    }

    private func openAddressInput() {
        guard let url = normalizedURL(from: addressInput) else {
            showAddressError = true
            return
        }

        launch = BrowserLaunch(url: url)
    }

    private func normalizedURL(from input: String) -> URL? {
        let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedInput.isEmpty else {
            return nil
        }

        if let url = URL(string: trimmedInput), url.scheme == "https" || url.scheme == "http" {
            return url
        }

        if trimmedInput.contains("."), !trimmedInput.contains(" ") {
            return URL(string: "https://\(trimmedInput)")
        }

        var components = URLComponents(string: "https://duckduckgo.com/")
        components?.queryItems = [
            URLQueryItem(name: "q", value: trimmedInput),
        ]
        return components?.url
    }
}
