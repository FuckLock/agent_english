import SwiftUI
import WebKit

final class WebNavigationState: ObservableObject {
    @Published var title = "网页"
    @Published var currentURLText = ""
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var isLoading = false
}

#if os(iOS)
struct WebViewContainer: UIViewRepresentable {
    let initialURL: URL
    @ObservedObject var navigationState: WebNavigationState
    let bridgeController: WebBridgeController
    let onWebViewReady: (WKWebView) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(navigationState: navigationState)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        userContentController.addUserScript(BrowserAgentBootstrapScript.makeUserScript())
        userContentController.add(
            bridgeController,
            name: WebBridgeController.messageHandlerName
        )
        configuration.userContentController = userContentController
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: initialURL))
        onWebViewReady(webView)

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.navigationState = navigationState
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: WebBridgeController.messageHandlerName
        )
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var navigationState: WebNavigationState

        init(navigationState: WebNavigationState) {
            self.navigationState = navigationState
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            updateState(from: webView, isLoading: true)
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            updateState(from: webView, isLoading: true)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            updateState(from: webView, isLoading: false)
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            updateState(from: webView, isLoading: false)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            updateState(from: webView, isLoading: false)
        }

        private func updateState(from webView: WKWebView, isLoading: Bool) {
            navigationState.title = webView.title?.isEmpty == false ? webView.title ?? "网页" : "网页"
            navigationState.currentURLText = webView.url?.absoluteString ?? ""
            navigationState.canGoBack = webView.canGoBack
            navigationState.canGoForward = webView.canGoForward
            navigationState.isLoading = isLoading
        }
    }
}
#else
struct WebViewContainer: View {
    let initialURL: URL
    @ObservedObject var navigationState: WebNavigationState
    let bridgeController: WebBridgeController
    let onWebViewReady: (WKWebView) -> Void

    var body: some View {
        ContentUnavailableView(
            "iOS WebView",
            systemImage: "iphone",
            description: Text(initialURL.absoluteString)
        )
        .onAppear {
            navigationState.currentURLText = initialURL.absoluteString
        }
    }
}
#endif
