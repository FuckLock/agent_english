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
                  "eventType": "translation.requested",
                  "payload": {}
                }
                """.data(using: .utf8)!
            )
        ) { error in
            XCTAssertEqual(
                error as? BridgeEventDecodingError,
                .unsupportedEventType("translation.requested")
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
}
