import type { IncomingHttpHeaders } from "node:http";

import type {
  AccountStatus,
  EntitlementSnapshot,
  ModelCatalog,
  ModelServiceError,
  ServiceTier,
} from "@agent-english/contracts";

import type { GatewayEnv } from "../env";
import { defaultSessionStore } from "../composition";
import type { SessionStore } from "../sessions/session-store";

export interface ServiceEntitlement {
  account: AccountStatus;
  serviceTier: AccountStatus["serviceTier"];
  sessionToken?: string;
  tokenPresent: boolean;
}

export interface ServiceEntitlementFailure {
  statusCode: number;
  body: { error: ModelServiceError };
}

export const SUPPORTED_ENTITLEMENT_TIERS = ["free", "pro", "max"] as const;

/**
 * 档位能力集（ADR-0006 决策 1：能力门控随**档位**走，与选哪个模型无关）。
 *
 * 这是权限模块的产出——解释 / 学习卡门控来源是 serviceTier，**不是 ModelOption**。
 * 与目录投影（ModelOption.capabilities，描述性展示）彻底分离：目录由组装层构建，
 * entitlements/ 不 import 目录构建器（解耦边界，ADR-0006）。
 */
export interface TierCapabilities {
  /** 网页 / 听音翻译——全档位可用。 */
  translation: boolean;
  /** 划词 / 整段语境解释门控——Pro 起。 */
  explanation: boolean;
  /** 学习卡 / 复盘门控——Max 起。 */
  review: boolean;
}

/** 由账号档位派生能力门控集（来源是档位而非模型）。 */
export function tierCapabilities(serviceTier: ServiceTier): TierCapabilities {
  return {
    translation: true,
    explanation: serviceTier === "pro" || serviceTier === "max",
    review: serviceTier === "max",
  };
}

/**
 * 权限模块产出：账号 → 档位 + 档位能力集 + 配额输入。
 *
 * **目录在组装层组合**（catalog 参数由调用方传入；entitlements/ 不构建目录）——
 * EntitlementSnapshot.catalog 是契约必填字段，但其构建职责属于组装层（sessions / routes），
 * 本模块只负责档位语义。
 */
export function createEntitlementSnapshot(
  account: AccountStatus,
  catalog: ModelCatalog,
): EntitlementSnapshot {
  return {
    account,
    serviceTier: account.serviceTier,
    quota: catalog.quota,
    catalog,
    refreshedAt: new Date().toISOString(),
  };
}

export function resolveSessionEntitlement(
  headers: IncomingHttpHeaders,
  _env: GatewayEnv,
  sessionStore: SessionStore = defaultSessionStore,
): ServiceEntitlement | ServiceEntitlementFailure {
  const token = extractSessionToken(headers);
  if (!token) {
    return {
      statusCode: 401,
      body: {
        error: {
          code: "service-unavailable",
          message: "Model service session is required.",
          retryable: true,
        },
      },
    };
  }

  const session = sessionStore.session(token);
  if (!session) {
    // 失效 / 过期 session 必须是 401 而非 503：503 与"服务真不可用"共用一个
    // 状态码会让客户端无法区分"该换 token 重试"和"该直接报错"，
    // 客户端（iOS transport）依赖 401 触发 guest session 换发 + 单次重试。
    return {
      statusCode: 401,
      body: {
        error: {
          code: "service-unavailable",
          message: "Model service session is invalid or expired.",
          retryable: true,
        },
      },
    };
  }

  return {
    account: session.account,
    serviceTier: session.entitlement.serviceTier,
    sessionToken: session.sessionToken,
    tokenPresent: true,
  };
}

export function applySessionEntitlement<TRequest extends { serviceTier: AccountStatus["serviceTier"] }>(
  request: TRequest,
  entitlement: ServiceEntitlement,
): TRequest {
  return {
    ...request,
    serviceTier: entitlement.serviceTier,
  };
}

export function extractSessionToken(
  headers: IncomingHttpHeaders,
): string | null {
  const authorization = readHeader(headers.authorization);
  if (!authorization) {
    return null;
  }

  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() ?? null;
}

function guestAccountStatus(): AccountStatus {
  return {
    kind: "guest",
    displayName: "游客模式",
    serviceTier: "free",
    isTestAccount: false,
  };
}

function readHeader(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
