import Foundation
import XCTest
@testable import AgentEnglishCore

final class ModelServiceClientTests: XCTestCase {
    func testPreviewCatalogContainsFreeProMax() async throws {
        let client = ModelServiceClient(transport: PreviewModelServiceTransport())
        let catalog = try await client.catalog(for: .free)

        XCTAssertEqual(catalog.availableTiers, [.free, .pro, .max])
        XCTAssertEqual(catalog.options.first?.displayName.contains("Free"), true)
    }

    func testUserFacingMessageMapsTierAndQuotaErrors() {
        XCTAssertEqual(
            ModelServiceClient.userMessage(for: .quotaExceeded),
            "今日额度不足，请稍后再试。"
        )
        XCTAssertEqual(
            ModelServiceClient.userMessage(for: .serviceUnavailable),
            "模型服务暂不可用，请稍后重试。"
        )
    }

    func testDecodesDefaultModelIdAndRequiredTierFromJSON() throws {
        let payload = """
        {
          "currentTier": "free",
          "availableTiers": ["free", "pro", "max"],
          "defaultModelId": "free-translate",
          "options": [
            {
              "id": "pro-context",
              "tier": "pro",
              "displayName": "Pro 模型 · 语境精读",
              "summary": "适合整段语境解释。",
              "capabilities": ["translation", "explanation"],
              "availability": "requiresTier",
              "requiredTier": "pro",
              "quota": {
                "status": "ok",
                "used": 2,
                "limit": 200,
                "remaining": 198,
                "resetAt": "2026-05-22T00:00:00Z"
              }
            }
          ],
          "quota": {
            "status": "ok",
            "used": 2,
            "limit": 20,
            "remaining": 18,
            "resetAt": "2026-05-22T00:00:00Z"
          },
          "lastUpdatedAt": "2026-05-22T00:00:00Z"
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(ModelCatalogSnapshot.self, from: payload)

        XCTAssertEqual(decoded.defaultModelID, "free-translate")
        XCTAssertEqual(decoded.options.first?.requiredTier, .pro)
    }

    func testCatalogThrowsWhenRemoteTransportFails() async {
        let client = ModelServiceClient(transport: FailingCatalogTransport())

        await XCTAssertThrowsErrorAsync(
            try await client.catalog(for: .free)
        )
    }

    func testTransportErrorHasActionableLocalizedMessage() {
        let error = ModelServiceTransportError.transport(.serviceUnavailable)

        XCTAssertEqual(
            error.localizedDescription,
            "未连接到模型服务。请先启动模型网关，并在 Xcode Scheme 或 Info.plist 配置 MODEL_SERVICE_ROOT。"
        )
    }
}

private struct FailingCatalogTransport: ModelServiceTransport {
    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        _ = serviceTier
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }

    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }

    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }
}

private func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        _ = try await expression()
        XCTFail("Expected async expression to throw.", file: file, line: line)
    } catch {
        XCTAssertTrue(true, file: file, line: line)
    }
}
