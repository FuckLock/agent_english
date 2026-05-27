import Foundation
import Security

public enum KeychainCredentialStoreError: Error, Equatable {
    case unexpectedStatus(OSStatus)
}

public enum KeychainCredentialStore {
    private static let serviceName = "agent-english.service-session"
    public static let sessionTokenAlias = "model-service-session"
    // Free 翻译解耦兜底（ADR-0005 v2.7）：translation-proxy 只把 session token 当不透明限额分组键、
    // 不验真伪。无 model-gateway 游客 session token 时用本地设备级匿名标识兜底，让 Free 文本翻译
    // 不依赖 gateway 是否就绪。该标识只用于 proxy 限额分组，不用于 gateway 鉴权。
    public static let anonymousProxyTokenAlias = "translation-proxy-anonymous-session"

    public static func tokenAlias(for profileID: UUID) -> String {
        "service-token.\(profileID.uuidString)"
    }

    public static func saveSessionToken(_ sessionToken: String) throws {
        try saveToken(sessionToken, alias: sessionTokenAlias)
    }

    public static func loadSessionToken() throws -> String? {
        try loadToken(alias: sessionTokenAlias)
    }

    public static func deleteSessionToken() throws {
        try deleteToken(alias: sessionTokenAlias)
    }

    /// 读本地设备级匿名 proxy 限额标识；不存在则生成一个 UUID 持久化后返回。
    /// 仅用于 translation-proxy 的 Free 限额分组键（gateway 没起时的解耦兜底，ADR-0005 v2.7）。
    public static func loadOrCreateAnonymousProxyToken() throws -> String {
        if let existing = try loadToken(alias: anonymousProxyTokenAlias), !existing.isEmpty {
            return existing
        }
        let generated = "anon-" + UUID().uuidString
        try saveToken(generated, alias: anonymousProxyTokenAlias)
        return generated
    }

    public static func saveToken(_ token: String, alias: String) throws {
        let normalizedAlias = alias.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedAlias.isEmpty, !normalizedToken.isEmpty else {
            return
        }

        let tokenData = Data(normalizedToken.utf8)
        let query = baseQuery(for: normalizedAlias)
        let update = [kSecValueData as String: tokenData]
        let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw KeychainCredentialStoreError.unexpectedStatus(updateStatus)
        }

        var addQuery = query
        addQuery[kSecValueData as String] = tokenData
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw KeychainCredentialStoreError.unexpectedStatus(addStatus)
        }
    }

    public static func hasStoredToken(alias: String) -> Bool {
        let normalizedAlias = alias.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedAlias.isEmpty else {
            return false
        }

        var query = baseQuery(for: normalizedAlias)
        query.merge(
            [
                kSecMatchLimit as String: kSecMatchLimitOne,
                kSecReturnData as String: false,
            ],
            uniquingKeysWith: { _, newValue in newValue }
        )
        return SecItemCopyMatching(query as CFDictionary, nil) == errSecSuccess
    }

    public static func loadToken(alias: String) throws -> String? {
        let normalizedAlias = alias.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedAlias.isEmpty else {
            return nil
        }

        var query = baseQuery(for: normalizedAlias)
        query.merge(
            [
                kSecMatchLimit as String: kSecMatchLimitOne,
                kSecReturnData as String: true,
            ],
            uniquingKeysWith: { _, newValue in newValue }
        )

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw KeychainCredentialStoreError.unexpectedStatus(status)
        }
        guard let tokenData = result as? Data else {
            return nil
        }

        return String(data: tokenData, encoding: .utf8)
    }

    public static func deleteToken(alias: String) throws {
        let normalizedAlias = alias.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedAlias.isEmpty else {
            return
        }

        let status = SecItemDelete(baseQuery(for: normalizedAlias) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainCredentialStoreError.unexpectedStatus(status)
        }
    }

    private static func baseQuery(for alias: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: alias,
        ]
    }
}
