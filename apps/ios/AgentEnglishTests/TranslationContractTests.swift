import Foundation
import XCTest
@testable import AgentEnglishCore

final class TranslationContractTests: XCTestCase {
    func testDecodesTranslationRequestedContractFixture() throws {
        let event = try BridgeEventDecoder().decode(
            """
            {
              "schemaVersion": 1,
              "eventType": "translation.requested",
              "requestId": "translation-requested-page-1",
              "pageId": "page-1",
              "payload": {
                "pageId": "page-1",
                "pageContext": {
                  "pageId": "page-1",
                  "url": "https://example.com/article",
                  "title": "Example Article",
                  "sourceLanguage": "English",
                  "targetLanguage": "简体中文",
                  "displayMode": "bilingual",
                  "capabilities": ["readable-page", "inline-translation", "selection-fallback"],
                  "siteKind": "generic"
                },
                "sourceLanguage": "English",
                "targetLanguage": "简体中文",
                "displayMode": "bilingual",
                "capabilities": ["readable-page", "inline-translation", "selection-fallback"],
                "segments": [
                  {
                    "pageId": "page-1",
                    "segmentId": "seg-1",
                    "sourceText": "Hello world.",
                    "containerPath": "body>article:nth-of-type(1)>p:nth-of-type(1)",
                    "sourceLanguage": "English",
                    "isVisible": true,
                    "capabilities": ["readable-page", "inline-translation"]
                  }
                ]
              }
            }
            """.data(using: .utf8)!
        )

        guard case .translationRequested(let payload) = event.payload else {
            XCTFail("Expected translationRequested payload.")
            return
        }

        XCTAssertEqual(event.schemaVersion, bridgeSchemaVersion)
        XCTAssertEqual(event.requestId, "translation-requested-page-1")
        XCTAssertEqual(payload.pageContext.pageId, "page-1")
        XCTAssertEqual(payload.pageContext.sourceLanguage, "English")
        XCTAssertEqual(payload.pageContext.targetLanguage, "简体中文")
        XCTAssertEqual(payload.pageContext.displayMode, .bilingual)
        XCTAssertEqual(payload.pageContext.capabilities, [.readablePage, .inlineTranslation, .selectionFallback])
        XCTAssertEqual(payload.segments.first?.segmentId, "seg-1")
    }

    func testDecodesTranslationCompletedRoundTripFields() throws {
        let event = try BridgeEventDecoder().decode(
            """
            {
              "schemaVersion": 1,
              "eventType": "translation.completed",
              "requestId": "translation-completed-page-1",
              "pageId": "page-1",
              "payload": {
                "pageId": "page-1",
                "sourceLanguage": "English",
                "targetLanguage": "简体中文",
                "displayMode": "learning",
                "capabilities": ["readable-page", "selection-fallback"],
                "segmentResults": [
                  {
                    "segmentId": "seg-1",
                    "translatedText": "第一段。"
                  }
                ],
                "resultsBySegmentId": {
                  "seg-1": {
                    "segmentId": "seg-1",
                    "translatedText": "第一段。"
                  }
                }
              }
            }
            """.data(using: .utf8)!
        )

        guard case .translationCompleted(let payload) = event.payload else {
            XCTFail("Expected translationCompleted payload.")
            return
        }

        XCTAssertEqual(payload.displayMode, .learning)
        XCTAssertEqual(payload.resultsBySegmentId["seg-1"]?.translatedText, "第一段。")
        XCTAssertEqual(payload.segmentResults.first?.segmentId, "seg-1")
    }

    func testDecodesTranslationFailedFailureReason() throws {
        let event = try BridgeEventDecoder().decode(
            """
            {
              "schemaVersion": 1,
              "eventType": "translation.failed",
              "requestId": "translation-failed-page-1",
              "pageId": "page-1",
              "payload": {
                "pageId": "page-1",
                "segmentId": "seg-1",
                "sourceLanguage": "English",
                "targetLanguage": "简体中文",
                "displayMode": "bilingual",
                "capabilities": ["readable-page", "selection-fallback"],
                "failureReason": "translation-failed"
              }
            }
            """.data(using: .utf8)!
        )

        guard case .translationFailed(let payload) = event.payload else {
            XCTFail("Expected translationFailed payload.")
            return
        }

        XCTAssertEqual(payload.failureReason, .translationFailed)
        XCTAssertEqual(payload.segmentId, "seg-1")
    }
}
