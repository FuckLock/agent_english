import Foundation

public enum ModelServiceTier: String, CaseIterable, Codable, Equatable, Sendable {
    case free
    case pro
    case max

    public var displayName: String {
        switch self {
        case .free: "Free"
        case .pro: "Pro"
        case .max: "Max"
        }
    }
}

public enum ModelServiceAvailability: String, CaseIterable, Codable, Equatable, Sendable {
    case available
    case requiresTier
    case locked
}

public enum ModelQuotaStatus: String, CaseIterable, Codable, Equatable, Sendable {
    case ok
    case limited
    case exhausted
}

public enum ModelServiceErrorCode: String, CaseIterable, Codable, Equatable, Sendable {
    case quotaExceeded = "quota-exceeded"
    case tierUnavailable = "tier-unavailable"
    case serviceUnavailable = "service-unavailable"
    case contentTooLong = "content-too-long"
    case providerFallbackFailed = "provider-fallback-failed"
    case privacyDisclosureRequired = "privacy-disclosure-required"
}

public struct ModelQuotaSnapshot: Codable, Equatable, Sendable {
    public let status: ModelQuotaStatus
    public let used: Int
    public let limit: Int
    public let remaining: Int
    public let resetAt: String

    public init(
        status: ModelQuotaStatus,
        used: Int,
        limit: Int,
        remaining: Int,
        resetAt: String
    ) {
        self.status = status
        self.used = used
        self.limit = limit
        self.remaining = remaining
        self.resetAt = resetAt
    }
}

public struct ModelCatalogOption: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let tier: ModelServiceTier
    public let displayName: String
    public let summary: String
    public let capabilities: [String]
    public let availability: ModelServiceAvailability
    public let requiredTier: ModelServiceTier?
    public let quota: ModelQuotaSnapshot

    public init(
        id: String,
        tier: ModelServiceTier,
        displayName: String,
        summary: String,
        capabilities: [String],
        availability: ModelServiceAvailability,
        requiredTier: ModelServiceTier?,
        quota: ModelQuotaSnapshot
    ) {
        self.id = id
        self.tier = tier
        self.displayName = displayName
        self.summary = summary
        self.capabilities = capabilities
        self.availability = availability
        self.requiredTier = requiredTier
        self.quota = quota
    }
}

public struct ModelCatalogSnapshot: Codable, Equatable, Sendable {
    public let currentTier: ModelServiceTier
    public let availableTiers: [ModelServiceTier]
    public let defaultModelID: String
    public let options: [ModelCatalogOption]
    public let quota: ModelQuotaSnapshot
    public let audioQuota: ModelQuotaSnapshot?
    public let lastUpdatedAt: String

    enum CodingKeys: String, CodingKey {
        case currentTier
        case availableTiers
        case defaultModelID = "defaultModelId"
        case options
        case quota
        case audioQuota
        case lastUpdatedAt
    }

    public func option(id: String) -> ModelCatalogOption? {
        options.first(where: { $0.id == id })
    }

    public init(
        currentTier: ModelServiceTier,
        availableTiers: [ModelServiceTier],
        defaultModelID: String,
        options: [ModelCatalogOption],
        quota: ModelQuotaSnapshot,
        audioQuota: ModelQuotaSnapshot? = nil,
        lastUpdatedAt: String
    ) {
        self.currentTier = currentTier
        self.availableTiers = availableTiers
        self.defaultModelID = defaultModelID
        self.options = options
        self.quota = quota
        self.audioQuota = audioQuota
        self.lastUpdatedAt = lastUpdatedAt
    }

