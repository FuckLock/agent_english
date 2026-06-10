import Foundation

public enum ModelServiceEndpointConfiguration {
    public static func resolvedURL(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        bundle: Bundle = .main
    ) -> URL? {
        if let rawURL = environment["MODEL_SERVICE_ROOT"], let url = validURL(from: rawURL) {
            return url
        }
        if
            let rawURL = bundle.object(forInfoDictionaryKey: "MODEL_SERVICE_ROOT") as? String,
            let url = validURL(from: rawURL)
        {
            return url
        }
        #if DEBUG
        // 开发兜底：未配置 MODEL_SERVICE_ROOT 时默认连本地 model-gateway（仅 DEBUG 生效，不影响 release）。
        // 端口 4100 须与 services/model-gateway 默认端口（.env 的 MODEL_GATEWAY_PORT）一致。
        // 与 TranslationProxyClient 的 DEBUG localhost:4200 兜底同款（听音 / Pro·Max 走 model-gateway）。
        return URL(string: "http://localhost:4100")
        #else
        return nil
        #endif
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

public protocol ModelServiceTransport: Sendable {
    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot
    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse
    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse
    func videoAudioTranslate(_ request: ModelServiceVideoAudioTranslateRequest) async throws -> ModelServiceVideoAudioTranslateResponse
}

public extension ModelServiceTransport {
    func videoAudioTranslate(_ request: ModelServiceVideoAudioTranslateRequest) async throws -> ModelServiceVideoAudioTranslateResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }
}

public struct PreviewModelServiceTransport: ModelServiceTransport {
    public init() {}
    public func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        .preview(currentTier: serviceTier)
    }
    public func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        let catalog = ModelCatalogSnapshot.preview(currentTier: request.serviceTier, preferredModelID: request.preferredModelID)
        let model = catalog.option(id: catalog.defaultModelID) ?? catalog.options[0]
        return ModelServiceTranslateResponse(pageID: request.pageID, serviceTier: request.serviceTier, model: model, segmentResults: request.segments.map { .init(segmentID: $0.segmentID, translatedText: "[\(request.targetLanguage)] \($0.sourceText)", errorCode: nil) }, quota: catalog.quota, error: nil)
    }
    public func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        let catalog = ModelCatalogSnapshot.preview(currentTier: request.serviceTier, preferredModelID: request.preferredModelID)
        let model = catalog.option(id: catalog.defaultModelID) ?? catalog.options[0]
        return ModelServiceExplainResponse(pageID: request.pageID, serviceTier: request.serviceTier, model: model, translation: "中文释义：\(request.selectedText)", explanation: "这里结合前后文给出更贴近网页语境的说明。", examples: ["\(request.selectedText) can be reused in the same context."], quota: catalog.quota, error: nil)
    }
    public func videoAudioTranslate(_ request: ModelServiceVideoAudioTranslateRequest) async throws -> ModelServiceVideoAudioTranslateResponse {
        let catalog = ModelCatalogSnapshot.preview(currentTier: request.serviceTier, preferredModelID: request.preferredModelID)
        let model = catalog.option(id: catalog.defaultModelID) ?? catalog.options[0]
        let quota = AudioTranslationQuota(
            serviceTier: request.serviceTier,
            status: .ok,
            usedMinutes: 3,
            limitMinutes: catalog.audioQuota?.limit ?? 10,
            remainingMinutes: catalog.audioQuota?.remaining ?? 7,
            resetAt: catalog.audioQuota?.resetAt ?? ISO8601DateFormatter().string(from: .now.addingTimeInterval(86_400))
        )
        let segment = VideoAudioSegment(
            pageId: request.pageID,
            audioSegmentId: request.audioSegmentID,
            videoId: request.videoID,
            source: .audio,
            sourceText: "Ranking the best ice moments.",
            translatedText: "[\(request.targetLanguage)] Ranking the best ice moments.",
            sourceLanguage: request.sourceLanguage,
            targetLanguage: request.targetLanguage,
            startTimeSeconds: nil,
            endTimeSeconds: nil,
            capturedAt: ISO8601DateFormatter().string(from: .now)
        )
        let state = VideoAudioTranslationState(
            pageId: request.pageID,
            siteKind: "youtube",
            pageKind: request.url.contains("/shorts/") ? .youtubeShorts : .youtubeWatch,
            url: request.url,
            title: request.title,
            videoId: request.videoID,
            captionAvailability: .unavailable,
            source: .audio,
            overlayMode: .inlineOverlay,
            status: .translated,
            capabilities: [.audioTranslationBeta, .videoAudioTranslation],
            activeSegment: segment,
            quota: quota,
            failureReason: nil,
            message: nil,
            updatedAt: ISO8601DateFormatter().string(from: .now)
        )
        return ModelServiceVideoAudioTranslateResponse(pageID: request.pageID, serviceTier: request.serviceTier, model: model, segment: segment, quota: quota, state: state, error: nil)
    }
}

