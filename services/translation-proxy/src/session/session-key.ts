// 限额事实源：translation-proxy 只读 session token（Authorization）作为限额 key，
// 绝不消费请求体中客户端自报的 tier 字段（见 ADR-0005 / criteria E4 / AR2）。
// 本服务不判定 entitlement 等级，只把 session token 当作不透明的限额分组键。

import type { IncomingHttpHeaders } from "node:http";

export function extractSessionKey(
  headers: IncomingHttpHeaders,
): string | null {
  const authorization = headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const trimmed = authorization.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const bearerMatch = /^Bearer\s+(.+)$/i.exec(trimmed);
  const token = bearerMatch ? bearerMatch[1].trim() : trimmed;
  return token.length > 0 ? token : null;
}
