#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation

extension WebBridgeController {
    func jsonData(from body: Any) throws -> Data {
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

    func record(_ event: BridgeEvent) {
        let summary: String

        switch event.payload {
        case .boot(let payload):
            summary = "\(event.eventType.rawValue) · \(payload.bridgeScope)"
        case .ping(let payload):
            summary = "\(event.eventType.rawValue) · \(payload.sentAt)"
        case .pageReady(let payload):
            summary = "\(event.eventType.rawValue) · \(payload.title.isEmpty ? payload.url : payload.title)"
            recordPageReady(payload)
        case .translationRequested(let payload):
            summary = "\(event.eventType.rawValue) · \(payload.segments.count)"
            handleTranslationRequest(payload)
        case .translationCompleted(let payload):
            displayMode = payload.displayMode
            translationStatus = .translated
            translationFailure = nil
            summary = "\(event.eventType.rawValue) · \(payload.segmentResults.count)"
        case .translationFailed(let payload):
            translationStatus = .failed(payload.failureReason)
            translationFailure = payload.failureReason
            summary = "\(event.eventType.rawValue) · \(payload.failureReason.rawValue)"
        case .selectionRequested(let payload):
            explanationSheet = .loading(selection: payload)
            summary = "\(event.eventType.rawValue) · \(payload.kind.rawValue)"
            handleSelectionRequest(payload)
        case .selectionExplanationCompleted(let payload):
            explanationSheet = .ready(
                result: payload,
                isFavoriteSaved: (try? savedItemRepository?.contains(
                    selectedText: payload.selectedText,
                    sourceUrl: payload.sourceUrl,
                    contextBefore: payload.contextBefore,
                    contextAfter: payload.contextAfter
                )) ?? false
            )
            summary = "\(event.eventType.rawValue) · \(payload.kind.rawValue)"
        case .selectionExplanationFailed(let payload):
            explanationSheet = .failed(
                selection: payload.asSelectionRequest(),
                failureReason: payload.failureReason
            )
            summary = "\(event.eventType.rawValue) · \(payload.failureReason.rawValue)"
        }

        pushSummary(summary)
    }

    func recordDecodeFailure(_ error: Error) {
        pushSummary("bridge.decode.failed · \(error)")
    }

    func jsonString<Value: Encodable>(_ value: Value) -> String? {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(value) else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    func pushSummary(_ summary: String) {
        lastEventSummary = summary
        recentEventSummaries.insert(summary, at: 0)
        recentEventSummaries = Array(recentEventSummaries.prefix(6))
    }

    private func recordPageReady(_ payload: BridgePageReadyPayload) {
        guard let url = URL(string: payload.url) else {
            return
        }

        do {
            try historyRepository?.recordVisit(url: url, title: payload.title)
        } catch {
            pushSummary("history.failed · \(error.localizedDescription)")
        }
    }
}
