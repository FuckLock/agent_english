import Foundation
import Security

public enum KeychainCredentialStore {
    private static let serviceName = "agent-english.provider-credentials"

    public static func credentialReference(for providerProfileId: UUID) -> String {
        "keychain.provider.\(providerProfileId.uuidString)"
    }

    public static func hasStoredCredential(for credentialReference: String) -> Bool {
        let normalizedReference = credentialReference.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedReference.isEmpty else {
            return false
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: normalizedReference,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: false,
        ]

        return SecItemCopyMatching(query as CFDictionary, nil) == errSecSuccess
    }
}
