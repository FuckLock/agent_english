import AgentEnglishCore
import SwiftData
import SwiftUI

struct SettingsView: View {
    @Query(sort: \AppSettingsRecord.targetLanguage) private var appSettings: [AppSettingsRecord]
    @Query(sort: \ProviderProfileRecord.displayName) private var providerProfiles: [ProviderProfileRecord]

    var body: some View {
        Form {
            Section("Provider 配置") {
                ForEach(providerProfiles) { profile in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(profile.displayName)
                                .font(.headline)
                            Spacer()
                            if profile.isEnabled {
                                Text("已启用")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Text(profile.providerName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        LabeledContent("Keychain 引用", value: profile.credentialReference)
                        Text(profile.capabilitySummary)
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 4)
                }
            }

            Section("隐私说明") {
                if let settings = appSettings.first {
                    LabeledContent("目标语言", value: settings.targetLanguage)
                    LabeledContent("首选 Provider", value: settings.preferredProviderName)
                    Text(settings.privacySummary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    Text("本机设置还未创建。")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("偏好与隐私")
    }
}
