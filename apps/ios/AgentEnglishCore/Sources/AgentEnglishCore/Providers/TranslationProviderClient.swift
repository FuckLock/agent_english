import Foundation

public struct TranslationProviderClientConfiguration: Sendable { public init() {} }

public actor TranslationProviderClient {
    private let modelServiceClient: ModelServiceClient
    public init(modelServiceClient: ModelServiceClient = ModelServiceClient(), configuration: TranslationProviderClientConfiguration = .init()) {
        _ = configuration
        self.modelServiceClient = modelServiceClient
    }
    public func translate(_ request: TranslationRequest, preferences: TranslationPreferencesSnapshot) async -> TranslationResult {
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
        }
    }
}
