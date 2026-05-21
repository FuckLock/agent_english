import Foundation

public enum DisplayMode: String, CaseIterable, Codable, Equatable, Sendable {
    case original
    case bilingual
    case learning
}

public enum SiteCapability: String, CaseIterable, Codable, Equatable, Sendable {
    case readablePage = "readable-page"
    case inlineTranslation = "inline-translation"
    case selectionFallback = "selection-fallback"
}

public enum TranslationFailureReason: String, CaseIterable, Codable, Equatable, Sendable {
    case providerNotConfigured = "provider-not-configured"
    case pageUnrecognized = "page-unrecognized"
    case translationFailed = "translation-failed"
}

public struct PageContext: Codable, Equatable, Sendable {
    public let pageId: String
    public let url: String
    public let title: String
    public let sourceLanguage: String
    public let targetLanguage: String
    public let displayMode: DisplayMode
    public let capabilities: [SiteCapability]
    public let siteKind: String

    public init(
        pageId: String,
        url: String,
        title: String,
        sourceLanguage: String,
        targetLanguage: String,
        displayMode: DisplayMode,
        capabilities: [SiteCapability],
        siteKind: String
    ) {
        self.pageId = pageId
        self.url = url
        self.title = title
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.displayMode = displayMode
        self.capabilities = capabilities
        self.siteKind = siteKind
    }
}

public struct PageTextSegment: Codable, Equatable, Sendable {
    public let pageId: String
    public let segmentId: String
    public let sourceText: String
    public let containerPath: String
    public let sourceLanguage: String
    public let isVisible: Bool
    public let capabilities: [SiteCapability]

    public init(
        pageId: String,
        segmentId: String,
        sourceText: String,
        containerPath: String,
        sourceLanguage: String,
        isVisible: Bool,
        capabilities: [SiteCapability]
    ) {
        self.pageId = pageId
        self.segmentId = segmentId
        self.sourceText = sourceText
        self.containerPath = containerPath
        self.sourceLanguage = sourceLanguage
        self.isVisible = isVisible
        self.capabilities = capabilities
    }
}

public struct TranslationRequest: Codable, Equatable, Sendable {
    public let pageId: String
    public let pageContext: PageContext
    public let sourceLanguage: String
    public let targetLanguage: String
    public let displayMode: DisplayMode
    public let capabilities: [SiteCapability]
    public let segments: [PageTextSegment]

    public init(
        pageId: String,
        pageContext: PageContext,
        sourceLanguage: String,
        targetLanguage: String,
        displayMode: DisplayMode,
        capabilities: [SiteCapability],
        segments: [PageTextSegment]
    ) {
        self.pageId = pageId
        self.pageContext = pageContext
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.displayMode = displayMode
        self.capabilities = capabilities
        self.segments = segments
    }
}

public struct TranslationSegmentResult: Codable, Equatable, Sendable {
    public let segmentId: String
    public let translatedText: String?
    public let failureReason: TranslationFailureReason?

    public init(segmentId: String, translatedText: String?, failureReason: TranslationFailureReason?) {
        self.segmentId = segmentId
        self.translatedText = translatedText
        self.failureReason = failureReason
    }
}

public struct TranslationResult: Codable, Equatable, Sendable {
    public let pageId: String
    public let sourceLanguage: String
    public let targetLanguage: String
    public let displayMode: DisplayMode
    public let capabilities: [SiteCapability]
    public let segmentResults: [TranslationSegmentResult]
    public let resultsBySegmentId: [String: TranslationSegmentResult]
    public let failureReason: TranslationFailureReason?

    public init(
        pageId: String,
        sourceLanguage: String,
        targetLanguage: String,
        displayMode: DisplayMode,
        capabilities: [SiteCapability],
        segmentResults: [TranslationSegmentResult],
        resultsBySegmentId: [String: TranslationSegmentResult],
        failureReason: TranslationFailureReason?
    ) {
        self.pageId = pageId
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.displayMode = displayMode
        self.capabilities = capabilities
        self.segmentResults = segmentResults
        self.resultsBySegmentId = resultsBySegmentId
        self.failureReason = failureReason
    }
}

public struct TranslationFailurePayload: Codable, Equatable, Sendable {
    public let pageId: String
    public let segmentId: String?
    public let sourceLanguage: String
    public let targetLanguage: String
    public let displayMode: DisplayMode
    public let capabilities: [SiteCapability]
    public let failureReason: TranslationFailureReason

    public init(
        pageId: String,
        segmentId: String?,
        sourceLanguage: String,
        targetLanguage: String,
        displayMode: DisplayMode,
        capabilities: [SiteCapability],
        failureReason: TranslationFailureReason
    ) {
        self.pageId = pageId
        self.segmentId = segmentId
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.displayMode = displayMode
        self.capabilities = capabilities
        self.failureReason = failureReason
    }
}
