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
    @Published var isSummonMenuPresented = false
    @Published var videoBackRequestCount = 0

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
    // Phase 8.13：无字幕轨自动切听音——按 videoId + 段桶 audioSegmentId 去重，避免同段重复 POST 后端 / 耗额度。
    var videoAudioDispatchedSegments = Set<String>()
    // 字幕翻译分块滑窗预取（修翻译跟不上）：整轨单批必撞 gateway 双闸（总字符 >1800 →
    // content-too-long；配额按句计、单请求超档位上限 → quota-exceeded），改为按原始句序
    // 切块、只预翻「当前块 + 下一块」。命中缓存 "videoId\n原文" → 译文直接显示双语；
    // 未命中回退单句翻。块状态随视频切换整体重置。
    var videoCaptionTranslationCache: [String: String] = [:]
    var videoCaptionPrefetchedVideoId: String?
    var videoCaptionChunks: [[String]] = []
    var videoCaptionChunkRequested = Set<Int>()
    var videoCaptionChunkAttempts: [Int: Int] = [:]
    var videoCaptionChunkInFlightCount = 0

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