public actor ModelServiceClient {
    private let transport: any ModelServiceTransport
    public init(transport: any ModelServiceTransport = URLSessionModelServiceTransport()) {
        self.transport = transport
    }
    public func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        try await transport.catalog(for: serviceTier)
    }
    public func translate(_ request: ModelServiceTranslateRequest) async -> ModelServiceTranslateResponse {
        do {
            return try await transport.translate(request)
        } catch {
            let context = errorContext(from: error)
            return failureTranslateResponse(
                for: request,
                code: context.code,
                requiredTier: context.requiredTier
            )
        }
    }
    public func explain(_ request: ModelServiceExplainRequest) async -> ModelServiceExplainResponse {
        do {
            return try await transport.explain(request)
        } catch {
            let context = errorContext(from: error)
            return failureExplainResponse(
                for: request,
                code: context.code,
                requiredTier: context.requiredTier
            )
        }
    }
    public func videoAudioTranslate(_ request: ModelServiceVideoAudioTranslateRequest) async -> ModelServiceVideoAudioTranslateResponse {
        guard request.privacyDisclosureAccepted else {
            return failureVideoAudioResponse(
                for: request,
                code: .privacyDisclosureRequired,
                requiredTier: nil
            )
        }

        do {
            return try await transport.videoAudioTranslate(request)
        } catch {
            let context = errorContext(from: error)
            return failureVideoAudioResponse(
                for: request,
                code: context.code,
                requiredTier: context.requiredTier
            )
        }
    }
    public static func userMessage(for code: ModelServiceErrorCode) -> String {
        switch code {
        case .quotaExceeded: return "今日额度不足，请稍后再试。"
        case .tierUnavailable: return "当前服务等级暂不可用，请升级后再试。"
        case .serviceUnavailable: return "模型服务暂不可用，请稍后重试。"
        case .contentTooLong: return "本次内容过长，请缩短后再试。"
        case .providerFallbackFailed: return "模型服务暂不可用，请稍后重试。"
        case .privacyDisclosureRequired: return "开启听音翻译前，请先确认隐私提示。"
        }
    }
    private func errorContext(from error: Error) -> (
        code: ModelServiceErrorCode,
        requiredTier: ModelServiceTier?
    ) {
        if let serviceError = error as? ModelServiceTransportError {
            return (serviceError.code, serviceError.requiredTier)
        }
        return (.serviceUnavailable, nil)
    }
    private func failureTranslateResponse(
        for request: ModelServiceTranslateRequest,
        code: ModelServiceErrorCode,
        requiredTier: ModelServiceTier?
    ) -> ModelServiceTranslateResponse {
        let catalog = ModelCatalogSnapshot.preview(currentTier: request.serviceTier, preferredModelID: request.preferredModelID)
        let model = catalog.option(id: catalog.defaultModelID) ?? catalog.options[0]
        return ModelServiceTranslateResponse(pageID: request.pageID, serviceTier: request.serviceTier, model: model, segmentResults: request.segments.map { .init(segmentID: $0.segmentID, translatedText: nil, errorCode: code) }, quota: catalog.quota, error: .init(code: code, message: Self.userMessage(for: code), retryable: code != .tierUnavailable && code != .contentTooLong, requiredTier: requiredTier))
    }
    private func failureExplainResponse(
        for request: ModelServiceExplainRequest,
        code: ModelServiceErrorCode,
        requiredTier: ModelServiceTier?
    ) -> ModelServiceExplainResponse {
        let catalog = ModelCatalogSnapshot.preview(currentTier: request.serviceTier, preferredModelID: request.preferredModelID)
        let model = catalog.option(id: catalog.defaultModelID) ?? catalog.options[0]
        return ModelServiceExplainResponse(pageID: request.pageID, serviceTier: request.serviceTier, model: model, translation: "", explanation: "", examples: [], quota: catalog.quota, error: .init(code: code, message: Self.userMessage(for: code), retryable: code != .tierUnavailable && code != .contentTooLong, requiredTier: requiredTier))
    }
    private func failureVideoAudioResponse(
        for request: ModelServiceVideoAudioTranslateRequest,
        code: ModelServiceErrorCode,
        requiredTier: ModelServiceTier?
    ) -> ModelServiceVideoAudioTranslateResponse {
        let catalog = ModelCatalogSnapshot.preview(currentTier: request.serviceTier, preferredModelID: request.preferredModelID)
        let model = catalog.option(id: catalog.defaultModelID) ?? catalog.options[0]
        let quotaSnapshot = catalog.audioQuota ?? ModelCatalogSnapshot.previewAudioQuota(for: request.serviceTier)
        let quota = AudioTranslationQuota(
            serviceTier: request.serviceTier,
            status: quotaSnapshot.status,
            usedMinutes: quotaSnapshot.used,
            limitMinutes: quotaSnapshot.limit,
            remainingMinutes: quotaSnapshot.remaining,
            resetAt: quotaSnapshot.resetAt
        )
        let state = VideoAudioTranslationState(
            pageId: request.pageID,
            siteKind: "youtube",
            pageKind: request.url.contains("/shorts/") ? .youtubeShorts : .youtubeWatch,
            url: request.url,
            title: request.title,
            videoId: request.videoID,
            captionAvailability: .unavailable,
            source: .audio,
            overlayMode: .inlineOverlay,
            status: code == .privacyDisclosureRequired ? .privacyRequired : code == .quotaExceeded ? .quotaExhausted : .failed,
            capabilities: [.audioTranslationBeta, .videoAudioTranslation],
            activeSegment: nil,
            quota: quota,
            failureReason: videoAudioFailureReason(for: code),
            message: Self.userMessage(for: code),
            updatedAt: ISO8601DateFormatter().string(from: .now)
        )
        return ModelServiceVideoAudioTranslateResponse(
            pageID: request.pageID,
            serviceTier: request.serviceTier,
            model: model,
            segment: nil,
            quota: quota,
            state: state,
            error: .init(
                code: code,
                message: Self.userMessage(for: code),
                retryable: code != .tierUnavailable && code != .contentTooLong && code != .privacyDisclosureRequired,
                requiredTier: requiredTier
            )
        )
    }

    private func videoAudioFailureReason(for code: ModelServiceErrorCode) -> VideoAudioFailureReason {
        switch code {
        case .quotaExceeded: return .audioQuotaExceeded
        case .tierUnavailable: return .tierUnavailable
        case .serviceUnavailable: return .serviceUnavailable
        case .contentTooLong: return .contentTooLong
        case .providerFallbackFailed: return .providerFallbackFailed
        case .privacyDisclosureRequired: return .privacyDisclosureRequired
        }
    }
}

