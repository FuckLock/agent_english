#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation

/// 召唤态（v2.5）：隐形态下唯一常驻 App 元素是左侧召唤把手，点把手浮出
/// 精简胶囊菜单（返回 / 翻译开关 / 字幕·听音来源切换 / 收藏当前句）。
/// 本扩展只承载召唤态显隐状态机与四项动作到既有能力的接线，不重做字幕 / 听音翻译能力。
extension WebBridgeController {
    /// 点把手：浮出召唤态菜单。
    func presentSummonMenu() {
        isSummonMenuPresented = true
    }

    /// 点空白 / 操作完：收回召唤态菜单，回到隐形态（把手仍在）。
    func dismissSummonMenu() {
        isSummonMenuPresented = false
    }

    /// 把手 tap 行为：在隐形态与召唤态之间切换显隐。
    func toggleSummonMenu() {
        isSummonMenuPresented.toggle()
    }

    // MARK: - 召唤态四项动作（映射既有能力，操作完即隐）

    /// 返回：退出视频沉浸（回到普通浏览 / 上一页），并收回菜单。
    func summonBack() {
        videoBackRequestCount += 1
        videoCaptionState = nil
        videoAudioState = nil
        videoAudioPrivacyAcknowledged = false
        videoCaptionTranslationKeys.removeAll()
        dismissSummonMenu()
    }

    /// 翻译开关：复用既有 requestTranslation 重新发起字幕翻译，操作完即隐。
    func summonToggleTranslation() {
        requestTranslation()
        dismissSummonMenu()
    }

    /// 字幕·听音来源切换：在字幕优先与听音 Beta 之间切换，复用既有听音入口；操作完即隐。
    func summonToggleSource() {
        if videoAudioState?.source == .audio,
           videoAudioState?.status == .recognizing || videoAudioState?.status == .translating {
            // 当前在听音 → 切回字幕优先：停止听音，字幕叠层继续。
            stopVideoAudioTranslation()
        } else {
            // 当前在字幕 → 切到听音 Beta：走既有隐私确认入口。
            requestVideoAudioPrivacyPrompt()
        }
        dismissSummonMenu()
    }

    /// 收藏当前句：复用既有 saveCurrentVideoCaption，操作完即隐。
    func summonFavoriteCurrentCaption() {
        saveCurrentVideoCaption()
        dismissSummonMenu()
    }

    // MARK: - 召唤态展示数据（沿用既有状态，不新增额度逻辑）

    /// 召唤态当前来源标签（字幕 / 听音 Beta），沿用既有 source 与字幕可用性判断。
    var summonSourceLabel: String {
        switch videoAudioState?.source {
        case .audio:
            return "听音 Beta"
        case .caption:
            return "字幕"
        case .none:
            return videoCaptionState?.captionAvailability == .available ? "字幕" : "听音 Beta"
        }
    }

    /// 召唤态在听音来源下展示的今日剩余分钟（来自既有 quota，不新增额度计算）。
    var summonRemainingAudioMinutesText: String? {
        guard videoAudioState?.source == .audio,
              let remaining = videoAudioState?.quota?.remainingMinutes else {
            return nil
        }
        return "今日剩余 \(remaining) 分钟"
    }
}
