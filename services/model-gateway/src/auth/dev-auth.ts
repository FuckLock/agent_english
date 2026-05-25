import type {
  AuthError,
  AuthSession,
  DevLoginRequest,
  ServiceTier,
} from "@agent-english/contracts";

import type { GatewayEnv } from "../env";
import {
  accountStatusForTier,
  defaultSessionStore,
  type SessionStore,
} from "../sessions/session-store";

const TEST_PRO_EMAIL = "test-pro@agentenglish.local";
const TEST_MAX_EMAIL = "test-max@agentenglish.local";

export const DEV_AUTH_ENV_KEYS = {
  enableDevAuth: "ENABLE_DEV_AUTH",
  testProPassword: "DEV_AUTH_TEST_PRO_PASSWORD",
  testMaxPassword: "DEV_AUTH_TEST_MAX_PASSWORD",
} as const;

export interface DevLoginResult {
  statusCode: number;
  body: { session: AuthSession } | { error: AuthError };
}

export function handleDevLogin(
  request: DevLoginRequest,
  env: GatewayEnv,
  sessionStore: SessionStore = defaultSessionStore,
): DevLoginResult {
  if (env.auth.isProduction || !env.auth.enableDevAuth) {
    return authFailure(
      "auth-disabled",
      "Dev authentication is disabled in production.",
      403,
    );
  }

  const tier = devTierForEmail(request.email);
  const expectedPassword =
    tier === "pro"
      ? env.auth.testProPassword
      : tier === "max"
        ? env.auth.testMaxPassword
        : undefined;

  if (!tier || !expectedPassword || request.password !== expectedPassword) {
    return authFailure("invalid-credentials", "Invalid test account.", 401);
  }

  return {
    statusCode: 200,
    body: {
      session: sessionStore.createSession(
        accountStatusForTier(tier, request.email),
      ),
    },
  };
}

export function verifyAppleIdentityToken(identityToken: string): never {
  throw identityFailure(identityToken, "Apple");
}

export function verifyGoogleIdentityToken(identityToken: string): never {
  throw identityFailure(identityToken, "Google");
}

function identityFailure(identityToken: string, provider: "Apple" | "Google"): Error {
  void identityToken;
  return new Error(
    `${provider} identityToken must be verified by the backend before creating a session.`,
  );
}

function devTierForEmail(email: string): ServiceTier | null {
  const normalized = email.trim().toLowerCase();
  if (normalized === TEST_PRO_EMAIL) {
    return "pro";
  }
  if (normalized === TEST_MAX_EMAIL) {
    return "max";
  }
  return null;
}

function authFailure(
  code: AuthError["code"],
  message: string,
  statusCode: number,
): DevLoginResult {
  return {
    statusCode,
    body: {
      error: {
        code,
        message,
        retryable: false,
      },
    },
  };
}
