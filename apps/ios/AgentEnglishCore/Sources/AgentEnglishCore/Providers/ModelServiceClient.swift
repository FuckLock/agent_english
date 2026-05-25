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

public protocol ModelServiceTransport: Sendable {
    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot
    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse
    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse
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
    public static func userMessage(for code: ModelServiceErrorCode) -> String {
        switch code {
        case .quotaExceeded: return "今日额度不足，请稍后再试。"
        case .tierUnavailable: return "当前服务等级暂不可用，请升级后再试。"
        case .serviceUnavailable: return "模型服务暂不可用，请稍后重试。"
        case .contentTooLong: return "本次内容过长，请缩短后再试。"
        case .providerFallbackFailed: return "模型服务暂不可用，请稍后重试。"
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
    private func send<TBody: Encodable, TResponse: Decodable>(path: String, method: String, body: TBody?) async throws -> TResponse {
        guard let serviceRoot else {
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }

        var request = URLRequest(url: serviceRoot.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let sessionToken = try await resolvedRequestSessionToken(serviceRoot: serviceRoot)
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        if let body { request.httpBody = try JSONEncoder().encode(body) }
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            if let errorEnvelope = try? JSONDecoder().decode(ServiceErrorEnvelope.self, from: data), let error = errorEnvelope.error {
                throw ModelServiceTransportError.service(error)
            }
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }
        return try JSONDecoder().decode(TResponse.self, from: data)
    }

    private func resolvedRequestSessionToken(serviceRoot: URL) async throws -> String {
        if let sessionToken = try tokenProvider(), !sessionToken.isEmpty {
            return sessionToken
        }

        let guestSession = try await URLSessionAccountSessionTransport(
            serviceRoot: serviceRoot,
            session: session
        ).guestSession(existingSessionToken: nil)
        try KeychainCredentialStore.saveSessionToken(guestSession.sessionToken)
        return guestSession.sessionToken
    }
}

private struct ServiceErrorEnvelope: Decodable {
    let error: ModelServiceError?
}
