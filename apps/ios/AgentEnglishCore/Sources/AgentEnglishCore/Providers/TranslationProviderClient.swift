import Foundation

public struct TranslationProviderClientConfiguration: Sendable { public init() {} }

// 文本翻译统一走 model-gateway（v2.13 / ADR-0007）：所有档位（含 Free）都用 model-gateway
// 的 registry 模型，Free 只是权限档位低、用 free 档默认模型（如 deepseek-chat）。
// translation-proxy 已退役——代码保留、不再路由（撤销 ADR-0005 的 Free-via-proxy / 故障隔离）。
// 授权事实源是后端 session 派生的 entitlement 快照（preferences.serviceTier）；
// 本层只做编排与错误映射，不重新校验后端授权（后端是事实源）。
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
        // 所有档位统一走 model-gateway（Free 用 registry 的 free 档模型）；proxy 已退役不再路由。
        _ = translationProxyClient
        return await translateViaModelGateway(request, preferences: preferences)
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
