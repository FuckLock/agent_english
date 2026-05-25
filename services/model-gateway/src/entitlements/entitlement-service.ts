import type { IncomingHttpHeaders } from "node:http";

import type {
  AccountStatus,
  EntitlementSnapshot,
  ModelServiceError,
} from "@agent-english/contracts";

import { createModelCatalog } from "../catalog/model-catalog";
import type { GatewayEnv } from "../env";
import {
  defaultSessionStore,
  type SessionStore,
} from "../sessions/session-store";

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

export function createEntitlementSnapshot(
  account: AccountStatus,
): EntitlementSnapshot {
  const catalog = createModelCatalog(account.serviceTier);
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
    return {
      statusCode: 503,
      body: {
        error: {
          code: "service-unavailable",
          message: "Model service session is unavailable right now.",
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
