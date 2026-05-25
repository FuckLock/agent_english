import type { ServiceTier } from "@agent-english/contracts";

export type ProviderID = "openai" | "deepseek" | "anthropic";

export interface ProviderRuntimeConfig {
  providerID: ProviderID;
  apiKey: string;
  model: string;
  baseURL: string;
  timeoutMs: number;
}

export interface GatewayEnv {
  port: number;
  providers: Partial<Record<ProviderID, ProviderRuntimeConfig>>;
  auth: {
    enableDevAuth: boolean;
    testProPassword?: string;
    testMaxPassword?: string;
    isProduction: boolean;
  };
}

export function loadGatewayEnv(
  env: NodeJS.ProcessEnv = process.env,
): GatewayEnv {
  return {
    port: Number(env.MODEL_GATEWAY_PORT ?? "4100"),
    providers: {
      openai: createProviderConfig(
        "openai",
        env.OPENAI_API_KEY,
        env.OPENAI_MODEL,
        env.OPENAI_BASE_URL,
        env.OPENAI_TIMEOUT_MS,
      ),
      deepseek: createProviderConfig(
        "deepseek",
        env.DEEPSEEK_API_KEY,
        env.DEEPSEEK_MODEL,
        env.DEEPSEEK_BASE_URL,
        env.DEEPSEEK_TIMEOUT_MS,
      ),
      anthropic: createProviderConfig(
        "anthropic",
        env.ANTHROPIC_SECRET_KEY,
        env.ANTHROPIC_MODEL,
        env.ANTHROPIC_BASE_URL,
        env.ANTHROPIC_TIMEOUT_MS,
      ),
    },
    auth: {
      enableDevAuth: env.ENABLE_DEV_AUTH === "true",
      testProPassword: env.DEV_AUTH_TEST_PRO_PASSWORD,
      testMaxPassword: env.DEV_AUTH_TEST_MAX_PASSWORD,
      isProduction: env.NODE_ENV === "production",
    },
  };
}

function createProviderConfig(
  providerID: ProviderID,
  apiKey: string | undefined,
  model: string | undefined,
  baseURL: string | undefined,
  timeoutValue: string | undefined,
): ProviderRuntimeConfig | undefined {
  if (!apiKey || !model || !baseURL) {
    return undefined;
  }

  return {
    providerID,
    apiKey,
    model,
    baseURL,
    timeoutMs: Number(timeoutValue ?? "15000"),
  };
}
