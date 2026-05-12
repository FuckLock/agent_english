import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { exportLearningData } from "@/server/data/export-service";

type AuditFinding = {
  file?: string;
  message: string;
  rule: string;
};

type AuditSection = {
  findings: AuditFinding[];
  ok: boolean;
};

export type PrivacyAuditReport = {
  checkedAt: string;
  export: AuditSection;
  frontend: AuditSection;
  notes: string[];
  ok: boolean;
};

const secretPatterns = [
  { rule: "openai-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { rule: "google-key", pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  { rule: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { rule: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._-]{12,}\b/ }
];

const textExtensions = new Set([".css", ".js", ".jsx", ".ts", ".tsx"]);

export function runPrivacyAudit(): PrivacyAuditReport {
  const frontend = scanFrontendSources();
  const exportSection = inspectLearningExport();

  return {
    checkedAt: new Date().toISOString(),
    export: exportSection,
    frontend,
    notes: [
      "Provider API Key 只允许保存在服务端数据库字段中。",
      "学习数据导出只允许包含安全配置摘要和 Key 尾号。"
    ],
    ok: frontend.ok && exportSection.ok
  };
}

function scanFrontendSources(): AuditSection {
  const cwd = path.join(/*turbopackIgnore: true*/ process.cwd());
  const frontendRoots = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "src", "app"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "src", "components"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "src", "lib")
  ];
  const findings: AuditFinding[] = [];

  for (const rootPath of frontendRoots) {
    if (!existsSync(/*turbopackIgnore: true*/ rootPath)) continue;

    for (const file of walkFiles(rootPath)) {
      if (file.includes(`${path.sep}src${path.sep}app${path.sep}api${path.sep}`)) continue;
      if (!textExtensions.has(path.extname(file))) continue;

      const source = readFileSync(/*turbopackIgnore: true*/ file, "utf8");
      const relativePath = path.relative(cwd, file);

      for (const { pattern, rule } of secretPatterns) {
        if (pattern.test(source)) {
          findings.push({
            file: relativePath,
            message: "前端源码疑似包含完整密钥或 Bearer Token。",
            rule
          });
        }
      }

      if (/Authorization\s*:/i.test(source)) {
        findings.push({
          file: relativePath,
          message: "前端源码疑似直接拼接 Authorization Header。",
          rule: "frontend-authorization-header"
        });
      }
    }
  }

  return { findings, ok: findings.length === 0 };
}

function inspectLearningExport(): AuditSection {
  const findings: AuditFinding[] = [];
  const exported = JSON.stringify(exportLearningData());

  if (exported.includes("apiKeySecret")) {
    findings.push({
      message: "学习数据导出包含 apiKeySecret 字段。",
      rule: "export-api-key-secret"
    });
  }

  if (/Authorization\s*:|Bearer\s+[A-Za-z0-9._-]{12,}/i.test(exported)) {
    findings.push({
      message: "学习数据导出疑似包含 Authorization 信息。",
      rule: "export-authorization"
    });
  }

  for (const { pattern, rule } of secretPatterns) {
    if (pattern.test(exported)) {
      findings.push({
        message: "学习数据导出疑似包含完整密钥。",
        rule: `export-${rule}`
      });
    }
  }

  return { findings, ok: findings.length === 0 };
}

function walkFiles(root: string): string[] {
  const entry = statSync(/*turbopackIgnore: true*/ root);
  if (!entry.isDirectory()) return [root];

  return readdirSync(/*turbopackIgnore: true*/ root).flatMap((name) => {
    const nextPath = path.join(root, name);
    const stat = statSync(/*turbopackIgnore: true*/ nextPath);
    return stat.isDirectory() ? walkFiles(nextPath) : [nextPath];
  });
}
