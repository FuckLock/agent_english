import Foundation

public enum VideoCaptionPageKind: String, CaseIterable, Codable, Equatable, Sendable {
    case youtubeWatch = "youtube-watch"
    case youtubeShorts = "youtube-shorts"
}

public enum VideoCaptionAvailability: String, CaseIterable, Codable, Equatable, Sendable {
    case unknown
    case available
    case unavailable
}

public enum VideoCaptionOverlayMode: String, CaseIterable, Codable, Equatable, Sendable {
    case hidden
    case inlineOverlay = "inline-overlay"
    case fallbackBar = "fallback-bar"
}

public enum VideoCaptionOverlayStatus: String, CaseIterable, Codable, Equatable, Sendable {
    case detecting
    case captionAvailable = "caption-available"
    case captionUnavailable = "caption-unavailable"
    case translating
    case translated
    case failed
    case fallback
}

public enum VideoCaptionFailureReason: String, CaseIterable, Codable, Equatable, Sendable {
    case captionUnavailable = "caption-unavailable"
    case overlayUnsafe = "overlay-unsafe"
    case translationFailed = "translation-failed"
    case quotaExceeded = "quota-exceeded"
    case tierUnavailable = "tier-unavailable"
    case serviceUnavailable = "service-unavailable"
    case contentTooLong = "content-too-long"
    case providerFallbackFailed = "provider-fallback-failed"
}

public struct VideoCaptionSegment: Codable, Equatable, Sendable {
    public let pageId: String
    public let segmentId: String
    public let videoId: String?
    public let sourceText: String
    public let translatedText: String?
    public let sourceLanguage: String
    public let targetLanguage: String
    public let startTimeSeconds: Double?
    public let endTimeSeconds: Double?
    public let containerPath: String?
    public let capturedAt: String

    public init(
        pageId: String,
        segmentId: String,
        videoId: String?,
        sourceText: String,
        translatedText: String?,
        sourceLanguage: String,
        targetLanguage: String,
        startTimeSeconds: Double?,
        endTimeSeconds: Double?,
        containerPath: String?,
        capturedAt: String
    ) {
        self.pageId = pageId
        self.segmentId = segmentId
        self.videoId = videoId
        self.sourceText = sourceText
        self.translatedText = translatedText
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.startTimeSeconds = startTimeSeconds
        self.endTimeSeconds = endTimeSeconds
        self.containerPath = containerPath
        self.capturedAt = capturedAt
    }
}

public struct VideoCaptionOverlayState: Codable, Equatable, Sendable {
    public let pageId: String
    public let siteKind: String
    public let pageKind: VideoCaptionPageKind
    public let url: String
    public let title: String
    public let videoId: String?
    public let captionAvailability: VideoCaptionAvailability
    public let overlayMode: VideoCaptionOverlayMode
    public let status: VideoCaptionOverlayStatus
    public let capabilities: [SiteCapability]
    public let activeSegment: VideoCaptionSegment?
    public let failureReason: VideoCaptionFailureReason?
    public let message: String?
    public let updatedAt: String

    public init(
        pageId: String,
        siteKind: String,
        pageKind: VideoCaptionPageKind,
        url: String,
        title: String,
        videoId: String?,
        captionAvailability: VideoCaptionAvailability,
        overlayMode: VideoCaptionOverlayMode,
        status: VideoCaptionOverlayStatus,
        capabilities: [SiteCapability],
        activeSegment: VideoCaptionSegment?,
        failureReason: VideoCaptionFailureReason?,
        message: String?,
        updatedAt: String
    ) {
        self.pageId = pageId
        self.siteKind = siteKind
        self.pageKind = pageKind
        self.url = url
        self.title = title
        self.videoId = videoId
        self.captionAvailability = captionAvailability
        self.overlayMode = overlayMode
        self.status = status
        self.capabilities = capabilities
        self.activeSegment = activeSegment
        self.failureReason = failureReason
        self.message = message
        self.updatedAt = updatedAt
    }
}

public extension VideoCaptionFailureReason {
    var translationFailureReason: TranslationFailureReason {
        switch self {
        case .quotaExceeded: return .quotaExceeded
        case .tierUnavailable: return .tierUnavailable
        case .serviceUnavailable: return .serviceUnavailable
        case .contentTooLong: return .contentTooLong
        case .providerFallbackFailed: return .providerFallbackFailed
        case .captionUnavailable, .overlayUnsafe, .translationFailed:
            return .translationFailed
        }
    }
}
