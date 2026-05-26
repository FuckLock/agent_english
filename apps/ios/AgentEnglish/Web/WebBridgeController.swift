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
    @Published var videoCaptionState: VideoCaptionOverlayState?
    @Published var videoAudioState: VideoAudioTranslationState?
    @Published var videoAudioPrivacyAcknowledged = false

    let decoder = BridgeEventDecoder()
    let providerClient: TranslationProviderClient
    let explanationProviderClient: ExplanationProviderClient
    let modelServiceClient: ModelServiceClient
    let createdAtFormatter = ISO8601DateFormatter()

    var cacheStore: TranslationCacheStore?
    var modelServiceSettingsStore: ModelServiceSettingsStore?
    var savedItemRepository: SavedItemRepository?
    var historyRepository: HistoryRepository?
    var statisticsRepository: StatisticsRepository?
    weak var webView: WKWebView?
    var videoCaptionTranslationKeys = Set<String>()
    var videoAudioDispatchCount = 0

    init(
        providerClient: TranslationProviderClient = TranslationProviderClient(),
        explanationProviderClient: ExplanationProviderClient = ExplanationProviderClient(),
        modelServiceClient: ModelServiceClient = ModelServiceClient(),
        cacheStore: TranslationCacheStore? = nil,
        modelServiceSettingsStore: ModelServiceSettingsStore? = nil,
        savedItemRepository: SavedItemRepository? = nil,
        historyRepository: HistoryRepository? = nil,
        statisticsRepository: StatisticsRepository? = nil
    ) {
        self.providerClient = providerClient
        self.explanationProviderClient = explanationProviderClient
        self.modelServiceClient = modelServiceClient
        self.cacheStore = cacheStore
        self.modelServiceSettingsStore = modelServiceSettingsStore
        self.savedItemRepository = savedItemRepository
        self.historyRepository = historyRepository
        self.statisticsRepository = statisticsRepository
    }

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func configure(modelContext: ModelContext) {
        if cacheStore == nil {
            cacheStore = TranslationCacheStore(modelContext: modelContext)
        }

        if modelServiceSettingsStore == nil {
            modelServiceSettingsStore = ModelServiceSettingsStore(modelContext: modelContext)
        }

        if savedItemRepository == nil {
            savedItemRepository = SavedItemRepository(modelContext: modelContext)
        }

        if historyRepository == nil {
            historyRepository = HistoryRepository(modelContext: modelContext)
        }

        if statisticsRepository == nil {
            statisticsRepository = StatisticsRepository(modelContext: modelContext)
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
