import Foundation

public enum KeychainCredentialStore {
    public static func credentialReference(for providerProfileId: UUID) -> String {
        "keychain.provider.\(providerProfileId.uuidString)"
    }
}
