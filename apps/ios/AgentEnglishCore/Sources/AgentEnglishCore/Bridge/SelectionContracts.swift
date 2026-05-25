import Foundation

public enum SavedItemKind: String, CaseIterable, Codable, Equatable, Sendable {
    case word
    case phrase
    case sentence
}

public struct SelectionContext: Codable, Equatable, Sendable {
    public let pageId: String
    public let selectionId: String
    public let selectedText: String
    public let contextBefore: String
    public let contextAfter: String
    public let sourceUrl: String
    public let sourceTitle: String
    public let containerPath: String

    public init(
        pageId: String,
        selectionId: String,
        selectedText: String,
        contextBefore: String,
        contextAfter: String,
        sourceUrl: String,
        sourceTitle: String,
        containerPath: String
    ) {
        self.pageId = pageId
        self.selectionId = selectionId
        self.selectedText = selectedText
        self.contextBefore = contextBefore
        self.contextAfter = contextAfter
        self.sourceUrl = sourceUrl
        self.sourceTitle = sourceTitle
        self.containerPath = containerPath
    }
}

public struct SelectionRequest: Codable, Equatable, Sendable {
    public let pageId: String
    public let selectionId: String
    public let selectedText: String
    public let contextBefore: String
    public let contextAfter: String
    public let sourceUrl: String
    public let sourceTitle: String
    public let containerPath: String
    public let kind: SavedItemKind

    public init(
        pageId: String,
        selectionId: String,
        selectedText: String,
        contextBefore: String,
        contextAfter: String,
        sourceUrl: String,
        sourceTitle: String,
        containerPath: String,
        kind: SavedItemKind
    ) {
        self.pageId = pageId
        self.selectionId = selectionId
        self.selectedText = selectedText
        self.contextBefore = contextBefore
        self.contextAfter = contextAfter
        self.sourceUrl = sourceUrl
        self.sourceTitle = sourceTitle
        self.containerPath = containerPath
        self.kind = kind
    }
}

public struct SelectionExplanationResult: Codable, Equatable, Sendable {
    public let pageId: String
    public let selectionId: String
    public let selectedText: String
    public let contextBefore: String
    public let contextAfter: String
    public let sourceUrl: String
    public let sourceTitle: String
    public let containerPath: String
    public let kind: SavedItemKind
    public let translation: String
    public let explanation: String
    public let examples: [String]

    public init(
        pageId: String,
        selectionId: String,
        selectedText: String,
        contextBefore: String,
        contextAfter: String,
        sourceUrl: String,
        sourceTitle: String,
        containerPath: String,
        kind: SavedItemKind,
        translation: String,
        explanation: String,
        examples: [String]
    ) {
        self.pageId = pageId
        self.selectionId = selectionId
        self.selectedText = selectedText
        self.contextBefore = contextBefore
        self.contextAfter = contextAfter
        self.sourceUrl = sourceUrl
        self.sourceTitle = sourceTitle
        self.containerPath = containerPath
        self.kind = kind
        self.translation = translation
        self.explanation = explanation
        self.examples = examples
    }
}

public enum SelectionExplanationFailureReason: String, CaseIterable, Codable, Equatable, Sendable {
    case selectionExplanationFailed = "selection-explanation-failed"
    case quotaExceeded = "quota-exceeded"
    case tierUnavailable = "tier-unavailable"
    case serviceUnavailable = "service-unavailable"
    case contentTooLong = "content-too-long"
    case providerFallbackFailed = "provider-fallback-failed"
}

public struct SelectionExplanationFailurePayload: Codable, Equatable, Sendable {
    public let pageId: String
    public let selectionId: String
    public let selectedText: String
    public let contextBefore: String
    public let contextAfter: String
    public let sourceUrl: String
    public let sourceTitle: String
    public let containerPath: String
    public let kind: SavedItemKind
    public let failureReason: SelectionExplanationFailureReason

    public init(
        pageId: String,
        selectionId: String,
        selectedText: String,
        contextBefore: String,
        contextAfter: String,
        sourceUrl: String,
        sourceTitle: String,
        containerPath: String,
        kind: SavedItemKind,
        failureReason: SelectionExplanationFailureReason
    ) {
        self.pageId = pageId
        self.selectionId = selectionId
        self.selectedText = selectedText
        self.contextBefore = contextBefore
        self.contextAfter = contextAfter
        self.sourceUrl = sourceUrl
        self.sourceTitle = sourceTitle
        self.containerPath = containerPath
        self.kind = kind
        self.failureReason = failureReason
    }
}

public struct SavedItem: Codable, Equatable, Sendable {
    public let sourceUrl: String
    public let sourceTitle: String
    public let selectedText: String
    public let contextBefore: String
    public let contextAfter: String
    public let translation: String
    public let explanation: String
    public let kind: SavedItemKind
    public let createdAt: String

    public init(
        sourceUrl: String,
        sourceTitle: String,
        selectedText: String,
        contextBefore: String,
        contextAfter: String,
        translation: String,
        explanation: String,
        kind: SavedItemKind,
        createdAt: String
    ) {
        self.sourceUrl = sourceUrl
        self.sourceTitle = sourceTitle
        self.selectedText = selectedText
        self.contextBefore = contextBefore
        self.contextAfter = contextAfter
        self.translation = translation
        self.explanation = explanation
        self.kind = kind
        self.createdAt = createdAt
    }
}

public extension SelectionExplanationResult {
    func asSelectionRequest() -> SelectionRequest {
        SelectionRequest(
            pageId: pageId,
            selectionId: selectionId,
            selectedText: selectedText,
            contextBefore: contextBefore,
            contextAfter: contextAfter,
            sourceUrl: sourceUrl,
            sourceTitle: sourceTitle,
            containerPath: containerPath,
            kind: kind
        )
    }

    func asSavedItem(createdAt: String) -> SavedItem {
        SavedItem(
            sourceUrl: sourceUrl,
            sourceTitle: sourceTitle,
            selectedText: selectedText,
            contextBefore: contextBefore,
            contextAfter: contextAfter,
            translation: translation,
            explanation: explanation,
            kind: kind,
            createdAt: createdAt
        )
    }
}

public extension SelectionExplanationFailurePayload {
    func asSelectionRequest() -> SelectionRequest {
        SelectionRequest(
            pageId: pageId,
            selectionId: selectionId,
            selectedText: selectedText,
            contextBefore: contextBefore,
            contextAfter: contextAfter,
            sourceUrl: sourceUrl,
            sourceTitle: sourceTitle,
            containerPath: containerPath,
            kind: kind
        )
    }
}
