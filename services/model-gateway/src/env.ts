import type { ServiceTier } from "@agent-english/contracts";

export type ProviderID = "openai" | "deepseek" | "anthropic";

/**
 * Vendor 凭证配置（ADR-0006 决策 1）——只含凭证，**不含模型名**。
 * 真实模型名（realModelName）随 registry 条目走，由 provider-router 在请求时透传，
 * 不再由 env 的 *_MODEL 槽决定（解「一 vendor 只能填一个模型名」约束）。
 */
export interface ProviderRuntimeConfig {
  providerID: ProviderID;
  apiKey: string;
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
        env.OPENAI_BASE_URL,
        env.OPENAI_TIMEOUT_MS,
      ),
      deepseek: createProviderConfig(
        "deepseek",
        env.DEEPSEEK_API_KEY,
        env.DEEPSEEK_BASE_URL,
        env.DEEPSEEK_TIMEOUT_MS,
      ),
      anthropic: createProviderConfig(
        "anthropic",
        env.ANTHROPIC_SECRET_KEY,
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
  baseURL: string | undefined,
  timeoutValue: string | undefined,
): ProviderRuntimeConfig | undefined {
  // 只校验凭证（apiKey + baseURL）；模型名不再是 vendor 配置的一部分。
  if (!apiKey || !baseURL) {
    return undefined;
  }

  return {
    providerID,
    apiKey,
    baseURL,
    timeoutMs: Number(timeoutValue ?? "15000"),
  };
}
