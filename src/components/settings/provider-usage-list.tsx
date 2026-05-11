type UsageItem = {
  id: string;
  eventType: string;
  status: string;
  latencyMs: number | null;
  errorSummary: string | null;
  createdAt: string;
};

type ProviderUsageListProps = {
  recentUsage: UsageItem[];
};

export function ProviderUsageList({ recentUsage }: ProviderUsageListProps) {
  return (
    <section className="settings-panel" aria-labelledby="provider-usage-title">
      <div className="settings-panel__heading">
        <p className="section-kicker">Connection Logs</p>
        <h2 id="provider-usage-title">最近测试</h2>
      </div>

      <div className="recent-log">
        {recentUsage.length === 0 ? (
          <p className="empty-state">还没有测试记录。</p>
        ) : (
          recentUsage.map((item) => (
            <article className="recent-log__item" key={item.id}>
              <div>
                <strong>{item.status === "success" ? "测试成功" : "测试失败"}</strong>
                <span>{item.eventType}</span>
              </div>
              <small>
                {item.latencyMs ?? 0}ms · {new Date(item.createdAt).toLocaleString("zh-CN")}
              </small>
              {item.errorSummary ? <p>{item.errorSummary}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
