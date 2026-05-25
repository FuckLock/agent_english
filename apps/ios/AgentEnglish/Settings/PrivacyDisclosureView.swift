import SwiftUI

struct PrivacyDisclosureView: View {
    let serviceTierName: String
    let targetLanguage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("模型服务数据发送", systemImage: "shield.lefthalf.filled")
                .font(.headline)

            Text("你触发翻译或解释时，当前页面中的英文内容会发送到自有后端模型服务，并按 \(serviceTierName) 等级返回 \(targetLanguage) 结果。")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Text("后端可能再转发给当前等级对应的第三方模型；学习收藏、复习和网页站点数据仍分开管理。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