    public static func preview(
        currentTier: ModelServiceTier,
        preferredModelID: String? = nil,
        used: Int = 3,
        syncedAt: Date = .now
    ) -> ModelCatalogSnapshot {
        let timestamp = ISO8601DateFormatter().string(from: syncedAt)
        let freeQuota = previewQuota(limit: 20, used: currentTier == .free ? used : 0)
        let proQuota = previewQuota(limit: 200, used: currentTier == .pro ? used : 0)
        let maxQuota = previewQuota(limit: 800, used: currentTier == .max ? used : 0)
        let options = [
            ModelCatalogOption(
                id: "free-translate",
                tier: .free,
                displayName: "Free 服务 · 轻量翻译",
                summary: "适合通用网页翻译和快速释义。",
                capabilities: ["translation", "glossary"],
                availability: .available,
                requiredTier: nil,
                quota: freeQuota
            ),
            ModelCatalogOption(
                id: "pro-context",
                tier: .pro,
                displayName: "Pro 模型 · 语境精读",
                summary: "适合整段语境解释和更稳定的长句处理。",
                capabilities: ["translation", "explanation", "examples"],
                availability: currentTier == .free ? .requiresTier : .available,
                requiredTier: currentTier == .free ? .pro : nil,
                quota: proQuota
            ),
            ModelCatalogOption(
                id: "max-mentor",
                tier: .max,
                displayName: "Max 模型 · 深度讲解",
                summary: "适合复杂句深挖、例句扩展和学习建议。",
                capabilities: ["translation", "explanation", "examples", "review"],
                availability: currentTier == .max ? .available : .requiresTier,
                requiredTier: currentTier == .max ? nil : .max,
                quota: maxQuota
            ),
        ]
        let preferred = options.first(where: { $0.id == preferredModelID && $0.availability == .available })
        let fallback = options.first(where: { $0.tier == currentTier }) ?? options[0]

        return ModelCatalogSnapshot(
            currentTier: currentTier,
            availableTiers: [.free, .pro, .max],
            defaultModelID: preferred?.id ?? fallback.id,
            options: options,
            quota: quota(for: currentTier, used: used),
            audioQuota: audioQuota(for: currentTier, used: currentTier == .free ? min(used, 10) : 0),
            lastUpdatedAt: timestamp
        )
    }

    private static func quota(for tier: ModelServiceTier, used: Int) -> ModelQuotaSnapshot {
        switch tier {
        case .free: return previewQuota(limit: 20, used: used)
        case .pro: return previewQuota(limit: 200, used: used)
        case .max: return previewQuota(limit: 800, used: used)
        }
    }

    private static func previewQuota(limit: Int, used: Int) -> ModelQuotaSnapshot {
        let remaining = max(0, limit - used)
        return ModelQuotaSnapshot(
            status: remaining == 0 ? .exhausted : remaining <= 3 ? .limited : .ok,
            used: used,
            limit: limit,
            remaining: remaining,
            resetAt: ISO8601DateFormatter().string(from: .now.addingTimeInterval(86_400))
        )
    }

    public static func previewAudioQuota(for tier: ModelServiceTier, used: Int = 3) -> ModelQuotaSnapshot {
        audioQuota(for: tier, used: used)
    }

    private static func audioQuota(for tier: ModelServiceTier, used: Int) -> ModelQuotaSnapshot {
        switch tier {
        case .free: return previewQuota(limit: 10, used: min(used, 10))
        case .pro: return previewQuota(limit: 60, used: min(used, 60))
        case .max: return previewQuota(limit: 180, used: min(used, 180))
        }
    }
}

public struct ModelServiceError: Codable, Equatable, Sendable {
    public let code: ModelServiceErrorCode
    public let message: String
    public let retryable: Bool
    public let requiredTier: ModelServiceTier?

    public init(
        code: ModelServiceErrorCode,
        message: String,
        retryable: Bool,
        requiredTier: ModelServiceTier?
    ) {
        self.code = code
        self.message = message
        self.retryable = retryable
        self.requiredTier = requiredTier
    }
}

public struct ModelServiceTextSegment: Codable, Equatable, Sendable {
    public let segmentID: String
    public let sourceText: String

    public init(segmentID: String, sourceText: String) {
        self.segmentID = segmentID
        self.sourceText = sourceText
    }

    enum CodingKeys: String, CodingKey {
        case segmentID = "segmentId"
        case sourceText
    }
}

public struct ModelServiceTranslateRequest: Codable, Equatable, Sendable {
    public let pageID: String
    public let sourceLanguage: String
    public let targetLanguage: String
    public let serviceTier: ModelServiceTier
    public let preferredModelID: String?
    public let segments: [ModelServiceTextSegment]

