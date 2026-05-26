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
        Group {
            if bridgeController.isVideoImmersiveMode {
                videoImmersiveBody
            } else {
                browserBody
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

    /// 视频隐形态：YouTube 独占屏幕（WebView 铺满），App 不在顶部 / 底部常驻任何
    /// 工具条 / 状态栏 / 分段控件；唯一常驻 App 元素是叠在视频左侧的召唤把手。
    private var videoImmersiveBody: some View {
        webViewContainer
            .overlay(alignment: .leading) {
                VideoSummonView(
                    bridgeController: bridgeController,
                    onBack: handleVideoBack,
                    onSourceToggle: handleVideoSourceToggle
                )
            }
    }

    /// 普通文本网页：保留原有浏览 chrome（URL 状态栏 / 工具条 / 桥接状态栏）。
    private var browserBody: some View {
        VStack(spacing: 0) {
            urlStatusBar

            webViewContainer

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
            onWebViewReady: {
                webView = $0
                bridgeController.attach(webView: $0)
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
