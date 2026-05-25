import { randomUUID } from "node:crypto";

import type {
  AccountStatus,
  AuthSession,
  ServiceTier,
} from "@agent-english/contracts";

import { createEntitlementSnapshot } from "../entitlements/entitlement-service";

export interface SessionRecord {
  sessionToken: string;
  account: AccountStatus;
  expiresAt: string;
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  createGuestSession(): AuthSession {
    return this.createSession({
      kind: "guest",
      displayName: "游客模式",
      serviceTier: "free",
      isTestAccount: false,
    });
  }

  createSession(account: AccountStatus): AuthSession {
    const sessionToken = `session_${randomUUID()}`;
    const expiresAt = expiresAtFromNow();
    const record = {
      sessionToken,
      account,
      expiresAt,
    };
    this.sessions.set(sessionToken, record);
    return this.toAuthSession(record);
  }

  session(token: string): AuthSession | null {
    const record = this.sessions.get(token);
    if (!record || Date.parse(record.expiresAt) <= Date.now()) {
      if (record) {
        this.sessions.delete(token);
      }
      return null;
    }
    return this.toAuthSession(record);
  }

  revoke(token: string): void {
    this.sessions.delete(token);
  }

  private toAuthSession(record: SessionRecord): AuthSession {
    return {
      sessionToken: record.sessionToken,
      expiresAt: record.expiresAt,
      account: record.account,
      entitlement: createEntitlementSnapshot(record.account),
    };
  }
}

export const defaultSessionStore = new SessionStore();

export function accountStatusForTier(
  tier: ServiceTier,
  email: string,
): AccountStatus {
  if (tier === "pro") {
    return {
      kind: "dev-pro",
      displayName: "Pro 测试账号",
      serviceTier: "pro",
      email,
      isTestAccount: true,
    };
  }

  if (tier === "max") {
    return {
      kind: "dev-max",
      displayName: "Max 测试账号",
      serviceTier: "max",
      email,
      isTestAccount: true,
    };
  }

  return {
    kind: "guest",
    displayName: "游客模式",
    serviceTier: "free",
    isTestAccount: false,
  };
}

function expiresAtFromNow(): string {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  return expiresAt.toISOString();
}
