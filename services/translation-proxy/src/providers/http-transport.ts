// 默认第三方通用翻译网络传输（基于全局 fetch）。
// 真实出网只发生在此处；单测注入 ProviderHttpTransport stub 替换它，不真连第三方。

import type { ProviderHttpTransport } from "./types";

export class FetchProviderHttpTransport implements ProviderHttpTransport {
  public constructor(private readonly timeoutMs = 15_000) {}

  public async postJSON(
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Upstream translation provider returned ${response.status}.`);
      }

      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timer);
    }
  }
}
