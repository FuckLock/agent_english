#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftUI
import WebKit

struct WebBrowserView: View {
    let initialURL: URL

    @StateObject private var navigationState = WebNavigationState()
    @StateObject private var bridgeController = WebBridgeController()
    @State private var webView: WKWebView?

    var body: some View {
        VStack(spacing: 0) {
            urlStatusBar

            WebViewContainer(
                initialURL: initialURL,
                navigationState: navigationState,
                bridgeController: bridgeController,
                onWebViewReady: { webView = $0 }
            )
            .background(Color.clear)

            browserToolbar
            bridgeStatusBar
        }
        .navigationTitle(navigationState.title)
    }

    private var urlStatusBar: some View {
        HStack(spacing: 8) {
            Image(systemName: navigationState.isLoading ? "arrow.triangle.2.circlepath" : "lock")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            Text(navigationState.currentURLText.isEmpty ? initialURL.absoluteString : navigationState.currentURLText)
                .font(.caption)
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

            Button {} label: {
                Label("翻译", systemImage: "character.bubble")
            }
            .disabled(true)
            .accessibilityLabel("翻译")
        }
        .font(.headline)
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(.bar)
    }

    private var bridgeStatusBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.purple)

            Text(bridgeController.lastEventSummary)
                .font(.caption2)
                .lineLimit(1)
                .truncationMode(.middle)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.purple.opacity(0.08))
    }
}
