import type { ModelCatalog, ModelQuotaState, ServiceTier } from "./model-service";

export const ACCOUNT_STATUS_KINDS = [
  "guest",
  "signed-in",
  "dev-pro",
  "dev-max",
] as const;

export type AccountStatusKind = (typeof ACCOUNT_STATUS_KINDS)[number];

export const AUTH_ERROR_CODES = [
  "auth-disabled",
  "invalid-credentials",
  "identity-token-invalid",
  "session-invalid",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export interface AccountStatus {
  kind: AccountStatusKind;
  displayName: string;
  serviceTier: ServiceTier;
  email?: string;
  isTestAccount: boolean;
}

export interface EntitlementSnapshot {
  account: AccountStatus;
  serviceTier: ServiceTier;
  quota: ModelQuotaState;
  catalog: ModelCatalog;
  refreshedAt: string;
}

export interface AuthSession {
  sessionToken: string;
  expiresAt: string;
  account: AccountStatus;
  entitlement: EntitlementSnapshot;
}

export interface DevLoginRequest {
  email: string;
  password: string;
}

export interface DevLoginResponse {
  session: AuthSession;
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  retryable: boolean;
}
