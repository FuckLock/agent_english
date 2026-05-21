import SwiftUI

private struct QuickSite: Identifiable {
    let id = UUID()
    let name: String
    let symbol: String
    let note: String
    let url: URL
}

struct BrowserLaunch: Hashable, Identifiable {
    let id = UUID()
    let url: URL
}

struct BrowserHomeView: View {
    @State private var addressInput = ""
    @State private var showAddressError = false
    @State private var showSettingsHint = false
    @Binding private var launch: BrowserLaunch?

    init(launch: Binding<BrowserLaunch?>) {
        self._launch = launch
    }

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    private let quickSites = [
        QuickSite(
            name: "YouTube",
            symbol: "play.rectangle.fill",
            note: "视频与字幕",
            url: URL(string: "https://www.youtube.com")!
        ),
        QuickSite(
            name: "Reddit",
            symbol: "bubble.left.and.bubble.right.fill",
            note: "真实讨论",
            url: URL(string: "https://www.reddit.com/r/EnglishLearning/")!
        ),
        QuickSite(
            name: "Wikipedia",
            symbol: "book.closed.fill",
            note: "长文阅读",
            url: URL(string: "https://www.wikipedia.org")!
        ),
        QuickSite(
            name: "AO3",
            symbol: "text.book.closed.fill",
            note: "同人小说",
            url: URL(string: "https://archiveofourown.org")!
        ),
        QuickSite(
            name: "X",
            symbol: "bolt.horizontal.fill",
            note: "短内容流",
            url: URL(string: "https://x.com")!
        ),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerSection
                searchField
                quickSiteSection
                phaseSummaryCard
            }
            .padding(20)
        }
        .navigationTitle("浏览首页")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showSettingsHint = true
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("设置")
            }
        }
        .alert("设置页已准备好", isPresented: $showSettingsHint) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text("四个 Tab 都是原生页面；Provider 信息和隐私说明在设置标签页查看。")
        }
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

    private var quickSiteSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("常用站点")
                .font(.headline)
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(quickSites) { site in
                    quickSiteCard(for: site)
                }
            }
        }
    }

    private var phaseSummaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("原生首页已就位")
                .font(.headline)
            Text("现在可以从首页打开真实网页；页面加载后会通过 bridge 向原生层发送启动和 page-ready 事件。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func quickSiteCard(for site: QuickSite) -> some View {
        Button {
            launch = BrowserLaunch(url: site.url)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: site.symbol)
                    .font(.title3)
                Text(site.name)
                    .font(.headline)
                Text(site.note)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
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
