import Foundation

public enum SelectionExplanationResponse: Equatable, Sendable {
    case success(SelectionExplanationResult)
    case failure(SelectionExplanationFailurePayload)
}

public struct ExplanationProviderClientConfiguration: Sendable { public init() {} }

public actor ExplanationProviderClient {
    private let modelServiceClient: ModelServiceClient
    public init(modelServiceClient: ModelServiceClient = ModelServiceClient(), configuration: ExplanationProviderClientConfiguration = .init()) {
        _ = configuration
        self.modelServiceClient = modelServiceClient
    }
    public func explain(_ request: SelectionRequest, preferences: TranslationPreferencesSnapshot) async -> SelectionExplanationResponse {
        let response = await modelServiceClient.explain(
            ModelServiceExplainRequest(
                pageID: request.pageId,
                sourceText: [request.contextBefore, request.selectedText, request.contextAfter].joined(separator: " "),
                selectedText: request.selectedText,
                contextBefore: request.contextBefore,
                contextAfter: request.contextAfter,
                sourceLanguage: "English",
                targetLanguage: preferences.targetLanguage,
                serviceTier: preferences.serviceTier,
                preferredModelID: preferences.preferredModelID
            )
        )
        if let error = response.error {
            return .failure(
                SelectionExplanationFailurePayload(
                    pageId: request.pageId,
                    selectionId: request.selectionId,
                    selectedText: request.selectedText,
                    contextBefore: request.contextBefore,
                    contextAfter: request.contextAfter,
                    sourceUrl: request.sourceUrl,
                    sourceTitle: request.sourceTitle,
                    containerPath: request.containerPath,
                    kind: request.kind,
                    failureReason: mapErrorCode(error.code)
                )
            )
        }
        return .success(
            SelectionExplanationResult(
                pageId: request.pageId,
                selectionId: request.selectionId,
                selectedText: request.selectedText,
                contextBefore: request.contextBefore,
                contextAfter: request.contextAfter,
                sourceUrl: request.sourceUrl,
                sourceTitle: request.sourceTitle,
                containerPath: request.containerPath,
                kind: request.kind,
                translation: response.translation,
                explanation: response.explanation,
                examples: response.examples
            )
        )
    }
    private func mapErrorCode(_ code: ModelServiceErrorCode) -> SelectionExplanationFailureReason {
        switch code {
        case .quotaExceeded: return .quotaExceeded
        case .tierUnavailable: return .tierUnavailable
        case .serviceUnavailable: return .serviceUnavailable
        case .contentTooLong: return .contentTooLong
        case .providerFallbackFailed: return .providerFallbackFailed
        }
    }
}
