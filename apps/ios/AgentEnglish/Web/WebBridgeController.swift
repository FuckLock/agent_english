#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation
import SwiftUI
import WebKit

final class WebBridgeController: NSObject, ObservableObject, WKScriptMessageHandler {
    nonisolated static let messageHandlerName = "agentEnglishBridge"

    @Published private(set) var lastEventSummary = "等待页面握手"
    @Published private(set) var recentEventSummaries: [String] = []

    private let decoder = BridgeEventDecoder()

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        do {
            let data = try jsonData(from: message.body)
            let event = try decoder.decode(data)
            record(event)
        } catch {
            recordDecodeFailure(error)
        }
    }

    private func jsonData(from body: Any) throws -> Data {
        if let data = body as? Data {
            return data
        }

        if let text = body as? String {
            return Data(text.utf8)
        }

        guard JSONSerialization.isValidJSONObject(body) else {
            throw BridgeEventDecodingError.malformedPayload("Message body is not valid JSON.")
        }

        return try JSONSerialization.data(withJSONObject: body)
    }

    private func record(_ event: BridgeEvent) {
        let summary: String

        switch event.payload {
        case .boot(let payload):
            summary = "\(event.eventType.rawValue) · \(payload.bridgeScope)"
        case .ping(let payload):
            summary = "\(event.eventType.rawValue) · \(payload.sentAt)"
        case .pageReady(let payload):
            summary = "\(event.eventType.rawValue) · \(payload.title.isEmpty ? payload.url : payload.title)"
        }

        lastEventSummary = summary
        recentEventSummaries.insert(summary, at: 0)
        recentEventSummaries = Array(recentEventSummaries.prefix(4))
    }

    private func recordDecodeFailure(_ error: Error) {
        let summary = "bridge.decode.failed · \(error)"
        lastEventSummary = summary
        recentEventSummaries.insert(summary, at: 0)
        recentEventSummaries = Array(recentEventSummaries.prefix(4))
    }
}
