#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI
import WebKit

struct WebBrowserView: View {
    let initialURL: URL

    @Environment(\.modelContext) private var modelContext
    @StateObject private var navigationState = WebNavigationState()
    @StateObject private var bridgeController = WebBridgeController()
    @State private var webView: WKWebView?
    @State private var selectedSheetDetent: PresentationDetent = .medium
    @State private var showsVideoAudioPrivacy = false

    var body: some View {
        // Phase 8.7 修复：WebView 单例化——webViewContainer 恒为视图树根，三种 chrome 模式
        // 通过条件 inset / overlay 叠加，不再放进 if/else 分支。此前三个分支体各含一份
        // webViewContainer，分支切换（如点视频 youTubeSite → videoImmersive）会让 SwiftUI
        // 销毁并重建 WKWebView，触发 "Modifying state during view update" 且使视频重新加载。
        webViewContainer
            .safeAreaInset(edge: .top, spacing: 0) {
                // 普通文本网页：顶部 URL 状态栏；视频隐形态 / YouTube 整站不显示。
                if showsBrowserChrome {
                    urlStatusBar
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                // 普通文本网页：底部工具条 + 翻译失败横幅 + 桥接状态栏。
                if showsBrowserChrome {
                    browserBottomChrome
                }
            }
            .overlay(alignment: .leading) {
                // 视频隐形态：左侧召唤把手（v2.5，不回退）；非视频页不显示。
                if bridgeController.isVideoImmersiveMode {
                    VideoSummonView(
                        bridgeController: bridgeController,
                        onBack: handleVideoBack,
                        onSourceToggle: handleVideoSourceToggle
                    )
                }
            }
            .navigationTitle(navigationState.title)
        .webBrowserNavigationChrome()
        .onAppear {
            bridgeController.configure(modelContext: modelContext)
        }
        .sheet(
            isPresented: Binding(
                get: { bridgeController.explanationSheet != nil },
                set: { isPresented in
                    if !isPresented {
                        bridgeController.dismissExplanationSheet()
                    }
                }
            )
        ) {
            if let explanationSheet = bridgeController.explanationSheet {
                ExplanationSheetView(
                    presentation: explanationSheet,
                    onFavorite: {
                        bridgeController.saveCurrentExplanation()
                    }
                )
                .presentationDetents(
                    [.fraction(0.28), .medium, .large],
                    selection: $selectedSheetDetent
                )
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
            }
        }
        .confirmationDialog(
            "听音翻译 Beta",
            isPresented: $showsVideoAudioPrivacy,
            titleVisibility: .visible
        ) {
            Button("确认开启听音翻译") {
                bridgeController.acknowledgeVideoAudioPrivacyAndStart()
            }
            .accessibilityIdentifier("video-audio-privacy")

            Button("取消", role: .cancel) {}
        } message: {
            Text("开启后会识别当前视频片段音频并发送到自有模型服务，受今日听音分钟额度限制。")
        }
    }

    /// Phase 8.7 / A1：当前 URL 是否属于 YouTube 整站（首页 / 列表 / 搜索 / Shorts /
    /// 视频页）。整站识别（chrome 决策入口）独立于 `isVideoImmersiveMode`（视频页字幕能力
    /// 决策入口）——两个分别判定的入口，整站隐形为真不代表视频页叠字幕为真。
    private var isYouTubeImmersiveSite: Bool {
        bridgeController.shouldUseMinimalChrome(for: currentURLText)
    }

    /// 当前生效 URL：导航后取实时 URL，未加载时回退到入口 URL。
    private var currentURLText: String {
        navigationState.currentURLText.isEmpty
            ? initialURL.absoluteString
            : navigationState.currentURLText
    }

    /// Phase 8.7 修复：是否显示普通文本网页的完整浏览 chrome（顶部 URL 栏 + 底部工具条 /
    /// 状态栏）。视频隐形态与 YouTube 整站均不显示——前者只叠召唤把手，后者整站原生体验，
    /// 任何 YouTube 页面都不出现阅读显示模式分段控件与常驻浏览工具条（A1）。
    private var showsBrowserChrome: Bool {
        !bridgeController.isVideoImmersiveMode && !isYouTubeImmersiveSite
    }

    /// 普通文本网页底部 chrome：工具条（含原文 / 双语 / 学习分段控件）+ 翻译失败横幅 +
    /// 桥接状态栏。作为 body 的 bottom safeAreaInset，叠加在稳定的 webViewContainer 上。
    private var browserBottomChrome: some View {
        VStack(spacing: 0) {
            browserToolbar

            if let translationFailure = translationFailure {
                translationFailureBanner(for: translationFailure)
            }

            bridgeStatusBar
        }
    }

    private var webViewContainer: some View {
        WebViewContainer(
            initialURL: initialURL,
            navigationState: navigationState,
            bridgeController: bridgeController,
            onWebViewReady: { createdWebView in
                // Phase 8.7 修复：makeUIView 内同步执行此回调；直接写 @State webView 会在
                // 视图构建期间改状态（"Modifying state during view update"）。推迟到当前
                // 渲染周期之后再写，避免首次创建 WebView 时的同步状态修改警告。
                DispatchQueue.main.async {
                    webView = createdWebView
                    bridgeController.attach(webView: createdWebView)
                }
            }
        )
        .background(Color.clear)
    }

    private func handleVideoBack() {
        if navigationState.canGoBack {
            webView?.goBack()
        }
        bridgeController.summonBack()
    }

    private func handleVideoSourceToggle() {
        bridgeController.summonToggleSource()
        // 切到听音 Beta 时弹出既有隐私确认弹窗（复用 Phase 6.7 听音入口）。
        if bridgeController.videoAudioState?.status == .privacyRequired {
            showsVideoAudioPrivacy = true
        }
    }

    private var urlStatusBar: some View {
        HStack(spacing: 8) {
            Image(systemName: navigationState.isLoading ? "arrow.triangle.2.circlepath" : "lock")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)

            Text(navigationState.currentURLText.isEmpty ? initialURL.absoluteString : navigationState.currentURLText)
                .font(.footnote)
                .lineLimit(1)
                .truncationMode(.middle)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.08))
    }

    private var browserToolbar: some View {
        VStack(spacing: 12) {
            HStack(spacing: 24) {
                Button {
                    webView?.goBack()
                } label: {
                    Image(systemName: "chevron.backward")
                }
                .disabled(!navigationState.canGoBack)
                .accessibilityLabel("后退")

                Button {
                    webView?.goForward()
                } label: {
                    Image(systemName: "chevron.forward")
                }
                .disabled(!navigationState.canGoForward)
                .accessibilityLabel("前进")

                Button {
                    webView?.reload()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("刷新")

                Spacer()

                Button {
                    bridgeController.requestTranslation()
                } label: {
                    if isTranslating {
                        ProgressView()
                            .progressViewStyle(.circular)
                    } else {
                        Label("翻译", systemImage: "character.bubble")
                    }
                }
                .accessibilityLabel("翻译")
            }

            Picker(
                "显示模式",
                selection: Binding(
                    get: { bridgeController.displayMode },
                    set: { bridgeController.setDisplayMode($0) }
                )
            ) {
                Text("原文").tag(DisplayMode.original)
                Text("双语").tag(DisplayMode.bilingual)
                Text("学习").tag(DisplayMode.learning)
            }
            .pickerStyle(.segmented)
        }
        .font(.headline)
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(.bar)
    }

    private var bridgeStatusBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.purple)

            Text(bridgeController.lastEventSummary)
                .font(.footnote)
                .lineLimit(1)
                .truncationMode(.middle)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.purple.opacity(0.08))
    }

    private var translationFailure: TranslationFailureReason? {
        switch bridgeController.translationStatus {
        case .failed(let failureReason):
            return failureReason
        case .idle, .loading, .translated:
            return nil
        }
    }

    private var isTranslating: Bool {
        if case .loading = bridgeController.translationStatus {
            return true
        }

        return false
    }

    private func translationFailureBanner(
        for failureReason: TranslationFailureReason
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(failureTitle(for: failureReason))
                .font(.subheadline.weight(.semibold))
            Text(failureMessage(for: failureReason))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.12))
    }
}

private extension View {
    @ViewBuilder
    func webBrowserNavigationChrome() -> some View {
        #if os(iOS)
        self
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
        #else
        self
        #endif
    }
}
