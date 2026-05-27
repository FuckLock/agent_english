// OpenAI 兼容大模型 Chat Completions 通用翻译 adapter（便宜大模型，如 DeepSeek V3）。
// Free 文本/字幕翻译后端：英文→中文，只输出译文。
// Base URL / API Key / 模型名由服务端 env 注入，绝不内联、绝不下发客户端。
// translation-proxy 只做 Free 文本翻译转发，不调用强模型 / ASR、不判定 entitlement。

import type { TranslationProviderRuntimeConfig } from "../env";
import { FetchProviderHttpTransport } from "./http-transport";
import {
  ProviderTransportError,
  type ProviderHttpTransport,
  type ProviderTranslateItem,
  type ProviderTranslateRequest,
  type ProviderTranslateResult,
  type TranslationProviderAdapter,
} from "./types";

// 大模型逐 segment 回填用的稳定标记：让模型在每行译文前回显 segmentId，
// 解析时按 segmentId 命中，而非依赖数组顺序裸映射。
const SEGMENT_TAG_OPEN = "[[";
const SEGMENT_TAG_CLOSE = "]]";

// 单行形如 `[[segmentId]] 译文`；segmentId 后允许 :、空白等分隔。
const SEGMENT_LINE_PATTERN = /^\s*\[\[(.+?)\]\]\s*[:：]?\s*(.*)$/;

interface ChatCompletionsResponseShape {
  choices?: Array<{
    message?: { content?: unknown };
  }>;
}

export class OpenAICompatibleTranslateAdapter
  implements TranslationProviderAdapter
{
  public readonly providerID = "openai-compatible" as const;

  public constructor(
    private readonly config: TranslationProviderRuntimeConfig,
    private readonly transport: ProviderHttpTransport =
      new FetchProviderHttpTransport(),
  ) {}

  public async translate(
    request: ProviderTranslateRequest,
  ): Promise<ProviderTranslateResult> {
    const payload = await this.transport.postJSON(
      this.config.endpoint,
      { Authorization: `Bearer ${this.config.apiKey}` },
      this.buildChatRequest(request),
    );

    const content = parseChatContent(payload);
    if (content === null) {
      throw new ProviderTransportError(
        this.providerID,
        "OpenAI-compatible response missing assistant content.",
      );
    }

    const translationsBySegmentId = parseTaggedTranslations(content);
    const segments = request.items.map((item) => {
      const raw = translationsBySegmentId.get(item.segmentId);
      if (raw === undefined) {
        throw new ProviderTransportError(
          this.providerID,
          `OpenAI-compatible output missing segment ${item.segmentId}.`,
        );
      }
      return { segmentId: item.segmentId, translatedText: normalize(raw) };
    });

    if (segments.length !== request.items.length) {
      throw new ProviderTransportError(
        this.providerID,
        "OpenAI-compatible translation count mismatch.",
      );
    }

    return { providerID: this.providerID, segments };
  }

  private buildChatRequest(request: ProviderTranslateRequest): unknown {
    return {
      model: this.config.model ?? "",
      temperature: 0,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(request.items) },
      ],
    };
  }
}

// 翻译 prompt：英文→中文，约束只输出译文、不要解释 / 标注 / 原文 / 前后缀。
function buildSystemPrompt(): string {
  return [
    "你是一个专业的字幕与文本翻译引擎，只负责把英文翻译成简体中文。",
    "规则：",
    "1. 只输出译文，不要任何解释、说明、注释、原文或前后缀。",
    "2. 不要输出代码块标记、引号或「原文:」之类的标注。",
    "3. Output only the Chinese translation, no explanation and no extra text.",
    `4. 每一条输入都以 ${SEGMENT_TAG_OPEN}id${SEGMENT_TAG_CLOSE} 开头，`,
    `   你必须在对应译文前原样回显同一个 ${SEGMENT_TAG_OPEN}id${SEGMENT_TAG_CLOSE} 标记，每条独占一行。`,
  ].join("\n");
}

function buildUserPrompt(items: ProviderTranslateItem[]): string {
  const lines = items.map(
    (item) =>
      `${SEGMENT_TAG_OPEN}${item.segmentId}${SEGMENT_TAG_CLOSE} ${item.sourceText}`,
  );
  return [
    "请逐行翻译下列英文为中文，保持每行开头的 id 标记不变：",
    ...lines,
  ].join("\n");
}

function parseChatContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const shape = payload as ChatCompletionsResponseShape;
  const content = shape.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

// 按 [[segmentId]] 标记逐行解析译文，命中即按 segmentId 回填（顺序无关）。
function parseTaggedTranslations(content: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const stripped = stripWrapping(rawLine);
    if (stripped.length === 0) {
      continue;
    }
    const match = SEGMENT_LINE_PATTERN.exec(stripped);
    if (match === null) {
      continue;
    }
    const segmentId = match[1].trim();
    const translation = match[2] ?? "";
    if (segmentId.length > 0) {
      result.set(segmentId, translation);
    }
  }
  return result;
}

// 去除整行级别的包裹噪声（代码块围栏、行首列表符号）。
function stripWrapping(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("```")) {
    return "";
  }
  return trimmed;
}

// 归一单条译文：去掉解释前缀 / 引号包裹 / 「原文:」标注 / 残留围栏等噪声。
function normalize(rawText: string): string {
  let text = rawText.trim();

  // 去掉成对包裹的引号（中英文）。
  text = stripQuotes(text);

  // 去掉「原文:」「译文:」「翻译:」「Translation:」一类前缀标注。
  text = text.replace(
    /^\s*(原文|译文|翻译|译|中文|Translation|Translated|Output)\s*[:：]\s*/i,
    "",
  );

  // 去掉残留的代码块围栏。
  text = text.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "");

  return stripQuotes(text.trim());
}

function stripQuotes(text: string): string {
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["「", "」"],
    ["『", "』"],
  ];
  for (const [open, close] of pairs) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close)) {
      return text.slice(open.length, text.length - close.length).trim();
    }
  }
  return text;
}
