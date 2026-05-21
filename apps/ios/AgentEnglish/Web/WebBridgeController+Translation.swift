#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation
import WebKit

extension WebBridgeController {
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
                    self.pushSummary("bridge.command.failed · encode")
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

    func handleTranslationRequest(_ request: TranslationRequest) {
        translationStatus = .loading
        translationFailure = nil

        Task { [weak self] in
            guard let self else {
                return
            }

            if let cachedResult = await self.cachedResult(for: request) {
                await MainActor.run {
                    self.applyTranslationResult(cachedResult)
                    self.pushSummary("translation.completed · cache")
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

    func cachedResult(for request: TranslationRequest) async -> TranslationResult? {
        await MainActor.run {
            do {
                return try cacheStore?.cachedResult(for: request)
            } catch {
                pushSummary("translation.cache.failed · \(error.localizedDescription)")
                return nil
            }
        }
    }

    func currentTranslationPreferences() async -> TranslationPreferencesSnapshot {
        await MainActor.run {
            do {
                return try providerSettingsStore?.loadPreferences()
                    ?? TranslationPreferencesSnapshot(
                        sourceLanguage: "English",
                        targetLanguage: "简体中文",
                        credentialReference: nil
                    )
            } catch {
                pushSummary("translation.settings.failed · \(error.localizedDescription)")
                return TranslationPreferencesSnapshot(
                    sourceLanguage: "English",
                    targetLanguage: "简体中文",
                    credentialReference: nil
                )
            }
        }
    }

    func applyTranslationResult(_ translationResult: TranslationResult) {
        displayMode = translationResult.displayMode
        translationStatus = .translated
        translationFailure = nil

        if let payload = jsonString(translationResult) {
            evaluateBridgeCommand(named: "applyTranslationResult", argument: payload)
        }
    }

    func applyTranslationFailure(_ payload: TranslationFailurePayload) {
        translationStatus = .failed(payload.failureReason)
        translationFailure = payload.failureReason

        if let encodedPayload = jsonString(payload) {
            evaluateBridgeCommand(named: "applyTranslationFailure", argument: encodedPayload)
        }
    }

    func evaluateBridgeCommand(named name: String, argument: String) {
        let command = "__agentEnglishBridge.\(name)(\(argument))"

        webView?.evaluateJavaScript(command) { [weak self] _, error in
            guard let self, let error else {
                return
            }

            self.pushSummary("bridge.command.failed · \(error.localizedDescription)")
            self.translationStatus = .failed(.translationFailed)
            self.translationFailure = .translationFailed
        }
    }
}

struct TranslationCommandPayload: Encodable {
    let sourceLanguage: String
    let targetLanguage: String
    let displayMode: String
}
