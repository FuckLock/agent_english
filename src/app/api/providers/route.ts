import { NextResponse } from "next/server";
import { z } from "zod";

import {
  testProviderConnection,
  type ProviderAdapterInput
} from "@/server/providers/provider-adapter";
import {
  deleteProviderConfig,
  getCapabilityProbeEventType,
  getProviderConfigUnsafe,
  getProviderSettingsData,
  recordProviderUsage,
  saveProviderConfig
} from "@/server/repositories/provider-repository";

const providerConfigSchema = z.object({
  id: z.string().optional(),
  templateId: z.string().min(1),
  displayName: z.string().min(1),
  capability: z.enum(["text", "image", "tts", "stt", "search", "data"]),
  baseUrl: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  apiKeySecret: z.string().nullable().optional(),
  mapping: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional()
});

export async function GET() {
  return NextResponse.json(getProviderSettingsData());
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = providerConfigSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Provider 配置参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const isClearingExistingKey = Boolean(parsed.data.id && parsed.data.apiKeySecret === null);
  const configId = parsed.data.id ?? crypto.randomUUID();
  let successfulProbe: Awaited<ReturnType<typeof testProviderConnection>> | null = null;

  if (!isClearingExistingKey) {
    const testResult = await testProviderConnection(resolveSaveTestInput(parsed.data, configId));

    if (!testResult.ok) {
      recordProviderUsage({
        providerConfigId: parsed.data.id,
        eventType: "save_validation",
        status: testResult.status,
        latencyMs: testResult.latencyMs,
        errorSummary: testResult.message
      });

      return NextResponse.json(
        { ok: false, error: `Provider 测试未通过，未保存：${testResult.message}` },
        { status: 400 }
      );
    }

    successfulProbe = testResult;
  }

  const config = saveProviderConfig({ ...parsed.data, id: configId });

  if (successfulProbe) {
    recordProviderUsage({
      providerConfigId: config.id,
      eventType: getCapabilityProbeEventType(successfulProbe.capability),
      status: successfulProbe.status,
      latencyMs: successfulProbe.latencyMs,
      errorSummary: null
    });
  }

  return NextResponse.json({ ok: true, config });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ ok: false, error: "缺少 Provider 配置 ID。" }, { status: 400 });
  }

  deleteProviderConfig(id);

  return NextResponse.json({ ok: true });
}

function resolveSaveTestInput(
  input: z.infer<typeof providerConfigSchema>,
  providerConfigId: string
): ProviderAdapterInput {
  const existing = input.id ? getProviderConfigUnsafe(input.id) : null;
  const apiKeySecret =
    input.apiKeySecret === undefined ? existing?.apiKeySecret ?? null : input.apiKeySecret;

  return {
    providerConfigId,
    templateId: input.templateId,
    displayName: input.displayName,
    capability: input.capability,
    baseUrl: input.baseUrl,
    model: input.model,
    apiKeySecret,
    mapping: input.mapping ?? {}
  };
}
