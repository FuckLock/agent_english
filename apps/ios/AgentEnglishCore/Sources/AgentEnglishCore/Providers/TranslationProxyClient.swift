import Foundation

// Free 文本翻译走独立的轻量翻译代理（translation-proxy），与大模型 gateway 客户端解耦。
// 端点配置独立于 MODEL_SERVICE_ROOT：使用 TRANSLATION_PROXY_ROOT，互不复用。
// 本层只做请求编排、限额错误映射与错误归一；不持有任何第三方翻译 key、不直连第三方翻译。

public enum TranslationProxyEndpointConfiguration {
    public static func resolvedURL(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        bundle: Bundle = .main
    ) -> URL? {
        if let rawURL = environment["TRANSLATION_PROXY_ROOT"], let url = validURL(from: rawURL) {
            return url
        }
        if
            let rawURL = bundle.object(forInfoDictionaryKey: "TRANSLATION_PROXY_ROOT") as? String,
            let url = validURL(from: rawURL)
        {
            return url
        }
        return nil
    }

    private static func validURL(from rawURL: String) -> URL? {
        let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }
        return URL(string: trimmed)
    }

    public static func resolvedSessionToken() throws -> String? {
        try KeychainCredentialStore.loadSessionToken()
    }
}

public struct TranslationProxySegment: Codable, Equatable, Sendable {
    public let segmentID: String
    public let sourceText: String

    public init(segmentID: String, sourceText: String) {
        self.segmentID = segmentID
        self.sourceText = sourceText
    }

    private enum CodingKeys: String, CodingKey {
        case segmentID = "segmentId"
        case sourceText
    }
}

public struct TranslationProxyTranslateRequest: Codable, Equatable, Sendable {
    public let pageID: String
    public let sourceLanguage: String
    public let targetLanguage: String
    public let segments: [TranslationProxySegment]

    public init(
        pageID: String,
        sourceLanguage: String,
        targetLanguage: String,
        segments: [TranslationProxySegment]
    ) {
        self.pageID = pageID
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.segments = segments
    }

    private enum CodingKeys: String, CodingKey {
        case pageID = "pageId"
        case sourceLanguage
        case targetLanguage
        case segments
    }
}

public struct TranslationProxySegmentResult: Codable, Equatable, Sendable {
    public let segmentID: String
    public let translatedText: String

    public init(segmentID: String, translatedText: String) {
        self.segmentID = segmentID
        self.translatedText = translatedText
    }

    private enum CodingKeys: String, CodingKey {
        case segmentID = "segmentId"
        case translatedText
    }
}

public struct TranslationProxyResponse: Codable, Equatable, Sendable {
    public let pageID: String
    public let segmentResults: [TranslationProxySegmentResult]

    public init(pageID: String, segmentResults: [TranslationProxySegmentResult]) {
        self.pageID = pageID
        self.segmentResults = segmentResults
    }

    private enum CodingKeys: String, CodingKey {
        case pageID = "pageId"
        case segmentResults
    }
}

public protocol TranslationProxyTransport: Sendable {
    func translateText(
        _ request: TranslationProxyTranslateRequest
    ) async throws -> TranslationProxyResponse
}

public actor TranslationProxyClient {
    private let transport: any TranslationProxyTransport

    public init(transport: any TranslationProxyTransport = URLSessionTranslationProxyTransport()) {
        self.transport = transport
    }

    // 归一返回：成功填充 translatedText；失败映射为 TranslationResult.failureReason。
    public func translate(_ request: TranslationRequest) async -> TranslationResult {
        do {
            let response = try await transport.translateText(
                TranslationProxyTranslateRequest(
                    pageID: request.pageId,
                    sourceLanguage: request.sourceLanguage,
                    targetLanguage: request.targetLanguage,
                    segments: request.segments.map {
                        .init(segmentID: $0.segmentId, sourceText: $0.sourceText)
                    }
                )
            )
            let resultsByID = Dictionary(
                uniqueKeysWithValues: response.segmentResults.map { ($0.segmentID, $0) }
            )
            let segmentResults = request.segments.map { segment -> TranslationSegmentResult in
                if let translated = resultsByID[segment.segmentId] {
                    return TranslationSegmentResult(
                        segmentId: segment.segmentId,
                        translatedText: translated.translatedText,
                        failureReason: nil
                    )
                }
                return TranslationSegmentResult(
                    segmentId: segment.segmentId,
                    translatedText: nil,
                    failureReason: .translationFailed
                )
            }
            let resultsBySegmentId = Dictionary(
                uniqueKeysWithValues: segmentResults.map { ($0.segmentId, $0) }
            )
            return TranslationResult(
                pageId: request.pageId,
                sourceLanguage: request.sourceLanguage,
                targetLanguage: request.targetLanguage,
                displayMode: request.displayMode,
                capabilities: request.capabilities,
                segmentResults: segmentResults,
                resultsBySegmentId: resultsBySegmentId,
                failureReason: nil
            )
        } catch {
            return failureResult(for: request, reason: mapError(error))
        }
    }

    private func mapError(_ error: Error) -> TranslationFailureReason {
        guard let proxyError = error as? TranslationProxyTransportError else {
            return .serviceUnavailable
        }
        switch proxyError.code {
        case .quotaExceeded: return .quotaExceeded
        case .providerFallbackFailed: return .providerFallbackFailed
        case .serviceUnavailable: return .serviceUnavailable
        }
    }

    private func failureResult(
        for request: TranslationRequest,
        reason: TranslationFailureReason
    ) -> TranslationResult {
        let segmentResults = request.segments.map {
            TranslationSegmentResult(
                segmentId: $0.segmentId,
                translatedText: nil,
                failureReason: reason
            )
        }
        let resultsBySegmentId = Dictionary(
            uniqueKeysWithValues: segmentResults.map { ($0.segmentId, $0) }
        )
        return TranslationResult(
            pageId: request.pageId,
            sourceLanguage: request.sourceLanguage,
            targetLanguage: request.targetLanguage,
            displayMode: request.displayMode,
            capabilities: request.capabilities,
            segmentResults: segmentResults,
            resultsBySegmentId: resultsBySegmentId,
            failureReason: reason
        )
    }
}
