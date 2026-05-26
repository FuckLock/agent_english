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
        VStack(spacing: 0) {
            if !bridgeController.isVideoImmersiveMode {
                urlStatusBar
            }

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

            if bridgeController.isVideoImmersiveMode {
                videoCaptionToolbar
            } else {
                browserToolbar
            }

            if !bridgeController.isVideoImmersiveMode, let translationFailure = translationFailure {
                translationFailureBanner(for: translationFailure)
            }

            if bridgeController.isVideoImmersiveMode {
                videoCaptionStatusBar
            } else {
                bridgeStatusBar
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

    private var videoCaptionToolbar: some View {
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
                bridgeController.saveCurrentVideoCaption()
            } label: {
                Image(systemName: "bookmark")
            }
            .disabled(bridgeController.videoCaptionState?.activeSegment == nil)
            .accessibilityLabel("收藏当前字幕句")

            Button {
                bridgeController.requestTranslation()
            } label: {
                if bridgeController.videoCaptionState?.status == .translating {
                    ProgressView()
                        .progressViewStyle(.circular)
                } else {
                    Label("字幕", systemImage: "captions.bubble")
                }
            }
            .accessibilityLabel("翻译字幕")

            if bridgeController.videoAudioState?.status == .recognizing
                || bridgeController.videoAudioState?.status == .translating
            {
                Button {
                    bridgeController.stopVideoAudioTranslation()
                } label: {
                    Image(systemName: "stop.circle")
                }
                .accessibilityLabel("停止听音翻译")
                .accessibilityIdentifier("video-audio-stop")
            } else {
                Button {
                    bridgeController.requestVideoAudioPrivacyPrompt()
                    showsVideoAudioPrivacy = true
                } label: {
                    Label("听音", systemImage: "waveform.badge.magnifyingglass")
                }
                .accessibilityLabel("开启听音翻译")
                .accessibilityIdentifier("video-audio-entry")
            }

            Button {
                bridgeController.closeVideoAudioTranslation()
            } label: {
                Image(systemName: "xmark.circle")
            }
            .accessibilityLabel("关闭听音翻译")
            .accessibilityIdentifier("video-audio-close")
        }
        .font(.headline)
        .padding(.horizontal, 18)
        .padding(.vertical, 11)
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

    private var videoCaptionStatusBar: some View {
        HStack(spacing: 8) {
            Image(systemName: videoStatusIconName)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.blue)

            Text(videoAudioSourceLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.blue)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(Color.blue.opacity(0.12))
                .clipShape(Capsule())
                .accessibilityIdentifier("video-audio-source")

            Text(videoStatusText)
                .font(.footnote)
                .lineLimit(1)
                .truncationMode(.middle)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("video-audio-status")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.blue.opacity(0.08))
    }

    private var videoStatusIconName: String {
        if let audioStatus = bridgeController.videoAudioState?.status {
            switch audioStatus {
            case .recognizing, .translating:
                return "waveform"
            case .quotaExhausted, .failed:
                return "exclamationmark.bubble"
            case .translated:
                return "captions.bubble.fill"
            case .idle, .privacyRequired, .captionPrimary, .stopped, .closed:
                break
            }
        }

        switch bridgeController.videoCaptionState?.status {
        case .translated:
            return "captions.bubble.fill"
        case .translating, .detecting:
            return "waveform"
        case .captionUnavailable, .failed, .fallback:
            return "exclamationmark.bubble"
        case .captionAvailable:
            return "captions.bubble"
        case .none:
            return "captions.bubble"
        }
    }

    private var videoStatusText: String {
        if let audioState = bridgeController.videoAudioState {
            switch audioState.status {
            case .idle:
                return audioState.message ?? "听音翻译 Beta 可开启"
            case .privacyRequired:
                return audioState.message ?? "开启前请确认听音翻译隐私提示"
            case .captionPrimary:
                return "字幕可用，优先使用字幕翻译"
            case .recognizing:
                return "听音识别中 · Beta"
            case .translating:
                return "听音翻译中 · Beta"
            case .translated:
                return "听音翻译完成 · 可继续刷视频"
            case .quotaExhausted:
                return "今日听音分钟已用完"
            case .stopped:
                return "听音翻译已停止"
            case .closed:
                return "听音翻译已关闭"
            case .failed:
                return audioState.message ?? "听音翻译暂不可用"
            }
        }

        guard let state = bridgeController.videoCaptionState else {
            return "video.ready · YouTube"
        }

        switch state.status {
        case .detecting:
            return "字幕识别中 · YouTube"
        case .captionAvailable:
            return "字幕已识别 · 等待翻译"
        case .captionUnavailable:
            return state.message ?? "当前视频没有检测到可用字幕"
        case .translating:
            return "字幕翻译中 · \(state.activeSegment?.sourceText ?? "YouTube")"
        case .translated:
            return "字幕已翻译 · 可收藏当前句"
        case .failed:
            return state.message ?? "字幕翻译暂不可用"
        case .fallback:
            return state.message ?? "已切换到降级字幕条"
        }
    }

    private var videoAudioSourceLabel: String {
        switch bridgeController.videoAudioState?.source {
        case .audio:
            return "听音 Beta"
        case .caption:
            return "字幕"
        case .none:
            return bridgeController.videoCaptionState?.captionAvailability == .available ? "字幕" : "听音 Beta"
        }
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
