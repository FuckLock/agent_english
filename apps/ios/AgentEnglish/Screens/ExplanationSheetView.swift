#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftUI

enum ExplanationSheetStatus: Equatable {
    case loading
    case ready
    case failed(SelectionExplanationFailureReason)
}

struct ExplanationSheetPresentation: Equatable {
    let selection: SelectionRequest
    let result: SelectionExplanationResult?
    var isFavoriteSaved: Bool
    let status: ExplanationSheetStatus

    static func loading(selection: SelectionRequest) -> ExplanationSheetPresentation {
        ExplanationSheetPresentation(
            selection: selection,
            result: nil,
            isFavoriteSaved: false,
            status: .loading
        )
    }

    static func ready(
        result: SelectionExplanationResult,
        isFavoriteSaved: Bool
    ) -> ExplanationSheetPresentation {
        ExplanationSheetPresentation(
            selection: result.asSelectionRequest(),
            result: result,
            isFavoriteSaved: isFavoriteSaved,
            status: .ready
        )
    }

    static func failed(
        selection: SelectionRequest,
        failureReason: SelectionExplanationFailureReason
    ) -> ExplanationSheetPresentation {
        ExplanationSheetPresentation(
            selection: selection,
            result: nil,
            isFavoriteSaved: false,
            status: .failed(failureReason)
        )
    }
}

struct ExplanationSheetView: View {
    let presentation: ExplanationSheetPresentation
    let onFavorite: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                translationSection
                explanationSection
                exampleSection
                sourceSection
                favoriteButton
            }
            .padding(20)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(presentation.selection.selectedText)
                .font(.title3.weight(.semibold))

            Text(kindLabel)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)

            Text(contextSummary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var translationSection: some View {
        GroupBox("释义") {
            contentBlock {
                switch presentation.status {
                case .loading:
                    ProgressView()
                case .ready:
                    Text(presentation.result?.translation ?? "")
                case .failed(let failureReason):
                    Text(errorMessage(for: failureReason))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var explanationSection: some View {
        GroupBox("语境解释") {
            contentBlock {
                switch presentation.status {
                case .loading:
                    Text("正在生成当前语境下的解释…")
                        .foregroundStyle(.secondary)
                case .ready:
                    Text(presentation.result?.explanation ?? "")
                case .failed(let failureReason):
                    Text(errorMessage(for: failureReason))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var exampleSection: some View {
        GroupBox("例句") {
            contentBlock {
                switch presentation.status {
                case .loading:
                    Text("正在准备例句…")
                        .foregroundStyle(.secondary)
                case .ready:
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(presentation.result?.examples ?? [], id: \.self) { example in
                            Text("• \(example)")
                        }
                    }
                case .failed:
                    Text("解释失败时不显示例句。")
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var sourceSection: some View {
        GroupBox("来源") {
            contentBlock {
                VStack(alignment: .leading, spacing: 6) {
                    Text(presentation.selection.sourceTitle)
                        .font(.headline)
                    Text(presentation.selection.sourceUrl)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            }
        }
    }

    private var favoriteButton: some View {
        Button(action: onFavorite) {
            Label(
                presentation.isFavoriteSaved ? "已收藏" : "收藏到学习夹",
                systemImage: presentation.isFavoriteSaved ? "bookmark.fill" : "bookmark"
            )
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .disabled(!canFavorite)
    }

    private var canFavorite: Bool {
        if presentation.isFavoriteSaved {
            return false
        }

        if case .ready = presentation.status {
            return true
        }

        return false
    }

    private var kindLabel: String {
        switch presentation.selection.kind {
        case .word:
            return "单词"
        case .phrase:
            return "短语"
        case .sentence:
            return "句子"
        }
    }

    private var contextSummary: String {
        let before = presentation.selection.contextBefore
        let after = presentation.selection.contextAfter
        return [before, presentation.selection.selectedText, after]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    private func contentBlock<Content: View>(
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func errorMessage(
        for failureReason: SelectionExplanationFailureReason
    ) -> String {
        switch failureReason {
        case .selectionExplanationFailed:
            return "这次解释请求失败了，可以稍后重试或重新选中内容。"
        case .quotaExceeded:
            return "当前服务等级的额度不足，可以稍后再试。"
        case .tierUnavailable:
            return "当前服务等级暂不可用，请升级后再试。"
        case .serviceUnavailable:
            return "模型服务暂不可用，请稍后重试。"
        case .contentTooLong:
            return "本次内容过长，请缩短选择范围后再试。"
        case .providerFallbackFailed:
            return "模型服务暂不可用，请稍后重试。"
        }
    }
}
