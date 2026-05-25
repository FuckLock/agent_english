import Foundation

public enum AccountStatusKind: String, Codable, Equatable, Sendable {
    case guest
    case signedIn = "signed-in"
    case devPro = "dev-pro"
    case devMax = "dev-max"
}

public struct AccountStatus: Codable, Equatable, Sendable {
    public let kind: AccountStatusKind
    public let displayName: String
    public let serviceTier: ModelServiceTier
    public let email: String?
    public let isTestAccount: Bool

    public init(
        kind: AccountStatusKind,
        displayName: String,
        serviceTier: ModelServiceTier,
        email: String?,
        isTestAccount: Bool
    ) {
        self.kind = kind
        self.displayName = displayName
        self.serviceTier = serviceTier
        self.email = email
        self.isTestAccount = isTestAccount
    }
}

public struct EntitlementSnapshot: Codable, Equatable, Sendable {
    public let account: AccountStatus
    public let serviceTier: ModelServiceTier
    public let quota: ModelQuotaSnapshot
    public let catalog: ModelCatalogSnapshot
    public let refreshedAt: String

    public init(
        account: AccountStatus,
        serviceTier: ModelServiceTier,
        quota: ModelQuotaSnapshot,
        catalog: ModelCatalogSnapshot,
        refreshedAt: String
    ) {
        self.account = account
        self.serviceTier = serviceTier
        self.quota = quota
        self.catalog = catalog
        self.refreshedAt = refreshedAt
    }
}

public struct AuthSession: Codable, Equatable, Sendable {
    public let sessionToken: String
    public let expiresAt: String
    public let account: AccountStatus
    public let entitlement: EntitlementSnapshot

    public init(
        sessionToken: String,
        expiresAt: String,
        account: AccountStatus,
        entitlement: EntitlementSnapshot
    ) {
        self.sessionToken = sessionToken
        self.expiresAt = expiresAt
        self.account = account
        self.entitlement = entitlement
    }
}

public struct DevLoginRequest: Codable, Equatable, Sendable {
    public let email: String
    public let password: String

    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

public struct DevLoginResponse: Codable, Equatable, Sendable {
    public let session: AuthSession

    public init(session: AuthSession) {
        self.session = session
    }
}

public protocol AccountSessionTransport: Sendable {
    func guestSession(existingSessionToken: String?) async throws -> AuthSession
    func loginDevAccount(email: String, password: String) async throws -> AuthSession
    func logout(sessionToken: String?) async throws -> AuthSession
}

public actor AccountSessionClient {
    private let transport: any AccountSessionTransport

    public init(transport: any AccountSessionTransport = URLSessionAccountSessionTransport()) {
        self.transport = transport
    }

    public func bootstrapGuestSession() async throws -> AuthSession {
        let storedSessionToken = try KeychainCredentialStore.loadSessionToken()
        let session = try await transport.guestSession(existingSessionToken: storedSessionToken)
        try KeychainCredentialStore.saveSessionToken(session.sessionToken)
        return session
    }

    public func loginDevAccount(email: String, password: String) async throws -> AuthSession {
        let session = try await transport.loginDevAccount(email: email, password: password)
        try KeychainCredentialStore.saveSessionToken(session.sessionToken)
        return session
    }

    public func logout() async throws -> AuthSession {
        let storedSessionToken = try KeychainCredentialStore.loadSessionToken()
        let session = try await transport.logout(sessionToken: storedSessionToken)
        try KeychainCredentialStore.saveSessionToken(session.sessionToken)
        return session
    }

    public static func isDevAuthEnabled(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        bundle: Bundle = .main
    ) -> Bool {
        if environment["ENABLE_DEV_AUTH"] == "true" {
            return true
        }
        return bundle.object(forInfoDictionaryKey: "ENABLE_DEV_AUTH") as? String == "true"
    }
}

public struct URLSessionAccountSessionTransport: AccountSessionTransport {
    private let serviceRoot: URL?
    private let session: URLSession

    public init(
        serviceRoot: URL? = ModelServiceEndpointConfiguration.resolvedURL(),
        session: URLSession = .shared
    ) {
        self.serviceRoot = serviceRoot
        self.session = session
    }

    public func guestSession(existingSessionToken: String?) async throws -> AuthSession {
        try await send(
            path: "/v1/sessions/guest",
            method: "POST",
            sessionToken: existingSessionToken,
            body: Optional<String>.none
        )
    }

    public func loginDevAccount(email: String, password: String) async throws -> AuthSession {
        let response: DevLoginResponse = try await send(
            path: "/v1/auth/dev-login",
            method: "POST",
            sessionToken: nil,
            body: DevLoginRequest(email: email, password: password)
        )
        return response.session
    }

    public func logout(sessionToken: String?) async throws -> AuthSession {
        try await send(
            path: "/v1/auth/logout",
            method: "POST",
            sessionToken: sessionToken,
            body: Optional<String>.none
        )
    }

    private func send<TBody: Encodable, TResponse: Decodable>(
        path: String,
        method: String,
        sessionToken: String?,
        body: TBody?
    ) async throws -> TResponse {
        guard let serviceRoot else {
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }

        var request = URLRequest(url: serviceRoot.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let sessionToken, !sessionToken.isEmpty {
            request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw ModelServiceTransportError.transport(.serviceUnavailable)
        }

        return try JSONDecoder().decode(TResponse.self, from: data)
    }
}
