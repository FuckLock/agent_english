#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation
import SwiftUI
import WebKit

enum TranslationStatus: Equatable {
    case idle
    case loading
    case translated
    case failed(TranslationFailureReason)
}

final class WebBridgeController: NSObject, ObservableObject, WKScriptMessageHandler {
    nonisolated static let messageHandlerName = "agentEnglishBridge"

    @Published private(set) var lastEventSummary = "等待页面握手"
    @Published private(set) var recentEventSummaries: [String] = []
    @Published private(set) var translationStatus: TranslationStatus = .idle
    @Published private(set) var translationFailure: TranslationFailureReason?
    @Published private(set) var displayMode: DisplayMode = .original

    private let decoder = BridgeEventDecoder()
    private let providerClient: TranslationProviderClient
    private let cacheStore: TranslationCacheStore?
    private let providerSettingsStore: TranslationProviderSettingsStore?
    private weak var webView: WKWebView?

    init(
        providerClient: TranslationProviderClient = TranslationProviderClient(),
        cacheStore: TranslationCacheStore? = MainActor.assumeIsolated {
            try? TranslationCacheStore.makeDefault()
        },
        providerSettingsStore: TranslationProviderSettingsStore? = MainActor.assumeIsolated {
            try? TranslationProviderSettingsStore.makeDefault()
        },
    ) {
        self.providerClient = providerClient
        self.cacheStore = cacheStore
        self.providerSettingsStore = providerSettingsStore
    }

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func requestTranslation() {
        translationStatus = .loading
        translationFailure = nil
        let requestedDisplayMode: DisplayMode = displayMode == .original ? .bilingual : displayMode
        displayMode = requestedDisplayMode

        Task { [weak self] in
            guard let self else {
                return
            }

            let preferences = await self.currentTranslationPreferences()

            await MainActor.run {
                guard
                    let payload = self.jsonString(
                        TranslationCommandPayload(
                            sourceLanguage: preferences.sourceLanguage,
                            targetLanguage: preferences.targetLanguage,
                            displayMode: requestedDisplayMode.rawValue
                        )
                    )
                else {
                    self.translationStatus = .failed(.translationFailed)
                    self.translationFailure = .translationFailed
                    self.lastEventSummary = "bridge.command.failed · encode"
                    return
                }

                self.evaluateBridgeCommand(named: "requestTranslation", argument: payload)
            }
        }
    }

    func setDisplayMode(_ newMode: DisplayMode) {
        displayMode = newMode
        evaluateBridgeCommand(named: "setDisplayMode", argument: "\"\(newMode.rawValue)\"")
    }

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
        }

        lastEventSummary = summary
        recentEventSummaries.insert(summary, at: 0)
        recentEventSummaries = Array(recentEventSummaries.prefix(6))
    }

    private func recordDecodeFailure(_ error: Error) {
        let summary = "bridge.decode.failed · \(error)"
        lastEventSummary = summary
        recentEventSummaries.insert(summary, at: 0)
        recentEventSummaries = Array(recentEventSummaries.prefix(6))
    }

    private func handleTranslationRequest(_ request: TranslationRequest) {
        translationStatus = .loading
        translationFailure = nil

        Task { [weak self] in
            guard let self else {
                return
            }

            if let cachedResult = await self.cachedResult(for: request) {
                await MainActor.run {
                    self.applyTranslationResult(cachedResult)
                    self.lastEventSummary = "translation.completed · cache"
                }
                return
            }

            let credentialReference = await self.currentTranslationPreferences().credentialReference
            let translationResult = await self.providerClient.translate(
                request,
                credentialReference: credentialReference
            )

            await MainActor.run {
                if translationResult.segmentResults.contains(where: { $0.translatedText?.isEmpty == false }) {
                    try? self.cacheStore?.store(translationResult, for: request)
                    self.applyTranslationResult(translationResult)
                } else {
                    self.applyTranslationFailure(
                        TranslationFailurePayload(
                            pageId: request.pageId,
                            segmentId: request.segments.first?.segmentId,
                            sourceLanguage: request.sourceLanguage,
                            targetLanguage: request.targetLanguage,
                            displayMode: request.displayMode,
                            capabilities: request.capabilities,
                            failureReason: translationResult.failureReason ?? .translationFailed
                        )
                    )
                }
            }
        }
    }

    private func cachedResult(for request: TranslationRequest) async -> TranslationResult? {
        await MainActor.run {
            do {
                return try cacheStore?.cachedResult(for: request)
            } catch {
                lastEventSummary = "translation.cache.failed · \(error.localizedDescription)"
                return nil
            }
        }
    }

    private func currentTranslationPreferences() async -> TranslationPreferencesSnapshot {
        await MainActor.run {
            do {
                return try providerSettingsStore?.loadPreferences()
                    ?? TranslationPreferencesSnapshot(
                        sourceLanguage: "English",
                        targetLanguage: "简体中文",
                        credentialReference: nil
                    )
            } catch {
                lastEventSummary = "translation.settings.failed · \(error.localizedDescription)"
                return TranslationPreferencesSnapshot(
                    sourceLanguage: "English",
                    targetLanguage: "简体中文",
                    credentialReference: nil
                )
            }
        }
    }

    private func applyTranslationResult(_ translationResult: TranslationResult) {
        displayMode = translationResult.displayMode
        translationStatus = .translated
        translationFailure = nil

        if let payload = jsonString(translationResult) {
            evaluateBridgeCommand(named: "applyTranslationResult", argument: payload)
        }
    }

    private func applyTranslationFailure(_ payload: TranslationFailurePayload) {
        translationStatus = .failed(payload.failureReason)
        translationFailure = payload.failureReason

        if let encodedPayload = jsonString(payload) {
            evaluateBridgeCommand(named: "applyTranslationFailure", argument: encodedPayload)
        }
    }

    private func evaluateBridgeCommand(named name: String, argument: String) {
        let command = "__agentEnglishBridge.\(name)(\(argument))"

        webView?.evaluateJavaScript(command) { [weak self] _, error in
            guard let self, let error else {
                return
            }

            self.lastEventSummary = "bridge.command.failed · \(error.localizedDescription)"
            self.translationStatus = .failed(.translationFailed)
            self.translationFailure = .translationFailed
        }
    }

    private func jsonString<Value: Encodable>(_ value: Value) -> String? {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(value) else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }
}

private struct TranslationCommandPayload: Encodable {
    let sourceLanguage: String
    let targetLanguage: String
    let displayMode: String
}
