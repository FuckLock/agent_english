// 按 session key 的 Free 文本翻译限额与重置。
// 限额 key 取自 session token（见 session/session-key.ts），不取自请求体 tier。
// translation-proxy 不判定 entitlement 等级，只用 session key 做用量分组。

export interface SessionQuotaSnapshot {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

interface SessionUsageRecord {
  used: number;
  windowStartMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SessionQuotaTrackerOptions {
  segmentLimit: number;
  windowMs?: number;
  now?: () => number;
}

export class SessionQuotaExceededError extends Error {
  public constructor(
    public readonly snapshot: SessionQuotaSnapshot,
    message: string,
  ) {
    super(message);
    this.name = "SessionQuotaExceededError";
  }
}

// 进程内 Free 文本翻译用量计数器。轻量转发服务无状态部署时可换共享存储，
// 接口保持以 session key 为分组键、按时间窗重置。
export class SessionQuotaTracker {
  private readonly segmentLimit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly usageBySession = new Map<string, SessionUsageRecord>();

  public constructor(options: SessionQuotaTrackerOptions) {
    this.segmentLimit = options.segmentLimit;
    this.windowMs = options.windowMs ?? DAY_MS;
    this.now = options.now ?? (() => Date.now());
  }

  // 预留并计入 segmentCount 个 segment 的用量；触顶抛 SessionQuotaExceededError。
  public reserve(sessionKey: string, segmentCount: number): SessionQuotaSnapshot {
    const nowMs = this.now();
    const record = this.currentRecord(sessionKey, nowMs);
    const nextUsed = record.used + segmentCount;

    if (nextUsed > this.segmentLimit) {
      throw new SessionQuotaExceededError(
        this.toSnapshot(record.used, record.windowStartMs),
        "Free translation quota exceeded for this session.",
      );
    }

    record.used = nextUsed;
    this.usageBySession.set(sessionKey, record);
    return this.toSnapshot(record.used, record.windowStartMs);
  }

  public snapshot(sessionKey: string): SessionQuotaSnapshot {
    const record = this.currentRecord(sessionKey, this.now());
    return this.toSnapshot(record.used, record.windowStartMs);
  }

  private currentRecord(
    sessionKey: string,
    nowMs: number,
  ): SessionUsageRecord {
    const existing = this.usageBySession.get(sessionKey);
    if (!existing || nowMs - existing.windowStartMs >= this.windowMs) {
      return { used: 0, windowStartMs: nowMs };
    }
    return { used: existing.used, windowStartMs: existing.windowStartMs };
  }

  private toSnapshot(used: number, windowStartMs: number): SessionQuotaSnapshot {
    return {
      used,
      limit: this.segmentLimit,
      remaining: Math.max(0, this.segmentLimit - used),
      resetAt: new Date(windowStartMs + this.windowMs).toISOString(),
    };
  }
}
