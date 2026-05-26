#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftUI

extension WebBrowserView {
    func failureTitle(
        for failureReason: TranslationFailureReason
    ) -> String {
        switch failureReason {
        case .pageUnrecognized:
            return "当前页面正文暂时不可识别"
        case .translationFailed:
            return "整页翻译暂时失败"
        case .quotaExceeded:
            return "当前服务等级额度不足"
        case .tierUnavailable:
            return "当前服务等级暂不可用"
        case .serviceUnavailable:
            return "模型服务暂不可用"
        case .contentTooLong:
            return "本次内容过长"
        case .providerFallbackFailed:
            return "模型服务暂不可用"
        }
    }

    func failureMessage(
        for failureReason: TranslationFailureReason
    ) -> String {
        switch failureReason {
        case .pageUnrecognized:
            return "可以直接选择页面中的文本，再改用选区翻译。"
        case .translationFailed:
            return "可以重试一次，或先切换到选区翻译完成当前阅读。"
        case .quotaExceeded:
            return "可以稍后再试，或切换到较轻量的 Free 服务。"
        case .tierUnavailable:
            return "请到设置页确认当前等级和默认模型。"
        case .serviceUnavailable:
            return "模型服务暂时繁忙，稍后重试即可。"
        case .contentTooLong:
            return "可以缩短当前选择范围，或分段翻译后继续阅读。"
        case .providerFallbackFailed:
            return "模型服务暂时繁忙，稍后重试即可。"
        }
    }
}
