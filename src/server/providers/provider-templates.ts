import { asJson } from "@/server/db/utils";

export type ProviderCapability = "text" | "image" | "tts" | "stt" | "search" | "data";

export type ProviderTemplateDefinition = {
  id: string;
  providerKey: string;
  name: string;
  capability: ProviderCapability;
  description: string;
  defaultBaseUrl: string | null;
  defaultModel: string | null;
  requiresApiKey: boolean;
  configSchema: Record<string, unknown>;
};

const modelField = {
  fields: ["apiKey", "baseUrl", "model"],
  advancedMapping: true,
  testMode: "configuration"
};

const noModelField = {
  fields: ["apiKey", "baseUrl"],
  advancedMapping: true,
  testMode: "configuration"
};

export const builtinProviderTemplates: ProviderTemplateDefinition[] = [
  template("openai-official", "openai", "OpenAI 官方", "text", "官方文字模型入口。", "https://api.openai.com/v1", "gpt-5.2", true, modelField),
  template("google-official", "google", "Google 官方", "text", "Google Gemini 官方文字模型入口。", "https://generativelanguage.googleapis.com", "gemini-2.5-pro", true, modelField),
  template("grsai-compatible", "grsai", "grsai 可配置", "text", "Host、Path、模型名都由用户按 grsai 后台配置。", null, null, true, modelField),
  template("openai-compatible", "openai-compatible", "OpenAI-compatible", "text", "兼容 OpenAI Chat/Responses 形态的聚合接口。", null, null, true, modelField),
  template("custom-http", "custom-http", "自定义 HTTP", "text", "完全自定义请求体和响应映射。", null, null, false, modelField),
  template("openai-image", "openai-image", "OpenAI 图片", "image", "OpenAI 官方图片生成或 Responses 图片工具。", "https://api.openai.com/v1", "gpt-image-1", true, modelField),
  template("google-gemini-image", "google-gemini-image", "Google Gemini 图片", "image", "Google Gemini 图片生成入口。", "https://generativelanguage.googleapis.com", "gemini-2.5-flash-image", true, modelField),
  template("google-imagen", "google-imagen", "Google Imagen", "image", "Google 官方 Imagen 图片生成入口。", "https://generativelanguage.googleapis.com", "imagen-4.0", true, modelField),
  template("grsai-image", "grsai-image", "grsai 图片", "image", "支持 GPT Image、Imagen、Nano Banana、Flux 等可配置模型。", null, null, true, modelField),
  template("openai-compatible-image", "openai-compatible-image", "OpenAI-compatible 图片", "image", "兼容图片接口的聚合服务。", null, null, true, modelField),
  template("custom-http-image", "custom-http-image", "自定义图片 HTTP", "image", "自定义图片提交、轮询和结果解析。", null, null, false, modelField),
  template("openai-tts", "openai-tts", "OpenAI TTS", "tts", "英文朗读语音生成。", "https://api.openai.com/v1", "gpt-4o-mini-tts", true, modelField),
  template("google-tts", "google-tts", "Google TTS", "tts", "Google 语音合成入口。", "https://texttospeech.googleapis.com", null, true, noModelField),
  template("openai-stt", "openai-stt", "OpenAI STT", "stt", "预留用户跟读识别能力。", "https://api.openai.com/v1", "gpt-4o-transcribe", true, modelField),
  template("google-stt", "google-stt", "Google STT", "stt", "预留 Google 语音识别能力。", "https://speech.googleapis.com", null, true, noModelField),
  template("bing-search", "bing", "Bing Search", "search", "内容发现搜索入口。", "https://api.bing.microsoft.com", null, true, noModelField),
  template("google-cse", "google-cse", "Google CSE", "search", "Google 自定义搜索入口。", "https://www.googleapis.com", null, true, noModelField),
  template("tavily-search", "tavily", "Tavily", "search", "适合 AI 应用的搜索入口。", "https://api.tavily.com", null, true, noModelField),
  template("serpapi-search", "serpapi", "SerpAPI", "search", "搜索结果聚合入口。", "https://serpapi.com", null, true, noModelField),
  template("custom-search", "custom-search", "自定义搜索", "search", "自定义搜索 HTTP 接口。", null, null, false, noModelField),
  template("manual-input", "manual-input", "URL / 文本手动输入", "data", "搜索服务缺失时的本地兜底入口。", null, null, false, { fields: [], advancedMapping: false, testMode: "local" })
];

function template(
  id: string,
  providerKey: string,
  name: string,
  capability: ProviderCapability,
  description: string,
  defaultBaseUrl: string | null,
  defaultModel: string | null,
  requiresApiKey: boolean,
  configSchema: Record<string, unknown>
): ProviderTemplateDefinition {
  return {
    id,
    providerKey,
    name,
    capability,
    description,
    defaultBaseUrl,
    defaultModel,
    requiresApiKey,
    configSchema
  };
}

export function getTemplateDefinition(templateId: string) {
  return builtinProviderTemplates.find((templateItem) => templateItem.id === templateId) ?? null;
}

export function serializeTemplateSchema(templateItem: ProviderTemplateDefinition) {
  return asJson({
    ...templateItem.configSchema,
    description: templateItem.description,
    requiresApiKey: templateItem.requiresApiKey
  });
}
