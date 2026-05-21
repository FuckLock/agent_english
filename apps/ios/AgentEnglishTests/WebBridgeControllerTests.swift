import Foundation
import XCTest
@testable import AgentEnglishCore

final class WebBridgeControllerTests: XCTestCase {
    func testDecodesBootEventEnvelope() throws {
        let event = try BridgeEventDecoder().decode(
            """
            {
              "schemaVersion": 1,
              "eventType": "bridge.boot",
              "requestId": "boot-session-1",
              "pageId": "page-session-1",
              "payload": {
                "sessionId": "session-1",
                "bridgeScope": "bootstrap"
              }
            }
            """.data(using: .utf8)!
        )

        XCTAssertEqual(event.schemaVersion, bridgeSchemaVersion)
        XCTAssertEqual(event.eventType, .boot)
        XCTAssertEqual(event.requestId, "boot-session-1")
        XCTAssertEqual(event.pageId, "page-session-1")
        XCTAssertEqual(event.payload, .boot(.init(sessionId: "session-1", bridgeScope: "bootstrap")))
    }

    func testDecodesPageReadyEventEnvelope() throws {
        let event = try BridgeEventDecoder().decode(
            """
            {
              "schemaVersion": 1,
              "eventType": "page.ready",
              "requestId": "page-ready-session-1",
              "pageId": "page-session-1",
              "payload": {
                "sessionId": "session-1",
                "url": "https://www.wikipedia.org",
                "title": "Wikipedia",
                "loadedAt": "2026-05-20T00:00:00.000Z"
              }
            }
            """.data(using: .utf8)!
        )

        XCTAssertEqual(event.eventType, .pageReady)
        XCTAssertEqual(
            event.payload,
            .pageReady(
                .init(
                    sessionId: "session-1",
                    url: "https://www.wikipedia.org",
                    title: "Wikipedia",
                    loadedAt: "2026-05-20T00:00:00.000Z"
                )
            )
        )
    }

    func testRejectsUnsupportedBridgeEventType() throws {
        XCTAssertThrowsError(
            try BridgeEventDecoder().decode(
                """
                {
                  "schemaVersion": 1,
                  "eventType": "translation.unknown",
                  "payload": {}
                }
                """.data(using: .utf8)!
            )
        ) { error in
            XCTAssertEqual(
                error as? BridgeEventDecodingError,
                .unsupportedEventType("translation.unknown")
            )
        }
    }

    func testRejectsUnsupportedSchemaVersion() throws {
        XCTAssertThrowsError(
            try BridgeEventDecoder().decode(
                """
                {
                  "schemaVersion": 2,
                  "eventType": "bridge.boot",
                  "payload": {
                    "sessionId": "session-1",
                    "bridgeScope": "bootstrap"
                  }
                }
                """.data(using: .utf8)!
            )
        ) { error in
            XCTAssertEqual(
                error as? BridgeEventDecodingError,
                .unsupportedSchemaVersion(2)
            )
        }
    }

    func testDecodesSelectionRequestedPayloadFields() throws {
        let event = try BridgeEventDecoder().decode(
            """
            {
              "schemaVersion": 1,
              "eventType": "selection.requested",
              "requestId": "selection-requested-sel-1",
              "pageId": "page-1",
              "payload": {
                "pageId": "page-1",
                "selectionId": "sel-1",
                "selectedText": "gloss over",
                "contextBefore": "They tried to",
                "contextAfter": "the policy change.",
                "sourceUrl": "https://example.com/article",
                "sourceTitle": "Example Article",
                "containerPath": "body>article:nth-of-type(1)>p:nth-of-type(1)",
                "kind": "phrase"
              }
            }
            """.data(using: .utf8)!
        )

        guard case .selectionRequested(let payload) = event.payload else {
            XCTFail("Expected selectionRequested payload.")
            return
        }

        XCTAssertEqual(event.schemaVersion, bridgeSchemaVersion)
        XCTAssertEqual(event.requestId, "selection-requested-sel-1")
        XCTAssertEqual(payload.selectionId, "sel-1")
        XCTAssertEqual(payload.pageId, "page-1")
        XCTAssertEqual(payload.sourceUrl, "https://example.com/article")
        XCTAssertEqual(payload.sourceTitle, "Example Article")
        XCTAssertEqual(payload.contextBefore, "They tried to")
        XCTAssertEqual(payload.contextAfter, "the policy change.")
    }

    func testDecodesSelectionFailurePayloadFields() throws {
        let event = try BridgeEventDecoder().decode(
            """
            {
              "schemaVersion": 1,
              "eventType": "selection.explanation.failed",
              "requestId": "selection-failed-sel-1",
              "pageId": "page-1",
              "payload": {
                "pageId": "page-1",
                "selectionId": "sel-1",
                "selectedText": "gloss over",
                "contextBefore": "They tried to",
                "contextAfter": "the policy change.",
                "sourceUrl": "https://example.com/article",
                "sourceTitle": "Example Article",
                "containerPath": "body>article:nth-of-type(1)>p:nth-of-type(1)",
                "kind": "phrase",
                "failureReason": "selection-explanation-failed"
              }
            }
            """.data(using: .utf8)!
        )

        guard case .selectionExplanationFailed(let payload) = event.payload else {
            XCTFail("Expected selectionExplanationFailed payload.")
            return
        }

        XCTAssertEqual(payload.selectionId, "sel-1")
        XCTAssertEqual(payload.sourceUrl, "https://example.com/article")
        XCTAssertEqual(payload.sourceTitle, "Example Article")
        XCTAssertEqual(payload.failureReason, .selectionExplanationFailed)
    }
}
