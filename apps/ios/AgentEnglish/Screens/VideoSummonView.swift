#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftUI

/// v2.5 隐形态 / 召唤态：视频页 App UI 整体隐形，唯一常驻 App 元素是左侧半透明
/// 召唤把手；点把手浮出精简胶囊菜单（返回 / 翻译开关 / 字幕·听音来源切换 / 收藏当前句），
/// 操作完或点空白即收回。把手与菜单贴屏幕左侧，避开右侧 YouTube 操作列与底部播放控件。
struct VideoSummonView: View {
    @ObservedObject var bridgeController: WebBridgeController
    var onBack: () -> Void
    var onSourceToggle: () -> Void

    var body: some View {
        ZStack(alignment: .leading) {
            if bridgeController.isSummonMenuPresented {
                // 点空白处收回：仅在召唤态存在的轻蒙层，按需出现、不长期占屏。
                Color.black.opacity(0.001)
                    .contentShape(Rectangle())
                    .onTapGesture { bridgeController.dismissSummonMenu() }
                    .accessibilityIdentifier("video-immersive-backdrop")
            }

            HStack(spacing: 8) {
                summonHandle

                if bridgeController.isSummonMenuPresented {
                    summonMenu
                        .transition(.move(edge: .leading).combined(with: .opacity))
                }

                Spacer(minLength: 0)
            }
            .padding(.leading, 0)
        }
        .frame(maxHeight: .infinity, alignment: .center)
        .animation(.easeInOut(duration: 0.18), value: bridgeController.isSummonMenuPresented)
    }

    // MARK: - 召唤把手（隐形态唯一常驻 App 元素）

    private var summonHandle: some View {
        Button {
            bridgeController.toggleSummonMenu()
        } label: {
            Image(systemName: "chevron.right.circle.fill")
                .font(.title3)
                .foregroundStyle(.white.opacity(0.92))
                .frame(width: 28, height: 56)
                .background {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .opacity(0.7)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
                }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("video-summon-handle")
        .accessibilityLabel("唤出视频菜单")
    }

    // MARK: - 召唤态精简胶囊菜单（四项，用完即隐）

    private var summonMenu: some View {
        HStack(spacing: 16) {
            menuButton(
                systemImage: "chevron.backward",
                label: "返回",
                identifier: "video-summon-back",
                action: onBack
            )

            menuButton(
                systemImage: "character.bubble",
                label: "翻译开关",
                identifier: "video-summon-translation-toggle",
                action: bridgeController.summonToggleTranslation
            )

            sourceToggleButton

            menuButton(
                systemImage: "bookmark",
                label: "收藏当前句",
                identifier: "video-summon-favorite",
                action: bridgeController.summonFavoriteCurrentCaption
            )
            .disabled(bridgeController.videoCaptionState?.activeSegment == nil)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background {
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.82)
        }
        .overlay {
            Capsule(style: .continuous)
                .stroke(Color.white.opacity(0.16), lineWidth: 0.5)
        }
    }

    private var sourceToggleButton: some View {
        VStack(spacing: 2) {
            Button(action: onSourceToggle) {
                Label(bridgeController.summonSourceLabel, systemImage: "waveform.badge.magnifyingglass")
                    .labelStyle(.iconOnly)
                    .font(.headline)
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("video-summon-source-toggle")
            .accessibilityLabel("字幕听音来源切换 · \(bridgeController.summonSourceLabel)")

            if let minutesText = bridgeController.summonRemainingAudioMinutesText {
                Text(minutesText)
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.85))
                    .accessibilityIdentifier("video-summon-audio-minutes")
            }
        }
    }

    private func menuButton(
        systemImage: String,
        label: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.headline)
                .foregroundStyle(.white)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(label)
    }
}
