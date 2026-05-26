import Foundation

public struct TranslationProviderClientConfiguration: Sendable { public init() {} }

// 按 session entitlement 分流文本翻译：
//   Free  → translation-proxy（轻量翻译代理转发第三方通用翻译，独立于大模型 gateway）
//   Pro/Max → model-gateway（/v1/translate）
// 授权事实源是后端 session 派生的 entitlement 快照（preferences.serviceTier）；
// 本层只做路由编排与错误映射，不重新校验后端授权（后端是事实源）。
public actor TranslationProviderClient {
    private let modelServiceClient: ModelServiceClient
    private let translationProxyClient: TranslationProxyClient

    public init(
        modelServiceClient: ModelServiceClient = ModelServiceClient(),
        translationProxyClient: TranslationProxyClient = TranslationProxyClient(),
        configuration: TranslationProviderClientConfiguration = .init()
    ) {
        _ = configuration
        self.modelServiceClient = modelServiceClient
        self.translationProxyClient = translationProxyClient
    }

    public func translate(
        _ request: TranslationRequest,
        preferences: TranslationPreferencesSnapshot
    ) async -> TranslationResult {
        switch preferences.serviceTier {
        case .free:
            return await translationProxyClient.translate(request)
        case .pro, .max:
            return await translateViaModelGateway(request, preferences: preferences)
        }
    }

    private func translateViaModelGateway(
        _ request: TranslationRequest,
        preferences: TranslationPreferencesSnapshot
    ) async -> TranslationResult {
        let response = await modelServiceClient.translate(
            ModelServiceTranslateRequest(
                pageID: request.pageId,
                sourceLanguage: request.sourceLanguage,
                targetLanguage: request.targetLanguage,
                serviceTier: preferences.serviceTier,
                preferredModelID: preferences.preferredModelID,
                segments: request.segments.map { .init(segmentID: $0.segmentId, sourceText: $0.sourceText) }
            )
        )
        let segmentResults = response.segmentResults.map {
            TranslationSegmentResult(
                segmentId: $0.segmentID,
                translatedText: $0.translatedText,
                failureReason: $0.errorCode.flatMap(mapErrorCode(_:))
            )
        }
        let resultsBySegmentId = Dictionary(uniqueKeysWithValues: segmentResults.map { ($0.segmentId, $0) })
        let failureReason = response.error.map { mapErrorCode($0.code) } ?? segmentResults.first(where: { $0.failureReason != nil })?.failureReason
        return TranslationResult(pageId: request.pageId, sourceLanguage: request.sourceLanguage, targetLanguage: request.targetLanguage, displayMode: request.displayMode, capabilities: request.capabilities, segmentResults: segmentResults, resultsBySegmentId: resultsBySegmentId, failureReason: failureReason)
    }

    private func mapErrorCode(_ code: ModelServiceErrorCode) -> TranslationFailureReason {
        switch code {
        case .quotaExceeded: return .quotaExceeded
        case .tierUnavailable: return .tierUnavailable
        case .serviceUnavailable: return .serviceUnavailable
        case .contentTooLong: return .contentTooLong
        case .providerFallbackFailed: return .providerFallbackFailed
        case .privacyDisclosureRequired: return .translationFailed
        }
    }
}
