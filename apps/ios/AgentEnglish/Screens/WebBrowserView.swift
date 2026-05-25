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

    var body: some View {
        VStack(spacing: 0) {
            urlStatusBar

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

            browserToolbar
            if let translationFailure = translationFailure {
                translationFailureBanner(for: translationFailure)
            }
            bridgeStatusBar
        }
        .navigationTitle(navigationState.title)
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

    private func failureTitle(
        for failureReason: TranslationFailureReason
    ) -> String {
        switch failureReason {
        case .pageUnrecognized:
            return "当前页面正文暂时不可识别"
        case .translationFailed:
            return "整页翻译暂时失败"
        case .quotaExceeded:
            return "当前服务等级额度不足"
        case .tierUnavailable:
            return "当前服务等级暂不可用"
        case .serviceUnavailable:
            return "模型服务暂不可用"
        case .contentTooLong:
            return "本次内容过长"
        case .providerFallbackFailed:
            return "模型服务暂不可用"
        }
    }

    private func failureMessage(
        for failureReason: TranslationFailureReason
    ) -> String {
        switch failureReason {
        case .pageUnrecognized:
            return "可以直接选择页面中的文本，再改用选区翻译。"
        case .translationFailed:
            return "可以重试一次，或先切换到选区翻译完成当前阅读。"
        case .quotaExceeded:
            return "可以稍后再试，或切换到较轻量的 Free 服务。"
        case .tierUnavailable:
            return "请到设置页确认当前等级和默认模型。"
        case .serviceUnavailable:
            return "模型服务暂时繁忙，稍后重试即可。"
        case .contentTooLong:
            return "可以缩短当前选择范围，或分段翻译后继续阅读。"
        case .providerFallbackFailed:
            return "模型服务暂时繁忙，稍后重试即可。"
        }
    }
}
