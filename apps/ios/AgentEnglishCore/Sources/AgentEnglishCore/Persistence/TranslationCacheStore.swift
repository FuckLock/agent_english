import Foundation
import SwiftData

@MainActor
public final class TranslationCacheStore {
    private let modelContext: ModelContext

    public init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    public static func makeDefault() throws -> TranslationCacheStore {
        let container = try AppModelContainer.makeDefaultContainer(seedSampleData: true)
        return TranslationCacheStore(modelContext: container.mainContext)
    }

    public func cachedResult(for request: TranslationRequest) throws -> TranslationResult? {
        let cacheRecords = try modelContext.fetch(FetchDescriptor<TranslationCacheRecord>())
        let cachedPageHash = pageHash(for: request)

        let matchingRecords = request.segments.compactMap { segment -> TranslationCacheRecord? in
            let cachedTextHash = textHash(for: segment)
            return cacheRecords.first { record in
                record.pageHash == cachedPageHash && record.textHash == cachedTextHash
            }
        }

        guard matchingRecords.count == request.segments.count else {
            return nil
        }

        let segmentResults = matchingRecords.map { record in
            TranslationSegmentResult(
                segmentId: record.segmentId,
                translatedText: record.translatedText,
                failureReason: record.failureReason.flatMap(TranslationFailureReason.init(rawValue:))
            )
        }

        let resultsBySegmentId = Dictionary(
            uniqueKeysWithValues: segmentResults.map { segmentResult in
                (segmentResult.segmentId, segmentResult)
            }
        )
        let overallFailureReason = segmentResults.allSatisfy { $0.failureReason != nil }
            ? segmentResults.first?.failureReason
            : nil

        return TranslationResult(
            pageId: request.pageId,
            sourceLanguage: request.sourceLanguage,
            targetLanguage: request.targetLanguage,
            displayMode: request.displayMode,
            capabilities: request.capabilities,
            segmentResults: segmentResults,
            resultsBySegmentId: resultsBySegmentId,
            failureReason: overallFailureReason
        )
    }

    public func store(
        _ translationResult: TranslationResult,
        for request: TranslationRequest
    ) throws {
        let cacheRecords = try modelContext.fetch(FetchDescriptor<TranslationCacheRecord>())
        let cachedPageHash = pageHash(for: request)
        let capabilitiesKey = translationResult.capabilities.map(\.rawValue).joined(separator: ",")
        let segmentsById = Dictionary(
            uniqueKeysWithValues: request.segments.map { segment in
                (segment.segmentId, segment)
            }
        )

        for segmentResult in translationResult.segmentResults {
            guard let segment = segmentsById[segmentResult.segmentId] else {
                continue
            }

            let cachedTextHash = textHash(for: segment)
            let existingRecord = cacheRecords.first { record in
                record.pageHash == cachedPageHash && record.textHash == cachedTextHash
            }

            if let existingRecord {
                existingRecord.pageId = request.pageId
                existingRecord.segmentId = segment.segmentId
                existingRecord.sourceLanguage = request.sourceLanguage
                existingRecord.targetLanguage = request.targetLanguage
                existingRecord.displayMode = request.displayMode.rawValue
                existingRecord.capabilitiesKey = capabilitiesKey
                existingRecord.sourceText = segment.sourceText
                existingRecord.translatedText = segmentResult.translatedText
                existingRecord.failureReason = segmentResult.failureReason?.rawValue
                existingRecord.cachedAt = .now
            } else {
                modelContext.insert(
                    TranslationCacheRecord(
                        pageId: request.pageId,
                        pageHash: cachedPageHash,
                        segmentId: segment.segmentId,
                        textHash: cachedTextHash,
                        sourceLanguage: request.sourceLanguage,
                        targetLanguage: request.targetLanguage,
                        displayMode: request.displayMode.rawValue,
                        capabilitiesKey: capabilitiesKey,
                        sourceText: segment.sourceText,
                        translatedText: segmentResult.translatedText,
                        failureReason: segmentResult.failureReason?.rawValue
                    )
                )
            }
        }

        try modelContext.save()
    }

    private func pageHash(for request: TranslationRequest) -> String {
        stableHash(
            request.pageContext.url,
            request.sourceLanguage,
            request.targetLanguage,
            request.displayMode.rawValue
        )
    }

    private func textHash(for segment: PageTextSegment) -> String {
        stableHash(segment.sourceText)
    }

    private func stableHash(_ values: String...) -> String {
        var hash = UInt64(1469598103934665603)
        let separator = "|"

        for value in values.joined(separator: separator).unicodeScalars {
            hash ^= UInt64(value.value)
            hash = hash &* 1099511628211
        }

        return String(hash, radix: 16)
    }
}
