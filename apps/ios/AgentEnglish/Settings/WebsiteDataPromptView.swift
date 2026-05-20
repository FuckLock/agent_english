import SwiftUI

struct WebsiteDataPromptView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("网站数据", systemImage: "globe.badge.chevron.backward")
                .font(.headline)

            Text("网站 Cookie、localStorage 和登录状态由 WKWebView 独立保存，不会和学习收藏、复习卡一起删除。")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Text("清理网站数据可能让 YouTube、Reddit、X 等站点退出登录；学习记录清理会单独提供。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
