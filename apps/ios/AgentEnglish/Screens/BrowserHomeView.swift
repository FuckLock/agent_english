import SwiftUI

private struct QuickSite: Identifiable {
    let id = UUID()
    let name: String
    let symbol: String
    let note: String
}

struct BrowserHomeView: View {
    @State private var addressInput = ""
    @State private var showSettingsHint = false

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    private let quickSites = [
        QuickSite(name: "YouTube", symbol: "play.rectangle.fill", note: "视频与字幕"),
        QuickSite(name: "Reddit", symbol: "bubble.left.and.bubble.right.fill", note: "真实讨论"),
        QuickSite(name: "Wikipedia", symbol: "book.closed.fill", note: "长文阅读"),
        QuickSite(name: "AO3", symbol: "text.book.closed.fill", note: "同人小说"),
        QuickSite(name: "X", symbol: "bolt.horizontal.fill", note: "短内容流"),
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
            Text("当前阶段先准备浏览入口、本地收藏和复习底座。Provider 与隐私细节在设置页查看。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func quickSiteCard(for site: QuickSite) -> some View {
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
}