    public init(
        pageID: String,
        sourceLanguage: String,
        targetLanguage: String,
        serviceTier: ModelServiceTier,
        preferredModelID: String?,
        segments: [ModelServiceTextSegment]
    ) {
        self.pageID = pageID
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.serviceTier = serviceTier
        self.preferredModelID = preferredModelID
        self.segments = segments
    }

    enum CodingKeys: String, CodingKey {
        case pageID = "pageId"
        case sourceLanguage
        case targetLanguage
        case serviceTier
        case preferredModelID = "preferredModelId"
        case segments
    }
}

public struct ModelServiceTranslateSegmentResult: Codable, Equatable, Sendable {
    public let segmentID: String
    public let translatedText: String?
    public let errorCode: ModelServiceErrorCode?

    public init(
        segmentID: String,
        translatedText: String?,
        errorCode: ModelServiceErrorCode?
    ) {
        self.segmentID = segmentID
        self.translatedText = translatedText
        self.errorCode = errorCode
    }

    enum CodingKeys: String, CodingKey {
        case segmentID = "segmentId"
        case translatedText
        case errorCode
    }
}

public struct ModelServiceTranslateResponse: Codable, Equatable, Sendable {
    public let pageID: String
    public let serviceTier: ModelServiceTier
    public let model: ModelCatalogOption
    public let segmentResults: [ModelServiceTranslateSegmentResult]
    public let quota: ModelQuotaSnapshot
    public let error: ModelServiceError?

    public init(
        pageID: String,
        serviceTier: ModelServiceTier,
        model: ModelCatalogOption,
        segmentResults: [ModelServiceTranslateSegmentResult],
        quota: ModelQuotaSnapshot,
        error: ModelServiceError?
    ) {
        self.pageID = pageID
        self.serviceTier = serviceTier
        self.model = model
        self.segmentResults = segmentResults
        self.quota = quota
        self.error = error
    }

    enum CodingKeys: String, CodingKey {
        case pageID = "pageId"
        case serviceTier
        case model
        case segmentResults
        case quota
        case error
    }
}

public struct ModelServiceExplainRequest: Codable, Equatable, Sendable {
    public let pageID: String
    public let sourceText: String
    public let selectedText: String
    public let contextBefore: String
    public let contextAfter: String
    public let sourceLanguage: String
    public let targetLanguage: String
    public let serviceTier: ModelServiceTier
    public let preferredModelID: String?

    public init(
        pageID: String,
        sourceText: String,
        selectedText: String,
        contextBefore: String,
        contextAfter: String,
        sourceLanguage: String,
        targetLanguage: String,
        serviceTier: ModelServiceTier,
        preferredModelID: String?
    ) {
        self.pageID = pageID
        self.sourceText = sourceText
        self.selectedText = selectedText
        self.contextBefore = contextBefore
        self.contextAfter = contextAfter
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.serviceTier = serviceTier
        self.preferredModelID = preferredModelID
    }

    enum CodingKeys: String, CodingKey {
        case pageID = "pageId"
        case sourceText
        case selectedText
        case contextBefore
        case contextAfter
        case sourceLanguage
        case targetLanguage
        case serviceTier
        case preferredModelID = "preferredModelId"
    }
}

public struct ModelServiceExplainResponse: Codable, Equatable, Sendable {
    public let pageID: String
    public let serviceTier: ModelServiceTier
    public let model: ModelCatalogOption
    public let translation: String
    public let explanation: String
    public let examples: [String]
    public let quota: ModelQuotaSnapshot
    public let error: ModelServiceError?

    public init(
        pageID: String,
        serviceTier: ModelServiceTier,
        model: ModelCatalogOption,
        translation: String,
        explanation: String,
        examples: [String],
        quota: ModelQuotaSnapshot,
        error: ModelServiceError?
    ) {
        self.pageID = pageID
        self.serviceTier = serviceTier
        self.model = model
        self.translation = translation
        self.explanation = explanation
        self.examples = examples
        self.quota = quota
        self.error = error
    }

    enum CodingKeys: String, CodingKey {
        case pageID = "pageId"
        case serviceTier
        case model
        case translation
        case explanation
        case examples
        case quota
        case error
    }
}

