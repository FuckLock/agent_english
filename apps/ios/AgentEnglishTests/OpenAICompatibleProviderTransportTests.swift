import Foundation
import XCTest
@testable import AgentEnglishCore

final class ModelServiceTransportRequestTests: XCTestCase {
    override func tearDownWithError() throws {
        try? KeychainCredentialStore.deleteSessionToken()
        RecordingURLProtocol.handler = nil
    }

    func testCatalogRequestIncludesSessionTokenHeader() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RecordingURLProtocol.self]
        let session = URLSession(configuration: config)
        let transport = URLSessionModelServiceTransport(
            serviceRoot: URL(string: "https://example.com")!,
            session: session,
            tokenProvider: { "session-token-pro" }
        )

        RecordingURLProtocol.handler = { request in
            XCTAssertEqual(
                request.value(forHTTPHeaderField: "Authorization"),
                "Bearer session-token-pro"
            )
            XCTAssertEqual(request.url?.path, "/v1/model-catalog")
            let payload = """
            {
              "currentTier": "pro",
              "availableTiers": ["free", "pro", "max"],
              "defaultModelId": "pro-context",
              "options": [],
              "quota": {
                "status": "ok",
                "used": 12,
                "limit": 200,
                "remaining": 188,
                "resetAt": "2026-05-22T00:00:00Z"
              },
              "lastUpdatedAt": "2026-05-22T00:00:00Z"
            }
            """.data(using: .utf8)!
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (response, payload)
        }

        let catalog = try await transport.catalog(for: .free)

        XCTAssertEqual(catalog.currentTier, .pro)
        XCTAssertEqual(catalog.defaultModelID, "pro-context")
    }

    func testCatalogRequestBootstrapsGuestSessionWhenKeychainTokenIsMissing() async throws {
        try? KeychainCredentialStore.deleteSessionToken()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RecordingURLProtocol.self]
        let session = URLSession(configuration: config)
        let transport = URLSessionModelServiceTransport(
            serviceRoot: URL(string: "https://example.com")!,
            session: session,
            tokenProvider: { nil }
        )
        var paths: [String] = []

        RecordingURLProtocol.handler = { request in
            paths.append(request.url?.path ?? "")
            if request.url?.path == "/v1/sessions/guest" {
                XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
                let payload = """
                {
                  "sessionToken": "guest-session-token",
                  "expiresAt": "2026-06-21T00:00:00Z",
                  "account": {
                    "kind": "guest",
                    "displayName": "游客模式",
                    "serviceTier": "free",
                    "isTestAccount": false
                  },
                  "entitlement": {
                    "account": {
                      "kind": "guest",
                      "displayName": "游客模式",
                      "serviceTier": "free",
                      "isTestAccount": false
                    },
                    "serviceTier": "free",
                    "quota": {
                      "status": "ok",
                      "used": 0,
                      "limit": 20,
                      "remaining": 20,
                      "resetAt": "2026-05-23T00:00:00Z"
                    },
                    "catalog": {
                      "currentTier": "free",
                      "availableTiers": ["free", "pro", "max"],
                      "defaultModelId": "free-translate",
                      "options": [],
                      "quota": {
                        "status": "ok",
                        "used": 0,
                        "limit": 20,
                        "remaining": 20,
                        "resetAt": "2026-05-23T00:00:00Z"
                      },
                      "lastUpdatedAt": "2026-05-22T00:00:00Z"
                    },
                    "refreshedAt": "2026-05-22T00:00:00Z"
                  }
                }
                """.data(using: .utf8)!
                let response = HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                return (response, payload)
            }

            XCTAssertEqual(request.url?.path, "/v1/model-catalog")
            XCTAssertEqual(
                request.value(forHTTPHeaderField: "Authorization"),
                "Bearer guest-session-token"
            )
            let payload = """
            {
              "currentTier": "free",
              "availableTiers": ["free", "pro", "max"],
              "defaultModelId": "free-translate",
              "options": [],
              "quota": {
                "status": "ok",
                "used": 0,
                "limit": 20,
                "remaining": 20,
                "resetAt": "2026-05-23T00:00:00Z"
              },
              "lastUpdatedAt": "2026-05-22T00:00:00Z"
            }
            """.data(using: .utf8)!
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (response, payload)
        }

        let catalog = try await transport.catalog(for: .free)

        XCTAssertEqual(paths, ["/v1/sessions/guest", "/v1/model-catalog"])
        XCTAssertEqual(catalog.currentTier, .free)
        XCTAssertEqual(try KeychainCredentialStore.loadSessionToken(), "guest-session-token")
    }
}

private final class RecordingURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.handler else {
            fatalError("RecordingURLProtocol.handler was not configured.")
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
