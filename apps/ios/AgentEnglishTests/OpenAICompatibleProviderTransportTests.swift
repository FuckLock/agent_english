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
              "defaultModelId": "openai-gpt-4o",
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
        XCTAssertEqual(catalog.defaultModelID, "openai-gpt-4o")
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
                      "defaultModelId": "deepseek-chat",
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
              "defaultModelId": "deepseek-chat",
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

    func testStaleSessionTokenGets401ThenReissuesGuestSessionAndRetriesOnce() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RecordingURLProtocol.self]
        let session = URLSession(configuration: config)
        let transport = URLSessionModelServiceTransport(
            serviceRoot: URL(string: "https://example.com")!,
            session: session,
            tokenProvider: { "stale-session-token" }
        )
        var requests: [(path: String, authorization: String?)] = []

        RecordingURLProtocol.handler = { request in
            requests.append((request.url?.path ?? "", request.value(forHTTPHeaderField: "Authorization")))

            if request.url?.path == "/v1/sessions/guest" {
                return (
                    Self.jsonResponse(for: request),
                    Self.guestSessionPayload(token: "reissued-guest-token")
                )
            }

            if request.value(forHTTPHeaderField: "Authorization") == "Bearer stale-session-token" {
                let payload = """
                {"error":{"code":"service-unavailable","message":"Model service session is invalid or expired.","retryable":true}}
                """.data(using: .utf8)!
                return (Self.jsonResponse(for: request, statusCode: 401), payload)
            }

            XCTAssertEqual(
                request.value(forHTTPHeaderField: "Authorization"),
                "Bearer reissued-guest-token"
            )
            return (Self.jsonResponse(for: request), Self.freeCatalogPayload)
        }

        let catalog = try await transport.catalog(for: .free)

        XCTAssertEqual(
            requests.map(\.path),
            ["/v1/model-catalog", "/v1/sessions/guest", "/v1/model-catalog"]
        )
        // 换发时带上旧 token，gateway 可尝试恢复后再决定换发
        XCTAssertEqual(requests[1].authorization, "Bearer stale-session-token")
        XCTAssertEqual(catalog.currentTier, .free)
        XCTAssertEqual(try KeychainCredentialStore.loadSessionToken(), "reissued-guest-token")
    }

    func testRetryAfter401HappensOnlyOnceWhenSessionStaysInvalid() async {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RecordingURLProtocol.self]
        let session = URLSession(configuration: config)
        let transport = URLSessionModelServiceTransport(
            serviceRoot: URL(string: "https://example.com")!,
            session: session,
            tokenProvider: { "stale-session-token" }
        )
        var paths: [String] = []

        RecordingURLProtocol.handler = { request in
            paths.append(request.url?.path ?? "")

            if request.url?.path == "/v1/sessions/guest" {
                return (
                    Self.jsonResponse(for: request),
                    Self.guestSessionPayload(token: "reissued-guest-token")
                )
            }

            let payload = """
            {"error":{"code":"service-unavailable","message":"Model service session is invalid or expired.","retryable":true}}
            """.data(using: .utf8)!
            return (Self.jsonResponse(for: request, statusCode: 401), payload)
        }

        do {
            _ = try await transport.catalog(for: .free)
            XCTFail("Expected transport to throw after the single 401 retry failed.")
        } catch {
            XCTAssertEqual((error as? ModelServiceTransportError)?.code, .serviceUnavailable)
        }
        XCTAssertEqual(
            paths,
            ["/v1/model-catalog", "/v1/sessions/guest", "/v1/model-catalog"]
        )
    }

    private static func jsonResponse(for request: URLRequest, statusCode: Int = 200) -> HTTPURLResponse {
        HTTPURLResponse(
            url: request.url!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
    }

    private static let freeCatalogPayload = """
    {
      "currentTier": "free",
      "availableTiers": ["free", "pro", "max"],
      "defaultModelId": "deepseek-chat",
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

    private static func guestSessionPayload(token: String) -> Data {
        """
        {
          "sessionToken": "\(token)",
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
              "defaultModelId": "deepseek-chat",
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
