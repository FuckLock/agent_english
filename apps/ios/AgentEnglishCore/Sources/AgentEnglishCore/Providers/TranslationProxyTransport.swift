import Foundation

// translation-proxy 网络传输：只请求自有翻译代理端点（TRANSLATION_PROXY_ROOT）。
// 不持有任何第三方翻译 key、不出现任何第三方翻译 Base URL、不直连第三方翻译服务。

public enum TranslationProxyErrorCode: String, Sendable {
    case quotaExceeded = "quota-exceeded"
    case providerFallbackFailed = "provider-fallback-failed"
    case serviceUnavailable = "service-unavailable"
}

public struct TranslationProxyTransportError: Error, Sendable {
    public let code: TranslationProxyErrorCode

    public init(code: TranslationProxyErrorCode) {
        self.code = code
    }
}

public struct URLSessionTranslationProxyTransport: TranslationProxyTransport {
    private let proxyRoot: URL?
    private let session: URLSession
    private let tokenProvider: @Sendable () throws -> String?

    public init(
        proxyRoot: URL? = TranslationProxyEndpointConfiguration.resolvedURL(),
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () throws -> String? = {
            try TranslationProxyEndpointConfiguration.resolvedSessionToken()
        }
    ) {
        self.proxyRoot = proxyRoot
        self.session = session
        self.tokenProvider = tokenProvider
    }

    public func translateText(
        _ request: TranslationProxyTranslateRequest
    ) async throws -> TranslationProxyResponse {
        guard let proxyRoot else {
            throw TranslationProxyTransportError(code: .serviceUnavailable)
        }

        var urlRequest = URLRequest(url: proxyRoot.appending(path: "/v1/translate-text"))
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let sessionToken = try tokenProvider(), !sessionToken.isEmpty {
            urlRequest.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        }
        urlRequest.httpBody = try JSONEncoder().encode(request)

        let (data, response) = try await session.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw TranslationProxyTransportError(code: .serviceUnavailable)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw mapErrorResponse(statusCode: httpResponse.statusCode, data: data)
        }
        return try JSONDecoder().decode(TranslationProxyResponse.self, from: data)
    }

    private func mapErrorResponse(statusCode: Int, data: Data) -> TranslationProxyTransportError {
        if
            let envelope = try? JSONDecoder().decode(ProxyErrorEnvelope.self, from: data),
            let code = TranslationProxyErrorCode(rawValue: envelope.code)
        {
            return TranslationProxyTransportError(code: code)
        }
        if statusCode == 429 {
            return TranslationProxyTransportError(code: .quotaExceeded)
        }
        return TranslationProxyTransportError(code: .serviceUnavailable)
    }
}

private struct ProxyErrorEnvelope: Decodable {
    let code: String
}
