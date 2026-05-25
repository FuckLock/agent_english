import type {
  ExplainRequest,
  TranslateRequest,
} from "@agent-english/contracts";

import type { ProviderRuntimeConfig } from "../env";

export interface ChatCompletionMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatCompletionsTransportRequest {
  provider: ProviderRuntimeConfig;
  messages: ChatCompletionMessage[];
  temperature: number;
}

export interface ChatCompletionsTransport {
  complete(
    request: ChatCompletionsTransportRequest,
  ): Promise<string>;
}

export class ChatCompletionsTransportError extends Error {
  constructor(
    public readonly kind:
      | "not-configured"
      | "network"
      | "http"
      | "invalid-response",
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class FetchChatCompletionsTransport
  implements ChatCompletionsTransport {
  async complete(
    request: ChatCompletionsTransportRequest,
  ): Promise<string> {
    const { provider, messages, temperature } = request;
    if (!provider.apiKey || !provider.baseURL || !provider.model) {
      throw new ChatCompletionsTransportError(
        "not-configured",
        "Provider config is incomplete.",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), provider.timeoutMs);

    try {
      const response = await fetch(
        chatCompletionsURL(provider.baseURL),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            temperature,
            messages,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new ChatCompletionsTransportError(
          "http",
          "Provider returned a non-2xx response.",
          response.status,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new ChatCompletionsTransportError(
          "invalid-response",
          "Provider returned an empty completion.",
        );
      }

      return content;
    } catch (error) {
      if (error instanceof ChatCompletionsTransportError) {
        throw error;
      }
      throw new ChatCompletionsTransportError(
        "network",
        error instanceof Error ? error.message : "Network error.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function buildTranslateMessages(
  request: TranslateRequest,
): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content:
        "You translate webpage text for language learners. Return strict JSON only.",
    },
    {
      role: "user",
      content: [
        `Translate the following segments from ${request.sourceLanguage} to ${request.targetLanguage}.`,
        'Return JSON exactly as {"translations":[{"segmentId":"...","translatedText":"..."}]}.',
        "Keep every segmentId unchanged. Do not add markdown.",
        JSON.stringify(request.segments),
      ].join("\n"),
    },
  ];
}

export function buildExplainMessages(
  request: ExplainRequest,
): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content:
        "You explain English selections for Chinese learners. Return strict JSON only.",
    },
    {
      role: "user",
      content: [
        `Selected text: ${request.selectedText}`,
        `Context before: ${request.contextBefore}`,
        `Context after: ${request.contextAfter}`,
        `Source text: ${request.sourceText}`,
        `Target language: ${request.targetLanguage}`,
        'Return JSON exactly as {"translation":"...","explanation":"...","examples":["..."]}.',
      ].join("\n"),
    },
  ];
}

export function parseTranslateResponse(content: string): Array<{
  segmentId: string;
  translatedText: string;
}> {
  const payload = JSON.parse(extractJSONObject(content)) as {
    translations?: Array<{ segmentId?: string; translatedText?: string }>;
  };
  if (!Array.isArray(payload.translations)) {
    throw new ChatCompletionsTransportError(
      "invalid-response",
      "Missing translations array.",
    );
  }

  return payload.translations.map((item) => {
    if (!item.segmentId || !item.translatedText) {
      throw new ChatCompletionsTransportError(
        "invalid-response",
        "Malformed translation item.",
      );
    }
    return {
      segmentId: item.segmentId,
      translatedText: item.translatedText,
    };
  });
}

export function parseExplainResponse(content: string): {
  translation: string;
  explanation: string;
  examples: string[];
} {
  const payload = JSON.parse(extractJSONObject(content)) as {
    translation?: string;
    explanation?: string;
    examples?: string[];
  };
  if (
    !payload.translation
    || !payload.explanation
    || !Array.isArray(payload.examples)
  ) {
    throw new ChatCompletionsTransportError(
      "invalid-response",
      "Malformed explanation payload.",
    );
  }

  return {
    translation: payload.translation,
    explanation: payload.explanation,
    examples: payload.examples,
  };
}

function chatCompletionsURL(baseURL: string): string {
  const normalized = baseURL.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function extractJSONObject(content: string): string {
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0 || end < start) {
    throw new ChatCompletionsTransportError(
      "invalid-response",
      "Response is not valid JSON.",
    );
  }
  return trimmed.slice(start, end + 1);
}
