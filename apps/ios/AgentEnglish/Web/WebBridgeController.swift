#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation
import SwiftData
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

    @Published var lastEventSummary = "等待页面握手"
    @Published var recentEventSummaries: [String] = []
    @Published var translationStatus: TranslationStatus = .idle
    @Published var translationFailure: TranslationFailureReason?
    @Published var displayMode: DisplayMode = .original
    @Published var explanationSheet: ExplanationSheetPresentation?

    let decoder = BridgeEventDecoder()
    let providerClient: TranslationProviderClient
    let explanationProviderClient: ExplanationProviderClient
    let createdAtFormatter = ISO8601DateFormatter()

    var cacheStore: TranslationCacheStore?
    var providerSettingsStore: TranslationProviderSettingsStore?
    var savedItemRepository: SavedItemRepository?
    weak var webView: WKWebView?

    init(
        providerClient: TranslationProviderClient = TranslationProviderClient(),
        explanationProviderClient: ExplanationProviderClient = ExplanationProviderClient(),
        cacheStore: TranslationCacheStore? = nil,
        providerSettingsStore: TranslationProviderSettingsStore? = nil,
        savedItemRepository: SavedItemRepository? = nil
    ) {
        self.providerClient = providerClient
        self.explanationProviderClient = explanationProviderClient
        self.cacheStore = cacheStore
        self.providerSettingsStore = providerSettingsStore
        self.savedItemRepository = savedItemRepository
    }

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func configure(modelContext: ModelContext) {
        if cacheStore == nil {
            cacheStore = TranslationCacheStore(modelContext: modelContext)
        }

        if providerSettingsStore == nil {
            providerSettingsStore = TranslationProviderSettingsStore(modelContext: modelContext)
        }

        if savedItemRepository == nil {
            savedItemRepository = SavedItemRepository(modelContext: modelContext)
        }
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
}
