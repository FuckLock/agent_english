import Foundation

public enum SelectionExplanationResponse: Equatable, Sendable {
    case success(SelectionExplanationResult)
    case failure(SelectionExplanationFailurePayload)
}

public protocol ExplanationProviderTransport: Sendable {
    func explainSelection(
        request: SelectionRequest,
        credentialReference: String
    ) async throws -> SelectionExplanationResult
}

public struct PreviewExplanationTransport: ExplanationProviderTransport {
    public init() {}

    public func explainSelection(
        request: SelectionRequest,
        credentialReference: String
    ) async throws -> SelectionExplanationResult {
        _ = credentialReference

        let translation: String
        switch request.kind {
        case .word:
            translation = "词义：\(request.selectedText)"
        case .phrase:
            translation = "短语含义：\(request.selectedText)"
        case .sentence:
            translation = "句子大意：\(request.selectedText)"
        }

        return SelectionExplanationResult(
            pageId: request.pageId,
            selectionId: request.selectionId,
            selectedText: request.selectedText,
            contextBefore: request.contextBefore,
            contextAfter: request.contextAfter,
            sourceUrl: request.sourceUrl,
            sourceTitle: request.sourceTitle,
            containerPath: request.containerPath,
            kind: request.kind,
            translation: translation,
            explanation: "结合当前上下文，这里更接近“\(request.selectedText)”在原句里的实际用法。",
            examples: [
                "Example: \(request.selectedText) appears naturally in the same context.",
            ]
        )
    }
}

public struct ExplanationProviderClientConfiguration: Sendable {
    public let maxRetryAttempts: Int

    public init(maxRetryAttempts: Int = 1) {
        self.maxRetryAttempts = max(0, maxRetryAttempts)
    }
}

public actor ExplanationProviderClient {
    private let transport: any ExplanationProviderTransport
    private let configuration: ExplanationProviderClientConfiguration

    public init(
        transport: any ExplanationProviderTransport = PreviewExplanationTransport(),
        configuration: ExplanationProviderClientConfiguration = .init()
    ) {
        self.transport = transport
        self.configuration = configuration
    }

    public func explain(
        _ request: SelectionRequest,
        credentialReference: String?
    ) async -> SelectionExplanationResponse {
        guard let credentialReference, !credentialReference.isEmpty else {
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
                    failureReason: .providerNotConfigured
                )
            )
        }

        var attempt = 0
        while true {
            do {
                return .success(
                    try await transport.explainSelection(
                        request: request,
                        credentialReference: credentialReference
                    )
                )
            } catch {
                if attempt >= configuration.maxRetryAttempts {
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
                            failureReason: .selectionExplanationFailed
                        )
                    )
                }

                attempt += 1
            }
        }
    }
}