public struct ModelServiceVideoAudioTranslateRequest: Codable, Equatable, Sendable {
    public let pageID: String
    public let url: String
    public let title: String
    public let videoID: String?
    public let sourceLanguage: String
    public let targetLanguage: String
    public let serviceTier: ModelServiceTier
    public let preferredModelID: String?
    public let audioSegmentID: String
    public let audioDurationSeconds: Double
    public let captionText: String?
    public let captionQuality: String?
    public let manualAudioSelection: Bool?
    public let privacyDisclosureAccepted: Bool

    public init(
        pageID: String,
        url: String,
        title: String,
        videoID: String?,
        sourceLanguage: String,
        targetLanguage: String,
        serviceTier: ModelServiceTier,
        preferredModelID: String?,
        audioSegmentID: String,
        audioDurationSeconds: Double,
        captionText: String?,
        captionQuality: String?,
        manualAudioSelection: Bool?,
        privacyDisclosureAccepted: Bool
    ) {
        self.pageID = pageID
        self.url = url
        self.title = title
        self.videoID = videoID
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.serviceTier = serviceTier
        self.preferredModelID = preferredModelID
        self.audioSegmentID = audioSegmentID
        self.audioDurationSeconds = audioDurationSeconds
        self.captionText = captionText
        self.captionQuality = captionQuality
        self.manualAudioSelection = manualAudioSelection
        self.privacyDisclosureAccepted = privacyDisclosureAccepted
    }

    enum CodingKeys: String, CodingKey {
        case pageID = "pageId"
        case url
        case title
        case videoID = "videoId"
        case sourceLanguage
        case targetLanguage
        case serviceTier
        case preferredModelID = "preferredModelId"
        case audioSegmentID = "audioSegmentId"
        case audioDurationSeconds
        case captionText
        case captionQuality
        case manualAudioSelection
        case privacyDisclosureAccepted
    }
}

public struct ModelServiceVideoAudioTranslateResponse: Codable, Equatable, Sendable {
    public let pageID: String
    public let serviceTier: ModelServiceTier
    public let model: ModelCatalogOption
    public let segment: VideoAudioSegment?
    public let quota: AudioTranslationQuota
    public let state: VideoAudioTranslationState
    public let error: ModelServiceError?

    public init(
        pageID: String,
        serviceTier: ModelServiceTier,
        model: ModelCatalogOption,
        segment: VideoAudioSegment?,
        quota: AudioTranslationQuota,
        state: VideoAudioTranslationState,
        error: ModelServiceError?
    ) {
        self.pageID = pageID
        self.serviceTier = serviceTier
        self.model = model
        self.segment = segment
        self.quota = quota
        self.state = state
        self.error = error
    }

    enum CodingKeys: String, CodingKey {
        case pageID = "pageId"
        case serviceTier
        case model
        case segment
        case quota
        case state
        case error
    }
}

public enum ModelServiceTransportError: Error, Equatable {
    case service(ModelServiceError)
    case transport(ModelServiceErrorCode)

    var code: ModelServiceErrorCode {
        switch self {
        case .service(let error):
            error.code
        case .transport(let code):
            code
        }
    }

    var requiredTier: ModelServiceTier? {
        switch self {
        case .service(let error):
            error.requiredTier
        case .transport:
            nil
        }
    }
}

extension ModelServiceTransportError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .service(let error):
            return userFacingMessage(for: error.code, requiredTier: error.requiredTier)
        case .transport(let code):
            return userFacingMessage(for: code, requiredTier: nil)
        }
    }

    private func userFacingMessage(
        for code: ModelServiceErrorCode,
        requiredTier: ModelServiceTier?
    ) -> String {
        switch code {
        case .quotaExceeded:
            return "今日模型服务额度不足，请稍后再试。"
        case .tierUnavailable:
            if let requiredTier {
                return "当前账号暂不能使用该模型，需要 \(requiredTier.displayName) 等级。"
            }
            return "当前账号暂不能使用该模型。"
        case .serviceUnavailable, .providerFallbackFailed:
            return "未连接到模型服务。请先启动模型网关，并在 Xcode Scheme 或 Info.plist 配置 MODEL_SERVICE_ROOT。"
        case .contentTooLong:
            return "本次内容过长，请缩短后再试。"
        case .privacyDisclosureRequired:
            return "开启听音翻译前，请先确认隐私提示。"
        }
    }
}
