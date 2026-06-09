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

    func testDecodesDefaultModelIdAndMinTierFromJSON() throws {
        // E1 双端等价：投影 JSON 的 minTier key 解码为 ModelCatalogOption.minTier
        // （与 packages/contracts fixture 字段名一致：均为 minTier，无目录项 tier key）。
        let payload = """
        {
          "currentTier": "free",
          "availableTiers": ["free", "pro", "max"],
          "defaultModelId": "deepseek-chat",
          "options": [
            {
              "id": "openai-gpt-4o",
              "minTier": "pro",
              "displayName": "Pro 模型 · openai-gpt-4o",
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

        XCTAssertEqual(decoded.defaultModelID, "deepseek-chat")
        XCTAssertEqual(decoded.options.first?.minTier, .pro)
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

    func testVideoAudioTranslateMapsQuotaExceededAndServiceUnavailable() async {
        let quotaClient = ModelServiceClient(
            transport: VideoAudioFailingTransport(code: .quotaExceeded)
        )
        let quotaResponse = await quotaClient.videoAudioTranslate(videoAudioRequest(privacyDisclosureAccepted: true))
        XCTAssertEqual(quotaResponse.error?.code, .quotaExceeded)
        XCTAssertEqual(quotaResponse.state.status, .quotaExhausted)

        let serviceClient = ModelServiceClient(
            transport: VideoAudioFailingTransport(code: .serviceUnavailable)
        )
        let serviceResponse = await serviceClient.videoAudioTranslate(videoAudioRequest(privacyDisclosureAccepted: true))
        XCTAssertEqual(serviceResponse.error?.code, .serviceUnavailable)
        XCTAssertEqual(serviceResponse.state.status, .failed)
    }

    func testVideoAudioRequestRequiresPrivacyDisclosureState() async {
        let client = ModelServiceClient(transport: PreviewModelServiceTransport())
        let response = await client.videoAudioTranslate(
            videoAudioRequest(privacyDisclosureAccepted: false)
        )

        XCTAssertEqual(response.error?.code, .privacyDisclosureRequired)
        XCTAssertEqual(response.state.status, .privacyRequired)
    }

    func testVideoAudioCatalogDecodesAudioQuotaFields() throws {
        let payload = """
        {
          "currentTier": "free",
          "availableTiers": ["free", "pro", "max"],
          "defaultModelId": "deepseek-chat",
          "options": [],
          "quota": {
            "status": "ok",
            "used": 3,
            "limit": 20,
            "remaining": 17,
            "resetAt": "2026-05-25T00:00:00Z"
          },
          "audioQuota": {
            "status": "ok",
            "used": 3,
            "limit": 10,
            "remaining": 7,
            "resetAt": "2026-05-25T00:00:00Z"
          },
          "lastUpdatedAt": "2026-05-24T00:00:00Z"
        }
        """.data(using: .utf8)!

        let catalog = try JSONDecoder().decode(ModelCatalogSnapshot.self, from: payload)

        XCTAssertEqual(catalog.audioQuota?.limit, 10)
        XCTAssertEqual(catalog.audioQuota?.remaining, 7)
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

private struct VideoAudioFailingTransport: ModelServiceTransport {
    let code: ModelServiceErrorCode

    func catalog(for serviceTier: ModelServiceTier) async throws -> ModelCatalogSnapshot {
        ModelCatalogSnapshot.preview(currentTier: serviceTier)
    }

    func translate(_ request: ModelServiceTranslateRequest) async throws -> ModelServiceTranslateResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }

    func explain(_ request: ModelServiceExplainRequest) async throws -> ModelServiceExplainResponse {
        _ = request
        throw ModelServiceTransportError.transport(.serviceUnavailable)
    }

    func videoAudioTranslate(_ request: ModelServiceVideoAudioTranslateRequest) async throws -> ModelServiceVideoAudioTranslateResponse {
        _ = request
        throw ModelServiceTransportError.transport(code)
    }
}

private func videoAudioRequest(
    privacyDisclosureAccepted: Bool
) -> ModelServiceVideoAudioTranslateRequest {
    ModelServiceVideoAudioTranslateRequest(
        pageID: "page-youtube-watch-1",
        url: "https://m.youtube.com/watch?v=LmFME_-3icE",
        title: "Hydrogen Peroxide",
        videoID: "LmFME_-3icE",
        sourceLanguage: "English",
        targetLanguage: "简体中文",
        serviceTier: .free,
        preferredModelID: "deepseek-chat",
        audioSegmentID: "vaud-1",
        audioDurationSeconds: 42,
        captionText: nil,
        captionQuality: "unavailable",
        manualAudioSelection: nil,
        privacyDisclosureAccepted: privacyDisclosureAccepted
    )
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
