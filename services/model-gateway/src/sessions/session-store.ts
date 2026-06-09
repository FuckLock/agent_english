import { randomUUID } from "node:crypto";

import type {
  AccountStatus,
  AuthSession,
  ModelCatalog,
  ServiceTier,
} from "@agent-english/contracts";
import { createAudioQuotaState } from "@agent-english/contracts";

import { createEntitlementSnapshot } from "../entitlements/entitlement-service";
import { createQuotaState } from "../quota/service-tier";

export interface SessionRecord {
  sessionToken: string;
  account: AccountStatus;
  expiresAt: string;
}

/**
 * 档位 → 脱敏目录投影的构建器（ADR-0006 解耦边界）。
 *
 * 目录构建职责属于**组装层**（composition.ts / routes）。sessions/ 不 import 模型目录
 * 构建器，改由调用方注入此 provider——权限模块（含 sessions/）与模型目录构建器零耦合。
 */
export type CatalogProvider = (serviceTier: ServiceTier) => ModelCatalog;

export interface SessionStoreOptions {
  /**
   * 组装层注入的目录构建器。生产路径由 composition.ts 注入 registry 驱动的真实目录投影；
   * 不注入时退化为标准独立目录（仅档位 / 配额，无 registry 条目），
   * 供无组装层的独立构造（如单测 `new SessionStore()`）使用。
   */
  catalogProvider?: CatalogProvider;
}

/** 未注入 provider 时的退化目录：合法形状、按档位派生配额，不依赖模型目录构建器。 */
function standaloneCatalog(serviceTier: ServiceTier): ModelCatalog {
  const quota = createQuotaState(serviceTier, 0);
  return {
    currentTier: serviceTier,
    availableTiers: ["free", "pro", "max"],
    defaultModelId: "",
    options: [],
    quota,
    audioQuota: createAudioQuotaState(serviceTier, 0),
    lastUpdatedAt: new Date().toISOString(),
  };
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly catalogProvider: CatalogProvider;

  constructor(options: SessionStoreOptions = {}) {
    this.catalogProvider = options.catalogProvider ?? standaloneCatalog;
  }

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
    // 目录由组装层注入的 catalogProvider 构建，sessions/ 不 import 目录构建器
    // （ADR-0006 解耦边界）；再把目录交给权限模块组合进 snapshot
    // （entitlements/ 自身亦不构建目录）。
    const catalog = this.catalogProvider(record.account.serviceTier);
    return {
      sessionToken: record.sessionToken,
      expiresAt: record.expiresAt,
      account: record.account,
      entitlement: createEntitlementSnapshot(record.account, catalog),
    };
  }
}

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
