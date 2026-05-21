import Foundation

public protocol TranslationProviderTransport: Sendable {
    func translateBatch(
        request: TranslationRequest,
        segments: [PageTextSegment],
        credentialReference: String
    ) async throws -> [TranslationSegmentResult]
}

public struct PreviewTranslationTransport: TranslationProviderTransport {
    public init() {}

    public func translateBatch(
        request: TranslationRequest,
        segments: [PageTextSegment],
        credentialReference: String
    ) async throws -> [TranslationSegmentResult] {
        _ = request
        _ = credentialReference

        return segments.map { segment in
            TranslationSegmentResult(
                segmentId: segment.segmentId,
                translatedText: "[ZH] \(segment.sourceText)",
                failureReason: nil
            )
        }
    }
}

public struct TranslationProviderClientConfiguration: Sendable {
    public let maxSegmentsPerBatch: Int
    public let maxRetryAttempts: Int

    public init(
        maxSegmentsPerBatch: Int = 4,
        maxRetryAttempts: Int = 2
    ) {
        self.maxSegmentsPerBatch = max(1, maxSegmentsPerBatch)
        self.maxRetryAttempts = max(0, maxRetryAttempts)
    }
}

public actor TranslationProviderClient {
    private let transport: any TranslationProviderTransport
    private let configuration: TranslationProviderClientConfiguration

    public init(
        transport: any TranslationProviderTransport = PreviewTranslationTransport(),
        configuration: TranslationProviderClientConfiguration = .init()
    ) {
        self.transport = transport
        self.configuration = configuration
    }

    public func translate(
        _ request: TranslationRequest,
        credentialReference: String?
    ) async -> TranslationResult {
        guard let credentialReference, !credentialReference.isEmpty else {
            return failureResult(
                for: request,
                failureReason: .providerNotConfigured,
                segmentIds: request.segments.map(\.segmentId)
            )
        }

        var aggregatedSegmentResults: [TranslationSegmentResult] = []
        var batchFailures = false

        for batch in segmentBatches(from: request.segments) {
            do {
                let batchResults = try await translateBatch(
                    request,
                    batch: batch,
                    credentialReference: credentialReference
                )
                aggregatedSegmentResults.append(contentsOf: batchResults)
            } catch {
                batchFailures = true
                aggregatedSegmentResults.append(
                    contentsOf: batch.map { segment in
                        TranslationSegmentResult(
                            segmentId: segment.segmentId,
                            translatedText: nil,
                            failureReason: .translationFailed
                        )
                    }
                )
            }
        }

        return makeResult(
            from: request,
            segmentResults: aggregatedSegmentResults,
            failureReason: batchFailures ? .translationFailed : nil
        )
    }

    private func translateBatch(
        _ request: TranslationRequest,
        batch: [PageTextSegment],
        credentialReference: String
    ) async throws -> [TranslationSegmentResult] {
        var attempt = 0

        while true {
            do {
                return try await transport.translateBatch(
                    request: request,
                    segments: batch,
                    credentialReference: credentialReference
                )
            } catch {
                if attempt >= configuration.maxRetryAttempts {
                    throw error
                }

                attempt += 1
            }
        }
    }

    private func segmentBatches(
        from segments: [PageTextSegment]
    ) -> [[PageTextSegment]] {
        stride(from: 0, to: segments.count, by: configuration.maxSegmentsPerBatch)
            .map { startIndex in
                let endIndex = min(startIndex + configuration.maxSegmentsPerBatch, segments.count)
                return Array(segments[startIndex..<endIndex])
            }
    }

    private func failureResult(
        for request: TranslationRequest,
        failureReason: TranslationFailureReason,
        segmentIds: [String]
    ) -> TranslationResult {
        makeResult(
            from: request,
            segmentResults: segmentIds.map { segmentId in
                TranslationSegmentResult(
                    segmentId: segmentId,
                    translatedText: nil,
                    failureReason: failureReason
                )
            },
            failureReason: failureReason
        )
    }

    private func makeResult(
        from request: TranslationRequest,
        segmentResults: [TranslationSegmentResult],
        failureReason: TranslationFailureReason?
    ) -> TranslationResult {
        let resultsBySegmentId = Dictionary(
            uniqueKeysWithValues: segmentResults.map { segmentResult in
                (segmentResult.segmentId, segmentResult)
            }
        )

        return TranslationResult(
            pageId: request.pageId,
            sourceLanguage: request.sourceLanguage,
            targetLanguage: request.targetLanguage,
            displayMode: request.displayMode,
            capabilities: request.capabilities,
            segmentResults: segmentResults,
            resultsBySegmentId: resultsBySegmentId,
            failureReason: failureReason
        )
    }
}
