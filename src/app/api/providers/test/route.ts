import { NextResponse } from "next/server";
import { z } from "zod";

import {
  testProviderConnection,
  type ProviderAdapterInput
} from "@/server/providers/provider-adapter";
import {
  getProviderConfigUnsafe,
  recordProviderUsage
} from "@/server/repositories/provider-repository";

const capabilitySchema = z.enum(["text", "image", "tts", "stt", "search", "data"]);

const testRequestSchema = z.object({
  providerConfigId: z.string().optional(),
  config: z
    .object({
      templateId: z.string(),
      displayName: z.string(),
      capability: capabilitySchema,
      baseUrl: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      apiKeySecret: z.string().nullable().optional(),
      mapping: z.record(z.string(), z.unknown()).optional()
    })
    .optional()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = testRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "测试参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = resolveTestInput(parsed.data);
  if (!input) {
    return NextResponse.json({ ok: false, error: "未找到 Provider 配置。" }, { status: 404 });
  }

  const result = await testProviderConnection(input);
  recordProviderUsage({
    providerConfigId: input.providerConfigId,
    eventType: "test_connection",
    status: result.status,
    latencyMs: result.latencyMs,
    errorSummary: result.ok ? null : result.message
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

function resolveTestInput(input: z.infer<typeof testRequestSchema>): ProviderAdapterInput | null {
  if (input.config) {
    return input.config;
  }

  if (!input.providerConfigId) {
    return null;
  }

  const row = getProviderConfigUnsafe(input.providerConfigId);
  if (!row) {
    return null;
  }

  const capability = capabilitySchema.safeParse(row.capability);
  if (!capability.success) {
    return null;
  }

  return {
    providerConfigId: row.id,
    templateId: row.templateId,
    displayName: row.displayName,
    capability: capability.data,
    baseUrl: row.baseUrl,
    model: row.model,
    apiKeySecret: row.apiKeySecret,
    mapping: JSON.parse(row.mappingJson) as Record<string, unknown>
  };
}
