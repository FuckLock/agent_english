#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

struct SettingsView: View {
    @Query(sort: \AppSettingsRecord.targetLanguage) private var appSettings: [AppSettingsRecord]
    @Query(sort: \ProviderProfileRecord.displayName) private var providerProfiles: [ProviderProfileRecord]

    var body: some View {
        Form {
            Section("Provider 配置") {
                ForEach(providerProfiles) { profile in
                    DisclosureGroup {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(profile.providerName)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            LabeledContent("Keychain 引用", value: profile.credentialReference)
                            Text(profile.capabilitySummary)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 4)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(profile.displayName)
                                    .font(.headline)
                                Text(profile.providerName)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            if profile.isEnabled {
                                Text("已启用")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            Section("隐私说明") {
                if let settings = appSettings.first {
                    PrivacyDisclosureView(
                        providerName: settings.preferredProviderName,
                        targetLanguage: settings.targetLanguage
                    )
                    WebsiteDataPromptView()
                } else {
                    Text("本机设置还未创建。")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("偏好与隐私")
    }
}
