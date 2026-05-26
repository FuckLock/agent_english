import Foundation

public enum VideoAudioTranslationSource: String, CaseIterable, Codable, Equatable, Sendable {
    case caption
    case audio
}

public enum VideoAudioTranslationStatus: String, CaseIterable, Codable, Equatable, Sendable {
    case idle
    case privacyRequired = "privacy-required"
    case captionPrimary = "caption-primary"
    case recognizing
    case translating
    case translated
    case quotaExhausted = "quota-exhausted"
    case stopped
    case closed
    case failed
}

public enum VideoAudioFailureReason: String, CaseIterable, Codable, Equatable, Sendable {
    case captionPrimary = "caption-primary"
    case captionQualityLow = "caption-quality-low"
    case captionUnavailable = "caption-unavailable"
    case privacyDisclosureRequired = "privacy-disclosure-required"
    case audioQuotaExceeded = "audio-quota-exceeded"
    case audioUnavailable = "audio-unavailable"
    case asrFailed = "asr-failed"
    case quotaExceeded = "quota-exceeded"
    case tierUnavailable = "tier-unavailable"
    case serviceUnavailable = "service-unavailable"
    case contentTooLong = "content-too-long"
    case providerFallbackFailed = "provider-fallback-failed"
}

public struct AudioTranslationQuota: Codable, Equatable, Sendable {
    public let serviceTier: ModelServiceTier
    public let status: ModelQuotaStatus
    public let usedMinutes: Int
    public let limitMinutes: Int
    public let remainingMinutes: Int
    public let resetAt: String

    public init(
        serviceTier: ModelServiceTier,
        status: ModelQuotaStatus,
        usedMinutes: Int,
        limitMinutes: Int,
        remainingMinutes: Int,
        resetAt: String
    ) {
        self.serviceTier = serviceTier
        self.status = status
        self.usedMinutes = usedMinutes
        self.limitMinutes = limitMinutes
        self.remainingMinutes = remainingMinutes
        self.resetAt = resetAt
    }
}

public struct VideoAudioSegment: Codable, Equatable, Sendable {
    public let pageId: String
    public let audioSegmentId: String
    public let videoId: String?
    public let source: VideoAudioTranslationSource
    public let sourceText: String
    public let translatedText: String?
    public let sourceLanguage: String
    public let targetLanguage: String
    public let startTimeSeconds: Double?
    public let endTimeSeconds: Double?
    public let capturedAt: String

    public init(
        pageId: String,
        audioSegmentId: String,
        videoId: String?,
        source: VideoAudioTranslationSource,
        sourceText: String,
        translatedText: String?,
        sourceLanguage: String,
        targetLanguage: String,
        startTimeSeconds: Double?,
        endTimeSeconds: Double?,
        capturedAt: String
    ) {
        self.pageId = pageId
        self.audioSegmentId = audioSegmentId
        self.videoId = videoId
        self.source = source
        self.sourceText = sourceText
        self.translatedText = translatedText
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.startTimeSeconds = startTimeSeconds
        self.endTimeSeconds = endTimeSeconds
        self.capturedAt = capturedAt
    }
}

public struct VideoAudioTranslationState: Codable, Equatable, Sendable {
    public let pageId: String
    public let siteKind: String
    public let pageKind: VideoCaptionPageKind
    public let url: String
    public let title: String
    public let videoId: String?
    public let captionAvailability: VideoCaptionAvailability
    public let source: VideoAudioTranslationSource
    public let overlayMode: VideoCaptionOverlayMode
    public let status: VideoAudioTranslationStatus
    public let capabilities: [SiteCapability]
    public let activeSegment: VideoAudioSegment?
    public let quota: AudioTranslationQuota?
    public let failureReason: VideoAudioFailureReason?
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
        source: VideoAudioTranslationSource,
        overlayMode: VideoCaptionOverlayMode,
        status: VideoAudioTranslationStatus,
        capabilities: [SiteCapability],
        activeSegment: VideoAudioSegment?,
        quota: AudioTranslationQuota?,
        failureReason: VideoAudioFailureReason?,
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
        self.source = source
        self.overlayMode = overlayMode
        self.status = status
        self.capabilities = capabilities
        self.activeSegment = activeSegment
        self.quota = quota
        self.failureReason = failureReason
        self.message = message
        self.updatedAt = updatedAt
    }
}
