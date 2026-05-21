#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import Foundation

extension WebBridgeController {
    func dismissExplanationSheet() {
        explanationSheet = nil
    }

    func saveCurrentExplanation() {
        guard
            var presentation = explanationSheet,
            case .ready = presentation.status,
            let result = presentation.result,
            let savedItemRepository
        else {
            return
        }

        do {
            _ = try savedItemRepository.save(
                result.asSavedItem(
                    createdAt: createdAtFormatter.string(from: .now)
                )
            )
            presentation.isFavoriteSaved = true
            explanationSheet = presentation
            pushSummary("favorite.saved · \(result.selectionId)")
        } catch {
            pushSummary("favorite.failed · \(error.localizedDescription)")
        }
    }

    func handleSelectionRequest(_ request: SelectionRequest) {
        explanationSheet = .loading(selection: request)

        Task { [weak self] in
            guard let self else {
                return
            }

            let credentialReference = await self.currentTranslationPreferences().credentialReference
            let response = await self.explanationProviderClient.explain(
                request,
                credentialReference: credentialReference
            )

            await MainActor.run {
                switch response {
                case .success(let result):
                    self.explanationSheet = .ready(
                        result: result,
                        isFavoriteSaved: self.containsSavedExplanation(result)
                    )
                    self.pushSummary("selection.explanation.completed · \(result.selectionId)")
                case .failure(let failure):
                    self.explanationSheet = .failed(
                        selection: request,
                        failureReason: failure.failureReason
                    )
                    self.pushSummary("selection.explanation.failed · \(failure.failureReason.rawValue)")
                }
            }
        }
    }

    func containsSavedExplanation(_ result: SelectionExplanationResult) -> Bool {
        (try? savedItemRepository?.contains(
            selectedText: result.selectedText,
            sourceUrl: result.sourceUrl,
            contextBefore: result.contextBefore,
            contextAfter: result.contextAfter
        )) ?? false
    }
}
