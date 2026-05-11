"use client";

import { AlertTriangle, CheckCircle2, KeyRound, Save, Trash2, Zap } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TemplateItem = {
  id: string;
  name: string;
  capability: "text" | "image" | "tts" | "stt" | "search" | "data";
  defaultBaseUrl: string | null;
  defaultModel: string | null;
};

type ConfigItem = {
  id: string;
  templateId: string;
  displayName: string;
  capability: string;
  baseUrl: string | null;
  model: string | null;
  apiKeyLast4: string | null;
  mapping: Record<string, unknown>;
  enabled: boolean;
};

type ProviderConfigFormProps = {
  templates: TemplateItem[];
  configs: ConfigItem[];
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

export function ProviderConfigForm({ templates, configs }: ProviderConfigFormProps) {
  const router = useRouter();
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0],
    [selectedTemplateId, templates]
  );
  const [displayName, setDisplayName] = useState(selectedTemplate?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(selectedTemplate?.defaultBaseUrl ?? "");
  const [model, setModel] = useState(selectedTemplate?.defaultModel ?? "");
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [mappingJson, setMappingJson] = useState('{"testMode":"configuration"}');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();

  function changeTemplate(templateId: string) {
    const nextTemplate = templates.find((template) => template.id === templateId);
    setSelectedTemplateId(templateId);
    setDisplayName(nextTemplate?.name ?? "");
    setBaseUrl(nextTemplate?.defaultBaseUrl ?? "");
    setModel(nextTemplate?.defaultModel ?? "");
    setApiKeySecret("");
    setNotice(null);
  }

  function saveConfig() {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      setNotice({
        tone: response.ok ? "success" : "error",
        text: response.ok ? "Provider 已保存。" : result.error ?? "保存失败。"
      });
      router.refresh();
    });
  }

  function testDraftConfig() {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: payload })
      });
      const result = (await response.json()) as { message?: string; error?: string };

      setNotice({
        tone: response.ok ? "success" : "error",
        text: result.message ?? result.error ?? "测试完成。"
      });
      router.refresh();
    });
  }

  function testSavedConfig(configId: string) {
    startTransition(async () => {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerConfigId: configId })
      });
      const result = (await response.json()) as { message?: string; error?: string };

      setNotice({
        tone: response.ok ? "success" : "error",
        text: result.message ?? result.error ?? "测试完成。"
      });
      router.refresh();
    });
  }

  function deleteConfig(configId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/providers?id=${encodeURIComponent(configId)}`, {
        method: "DELETE"
      });
      setNotice({
        tone: response.ok ? "success" : "error",
        text: response.ok ? "Provider 已删除。" : "删除失败。"
      });
      router.refresh();
    });
  }

  function clearConfigKey(config: ConfigItem) {
    startTransition(async () => {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: config.id,
          templateId: config.templateId,
          displayName: config.displayName,
          capability: config.capability,
          baseUrl: config.baseUrl,
          model: config.model,
          apiKeySecret: null,
          mapping: config.mapping,
          enabled: config.enabled
        })
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      setNotice({
        tone: response.ok ? "success" : "error",
        text: response.ok ? "API Key 已清空。" : result.error ?? "清空失败。"
      });
      router.refresh();
    });
  }

  function buildPayload() {
    if (!selectedTemplate) {
      setNotice({ tone: "error", text: "请选择 Provider 模板。" });
      return null;
    }

    let mapping: Record<string, unknown>;
    try {
      mapping = JSON.parse(mappingJson) as Record<string, unknown>;
    } catch {
      setNotice({ tone: "error", text: "Advanced Mapping 不是合法 JSON。" });
      return null;
    }

    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      setNotice({ tone: "error", text: "Advanced Mapping 必须是 JSON 对象。" });
      return null;
    }

    return {
      templateId: selectedTemplate.id,
      displayName: displayName.trim() || selectedTemplate.name,
      capability: selectedTemplate.capability,
      baseUrl: baseUrl.trim() || null,
      model: model.trim() || null,
      apiKeySecret: apiKeySecret.trim() || undefined,
      mapping,
      enabled: true
    };
  }

  return (
    <section className="settings-panel" aria-labelledby="provider-form-title">
      <div className="settings-panel__heading">
        <p className="section-kicker">Provider Config</p>
        <h2 id="provider-form-title">能力装备</h2>
      </div>

      <div className="provider-form">
        <label>
          <span>模板</span>
          <select value={selectedTemplateId} onChange={(event) => changeTemplate(event.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {template.capability}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>显示名</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>

        <label>
          <span>Host</span>
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>

        <label>
          <span>Model</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} />
        </label>

        <label>
          <span>API Key</span>
          <input
            autoComplete="off"
            value={apiKeySecret}
            onChange={(event) => setApiKeySecret(event.target.value)}
            placeholder="保存后只显示尾号"
            type="password"
          />
        </label>

        <details className="advanced-mapping">
          <summary>Advanced Mapping</summary>
          <textarea value={mappingJson} onChange={(event) => setMappingJson(event.target.value)} />
        </details>
      </div>

      <div className="settings-actions">
        <button disabled={isPending} onClick={saveConfig} type="button">
          <Save size={16} /> 保存
        </button>
        <button disabled={isPending} onClick={testDraftConfig} type="button">
          <Zap size={16} /> 测试
        </button>
      </div>

      {notice ? <NoticeBox notice={notice} /> : null}

      <div className="saved-provider-list">
        {configs.length === 0 ? (
          <p className="empty-state">还没有保存 Provider。</p>
        ) : (
          configs.map((config) => (
            <article className="saved-provider-card" key={config.id}>
              <div>
                <strong>{config.displayName}</strong>
                <span>
                  {config.capability} · {config.apiKeyLast4 ? `****${config.apiKeyLast4}` : "no key"}
                </span>
              </div>
              <div className="saved-provider-card__actions">
                <button disabled={isPending} onClick={() => testSavedConfig(config.id)} type="button">
                  <Zap size={15} /> 测试
                </button>
                <button disabled={isPending} onClick={() => clearConfigKey(config)} type="button">
                  <KeyRound size={15} /> 清 Key
                </button>
                <button disabled={isPending} onClick={() => deleteConfig(config.id)} type="button">
                  <Trash2 size={15} /> 删除
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function NoticeBox({ notice }: { notice: Notice }) {
  const Icon = notice.tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`provider-notice provider-notice--${notice.tone}`}>
      <Icon size={17} />
      <span>{notice.text}</span>
      {notice.tone === "success" ? <KeyRound size={16} /> : null}
    </div>
  );
}
