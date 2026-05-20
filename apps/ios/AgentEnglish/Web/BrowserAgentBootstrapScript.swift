import Foundation
import WebKit

enum BrowserAgentBootstrapScript {
    @MainActor
    static func makeUserScript(handlerName: String = WebBridgeController.messageHandlerName) -> WKUserScript {
        WKUserScript(
            source: makeSource(handlerName: handlerName),
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        )
    }

    private static func makeSource(handlerName: String) -> String {
        """
        (() => {
          const bridge = window.webkit?.messageHandlers?.\(handlerName);
          if (!bridge || window.__agentEnglishBridgeBootstrapped) {
            return;
          }

          window.__agentEnglishBridgeBootstrapped = true;

          const schemaVersion = 1;
          const sessionId = typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const pageId = `page-${sessionId}`;

          const postBridgeEvent = (eventType, payload, metadata = {}) => {
            bridge.postMessage({
              schemaVersion,
              eventType,
              requestId: metadata.requestId,
              pageId,
              payload,
              result: metadata.result,
              error: metadata.error
            });
          };

          postBridgeEvent("bridge.boot", {
            sessionId,
            bridgeScope: "bootstrap"
          }, {
            requestId: `boot-${sessionId}`
          });

          postBridgeEvent("bridge.ping", {
            sessionId,
            sentAt: new Date().toISOString()
          }, {
            requestId: `ping-${sessionId}`,
            result: { acknowledged: false }
          });

          const postPageReady = () => {
            postBridgeEvent("page.ready", {
              sessionId,
              url: window.location.href,
              title: document.title || "",
              loadedAt: new Date().toISOString()
            }, {
              requestId: `page-ready-${sessionId}`
            });
          };

          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", postPageReady, { once: true });
          } else {
            postPageReady();
          }
        })();
        """
    }
}
