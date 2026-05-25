import Foundation

enum SettingsClearAction: String, Identifiable {
    case learningData
    case translationCache
    case websiteData

    var id: String { rawValue }

    var title: String {
        switch self {
        case .learningData: return "清空学习数据？"
        case .translationCache: return "清空翻译缓存？"
        case .websiteData: return "清理网站数据？"
        }
    }

    var buttonTitle: String {
        switch self {
        case .learningData: return "清空学习数据"
        case .translationCache: return "清空翻译缓存"
        case .websiteData: return "清理网站数据"
        }
    }

    var message: String {
        switch self {
        case .learningData: return "会删除收藏、复习卡、浏览历史、统计和本机缓存，不会删除你在本地保存的服务设置。"
        case .translationCache: return "会删除已缓存的网页翻译结果，收藏和复习卡不受影响。"
        case .websiteData: return "会清理 WKWebView 的 cookie、localStorage 等网站数据，可能导致已登录的网站退出登录。"
        }
    }
}
