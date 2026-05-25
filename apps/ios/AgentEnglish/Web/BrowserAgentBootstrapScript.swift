import Foundation
import WebKit

enum BrowserAgentBootstrapScript {
    @MainActor
    static func makeUserScript(handlerName: String = WebBridgeController.messageHandlerName) -> WKUserScript {
        WKUserScript(
            source: makeSource(handlerName: handlerName),
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
    }

    private static func makeSource(handlerName: String) -> String {
        BrowserAgentRuntimeSource.source.replacingOccurrences(
            of: "__HANDLER_NAME__",
            with: handlerName
        )
    }
}
