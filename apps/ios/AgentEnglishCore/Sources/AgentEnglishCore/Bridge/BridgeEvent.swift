import Foundation

public let bridgeSchemaVersion = 1

public enum BridgeEventType: String, CaseIterable, Sendable {
    case boot = "bridge.boot"
    case ping = "bridge.ping"
    case pageReady = "page.ready"
}

public struct BridgeBootPayload: Codable, Equatable, Sendable {
    public let sessionId: String
    public let bridgeScope: String
}

public struct BridgePingPayload: Codable, Equatable, Sendable {
    public let sessionId: String
    public let sentAt: String
}

public struct BridgePageReadyPayload: Codable, Equatable, Sendable {
    public let sessionId: String
    public let url: String
    public let title: String
    public let loadedAt: String
}

public enum BridgeEventPayload: Equatable, Sendable {
    case boot(BridgeBootPayload)
    case ping(BridgePingPayload)
    case pageReady(BridgePageReadyPayload)
}

public struct BridgeEvent: Equatable, Sendable {
    public let schemaVersion: Int
    public let eventType: BridgeEventType
    public let requestId: String?
    public let pageId: String?
    public let payload: BridgeEventPayload
}

public enum BridgeEventDecodingError: Error, Equatable {
    case unsupportedSchemaVersion(Int)
    case unsupportedEventType(String)
    case malformedPayload(String)
}

public struct BridgeEventDecoder: Sendable {
    public init() {}

    public func decode(_ data: Data) throws -> BridgeEvent {
        let decoder = JSONDecoder()
        let head = try decoder.decode(BridgeEventHead.self, from: data)

        guard head.schemaVersion == bridgeSchemaVersion else {
            throw BridgeEventDecodingError.unsupportedSchemaVersion(head.schemaVersion)
        }

        guard let eventType = BridgeEventType(rawValue: head.eventType) else {
            throw BridgeEventDecodingError.unsupportedEventType(head.eventType)
        }

        do {
            switch eventType {
            case .boot:
                let envelope = try decoder.decode(TypedBridgeEventEnvelope<BridgeBootPayload>.self, from: data)
                return BridgeEvent(
                    schemaVersion: envelope.schemaVersion,
                    eventType: eventType,
                    requestId: envelope.requestId,
                    pageId: envelope.pageId,
                    payload: .boot(envelope.payload)
                )
            case .ping:
                let envelope = try decoder.decode(TypedBridgeEventEnvelope<BridgePingPayload>.self, from: data)
                return BridgeEvent(
                    schemaVersion: envelope.schemaVersion,
                    eventType: eventType,
                    requestId: envelope.requestId,
                    pageId: envelope.pageId,
                    payload: .ping(envelope.payload)
                )
            case .pageReady:
                let envelope = try decoder.decode(TypedBridgeEventEnvelope<BridgePageReadyPayload>.self, from: data)
                return BridgeEvent(
                    schemaVersion: envelope.schemaVersion,
                    eventType: eventType,
                    requestId: envelope.requestId,
                    pageId: envelope.pageId,
                    payload: .pageReady(envelope.payload)
                )
            }
        } catch {
            throw BridgeEventDecodingError.malformedPayload(String(describing: error))
        }
    }
}

private struct BridgeEventHead: Decodable {
    let schemaVersion: Int
    let eventType: String
}

private struct TypedBridgeEventEnvelope<TPayload: Decodable>: Decodable {
    let schemaVersion: Int
    let eventType: String
    let requestId: String?
    let pageId: String?
    let payload: TPayload
}