public struct URLSessionModelServiceTransport: ModelServiceTransport {
    private let serviceRoot: URL?
    private let session: URLSession
    private let tokenProvider: @Sendable () throws -> String?
    public init(
        serviceRoot: URL? = ModelServiceEndpointConfiguration.resolvedURL(),
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () throws -> String? = {
            try ModelServiceEndpointConfiguration.resolvedSessionToken()
        }
    ) {
        self.serviceRoot = serviceRoot
        self.session = session
        self.tokenProvider = tokenProvider
    }
    public func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        _ = serviceTier
        return try await send(path: "/v1/model-catalog", method: "GET", body: Optional<String>.none)
    }
    public func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        try await send(path: "/v1/translate", method: "POST", body: request)
    }
    public func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        try await send(path: "/v1/explain", method: "POST", body: request)
    }
    public func videoAudioTranslate(_ request: ModelServiceVideoAudioTranslateRequest) async throws -> ModelServiceVideoAudioTranslateResponse {
        try await send(path: "/v1/video-audio-translate", method: "POST", body: request)
    }
    private func send<TBody: Encodable, TResponse: Decodable>(path: String, method: String, body: TBody?) async throws -> TResponse {
        guard let serviceRoot else {
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }

        let encodedBody = try body.map { try JSONEncoder().encode($0) }
        let sessionToken = try await resolvedRequestSessionToken(serviceRoot: serviceRoot)
        var (data, httpResponse) = try await perform(
            path: path,
            method: method,
            encodedBody: encodedBody,
            sessionToken: sessionToken,
            serviceRoot: serviceRoot
        )

        // 401 = session 失效（gateway session 存内存，重启即丢）：换发 guest session 后原请求
        // 重试一次。只认 401——503 是服务真不可用，换 token 解决不了；且不能在 503 时清登录态。
        if httpResponse.statusCode == 401 {
            let refreshedToken = try await refreshedGuestSessionToken(
                serviceRoot: serviceRoot,
                staleSessionToken: sessionToken
            )
            (data, httpResponse) = try await perform(
                path: path,
                method: method,
                encodedBody: encodedBody,
                sessionToken: refreshedToken,
                serviceRoot: serviceRoot
            )
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            if let errorEnvelope = try? JSONDecoder().decode(ServiceErrorEnvelope.self, from: data), let error = errorEnvelope.error {
                throw ModelServiceTransportError.service(error)
            }
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }
        return try JSONDecoder().decode(TResponse.self, from: data)
    }

    private func perform(
        path: String,
        method: String,
        encodedBody: Data?,
        sessionToken: String,
        serviceRoot: URL
    ) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: serviceRoot.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = encodedBody
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }
        return (data, httpResponse)
    }

    private func resolvedRequestSessionToken(serviceRoot: URL) async throws -> String {
        if let sessionToken = try tokenProvider(), !sessionToken.isEmpty {
            return sessionToken
        }
        return try await refreshedGuestSessionToken(serviceRoot: serviceRoot, staleSessionToken: nil)
    }

    private func refreshedGuestSessionToken(
        serviceRoot: URL,
        staleSessionToken: String?
    ) async throws -> String {
        // gateway 的 /v1/sessions/guest 对失效 token 会直接换发新 guest session；
        // 登录态（dev-pro / dev-max）的 session 服务端已丢失，只能降级 guest，可在设置页重新登录。
        let guestSession = try await URLSessionAccountSessionTransport(
            serviceRoot: serviceRoot,
            session: session
        ).guestSession(existingSessionToken: staleSessionToken)
        try KeychainCredentialStore.saveSessionToken(guestSession.sessionToken)
        return guestSession.sessionToken
    }
}

private struct ServiceErrorEnvelope: Decodable {
    let error: ModelServiceError?
}
