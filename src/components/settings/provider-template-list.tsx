type TemplateItem = {
  id: string;
  name: string;
  providerKey: string;
  capability: string;
  defaultBaseUrl: string | null;
  defaultModel: string | null;
  configSchemaJson: string;
};

type ProviderTemplateListProps = {
  templates: TemplateItem[];
};

const capabilityLabels: Record<string, string> = {
  text: "文字",
  image: "图片",
  tts: "TTS",
  stt: "STT",
  search: "搜索",
  data: "数据"
};

export function ProviderTemplateList({ templates }: ProviderTemplateListProps) {
  const groups = Object.entries(capabilityLabels).map(([capability, label]) => ({
    capability,
    label,
    templates: templates.filter((template) => template.capability === capability)
  }));

  return (
    <section className="settings-panel" aria-labelledby="template-list-title">
      <div className="settings-panel__heading">
        <p className="section-kicker">Provider Templates</p>
        <h2 id="template-list-title">内置模板</h2>
      </div>

      <div className="template-groups">
        {groups.map((group) => (
          <div className="template-group" key={group.capability}>
            <h3>{group.label}</h3>
            <div className="template-list">
              {group.templates.map((template) => {
                const schema = parseTemplateSchema(template.configSchemaJson);

                return (
                  <article className="template-card" key={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <span>{template.providerKey}</span>
                    </div>
                    <p>{schema.description}</p>
                    <small>
                      {schema.requiresApiKey ? "Key required" : "Key optional"}
                      {template.defaultModel ? ` · ${template.defaultModel}` : ""}
                    </small>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function parseTemplateSchema(value: string) {
  try {
    const parsed = JSON.parse(value) as { description?: string; requiresApiKey?: boolean };

    return {
      description: parsed.description ?? "可配置模板",
      requiresApiKey: parsed.requiresApiKey ?? true
    };
  } catch {
    return { description: "可配置模板", requiresApiKey: true };
  }
}
