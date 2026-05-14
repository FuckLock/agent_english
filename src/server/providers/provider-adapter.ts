import { z } from "zod";

import { getTemplateDefinition, type ProviderCapability } from "./provider-templates";

const adapterInputSchema = z.object({
  providerConfigId: z.string().optional(),
  templateId: z.string(),
  displayName: z.string().min(1),
  capability: z.enum(["text", "image", "tts", "stt", "search", "data"]),
  baseUrl: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  apiKeySecret: z.string().nullable().optional(),
  mapping: z.record(z.string(), z.unknown()).default({})
});

export type ProviderAdapterInput = z.input<typeof adapterInputSchema>;

export type ProviderTestResult = {
  ok: boolean;
  status: "success" | "failed";
  capability: ProviderCapability;
  message: string;
  latencyMs: number;
};

export async function testProviderConnection(input: ProviderAdapterInput): Promise<ProviderTestResult> {
  const startedAt = Date.now();
  const config = adapterInputSchema.parse(input);
  const template = getTemplateDefinition(config.templateId);

  if (!template) {
    return failed(config.capability, "未知 Provider 模板。", startedAt);
  }

  if (template.capability !== config.capability) {
    return failed(config.capability, `模板能力是 ${template.capability}，不能测试为 ${config.capability}。`, startedAt);
  }

  if (template.capability === "data") {
    return success(template.capability, "手动输入和本地数据兜底可用。", startedAt);
  }

  if (template.requiresApiKey && !config.apiKeySecret) {
    return failed(template.capability, "缺少 API Key，无法测试。", startedAt);
  }

  const baseUrl = config.baseUrl ?? template.defaultBaseUrl;
  if (!baseUrl) {
    return failed(template.capability, "缺少 Host / Base URL。", startedAt);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    return failed(template.capability, "Base URL 格式不正确。", startedAt);
  }

  if (config.mapping.testMode === "network") {
    return runNetworkProbe({
      capability: template.capability,
      configId: config.providerConfigId,
      parsedUrl,
      apiKey: config.apiKeySecret ?? "",
      testPath: typeof config.mapping.testPath === "string" ? config.mapping.testPath : ""
    });
  }

  const message = config.model
    ? `能力探测通过，模型 ${config.model} 可用于 ${template.capability}。`
    : `能力探测通过，${template.name} 可用于 ${template.capability}。`;

  return success(template.capability, message, startedAt);
}

async function runNetworkProbe(input: {
  capability: ProviderCapability;
  configId?: string;
  parsedUrl: URL;
  apiKey: string;
  testPath: string;
}) {
  const startedAt = Date.now();
  const targetUrl = new URL(input.testPath || "/", input.parsedUrl).toString();

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {},
      signal: AbortSignal.timeout(6000)
    });

    const ok = response.status < 500;
    const result = ok
      ? success(input.capability, `网络测试完成，HTTP ${response.status}。`, startedAt)
      : failed(input.capability, `Provider 返回 HTTP ${response.status}。`, startedAt);

    return result;
  } catch (error) {
    return failed(input.capability, sanitizeError(error), startedAt);
  }
}

function success(capability: ProviderCapability, message: string, startedAt: number): ProviderTestResult {
  return { ok: true, status: "success", capability, message, latencyMs: Date.now() - startedAt };
}

function failed(capability: ProviderCapability, message: string, startedAt: number): ProviderTestResult {
  return { ok: false, status: "failed", capability, message, latencyMs: Date.now() - startedAt };
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer ***");
  }

  return "Provider 测试失败。";
}
