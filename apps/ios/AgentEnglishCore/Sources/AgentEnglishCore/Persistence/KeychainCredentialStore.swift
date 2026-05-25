import Foundation
import Security

public enum KeychainCredentialStoreError: Error, Equatable {
    case unexpectedStatus(OSStatus)
}

public enum KeychainCredentialStore {
    private static let serviceName = "agent-english.service-session"
    public static let sessionTokenAlias = "model-service-session"

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
