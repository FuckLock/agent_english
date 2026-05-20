import SwiftUI

struct PrivacyDisclosureView: View {
    let providerName: String
    let targetLanguage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Provider 数据发送", systemImage: "shield.lefthalf.filled")
                .font(.headline)

            Text("你触发翻译或解释时，当前页面中被选中的英文内容会发送给 \(providerName)，用于返回 \(targetLanguage) 结果。")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Text("API Key 只保存为 Keychain 引用；学习收藏、复习和网页站点数据分开管理。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
