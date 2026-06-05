import test from "node:test";
import assert from "node:assert/strict";

import {
  ModelRegistryValidationError,
  validateModelRegistry,
} from "../dist/catalog/model-registry.js";

// 三 vendor 全配（默认场景）；个别用例局部缩小以测「缺凭证降级」。
const allVendors = new Set(["openai", "deepseek", "anthropic"]);

/** 一份各档恰一默认、id 唯一、minTier 合法的最小合法 registry。 */
function legalRegistry() {
  return [
    { id: "free-a", vendor: "deepseek", realModelName: "rm-free", minTier: "free", isDefaultForTier: true },
    { id: "pro-a", vendor: "openai", realModelName: "rm-pro", minTier: "pro", isDefaultForTier: true },
    { id: "max-a", vendor: "anthropic", realModelName: "rm-max", minTier: "max", isDefaultForTier: true },
  ];
}

test("legal registry passes validation and returns all entries", () => {
  const result = validateModelRegistry(legalRegistry(), {
    configuredVendors: allVendors,
  });
  assert.equal(result.length, 3);
});

// 启动硬错误（throw）①：id 重复。
test("(hard error) duplicate id throws", () => {
  const registry = legalRegistry();
  registry.push({
    id: "free-a",
    vendor: "openai",
    realModelName: "rm-dup",
    minTier: "free",
    isDefaultForTier: false,
  });
  assert.throws(
    () => validateModelRegistry(registry, { configuredVendors: allVendors }),
    ModelRegistryValidationError,
  );
});

// 启动硬错误（throw）②：minTier ∉ {free,pro,max}。
test("(hard error) illegal minTier throws", () => {
  const registry = legalRegistry();
  registry.push({
    id: "weird",
    vendor: "openai",
    realModelName: "rm-weird",
    minTier: "enterprise",
    isDefaultForTier: false,
  });
  assert.throws(
    () => validateModelRegistry(registry, { configuredVendors: allVendors }),
    ModelRegistryValidationError,
  );
});

// 启动硬错误（throw）③a：某档缺 isDefaultForTier。
test("(hard error) a tier missing its default throws", () => {
  const registry = legalRegistry().map((entry) =>
    entry.minTier === "pro" ? { ...entry, isDefaultForTier: false } : entry,
  );
  assert.throws(
    () => validateModelRegistry(registry, { configuredVendors: allVendors }),
    ModelRegistryValidationError,
  );
});

// 启动硬错误（throw）③b：某档多于一个 isDefaultForTier。
test("(hard error) a tier with two defaults throws", () => {
  const registry = legalRegistry();
  registry.push({
    id: "free-b",
    vendor: "openai",
    realModelName: "rm-free-b",
    minTier: "free",
    isDefaultForTier: true,
  });
  assert.throws(
    () => validateModelRegistry(registry, { configuredVendors: allVendors }),
    ModelRegistryValidationError,
  );
});

// 启动硬错误（throw）④：fallbackVendors 引用未配置 vendor。
test("(hard error) fallbackVendors referencing an unconfigured vendor throws", () => {
  const registry = legalRegistry().map((entry) =>
    entry.id === "pro-a"
      ? { ...entry, fallbackVendors: ["anthropic"] }
      : entry,
  );
  // anthropic 未配置（仅配 deepseek + openai）。
  assert.throws(
    () =>
      validateModelRegistry(registry, {
        configuredVendors: new Set(["deepseek", "openai"]),
      }),
    ModelRegistryValidationError,
  );
});

// 缺凭证降级（**不 throw**，语义与上面四条相反）：
// 某条目主 vendor 未配凭证 → 该模型不进目录、其余正常（无孤儿、不拒启）。
test("(degrade, no throw) missing vendor credential excludes that model only", () => {
  const registry = legalRegistry();
  // 只配 deepseek + openai；anthropic（max-a 的主 vendor）缺凭证。
  const configuredVendors = new Set(["deepseek", "openai"]);

  let result;
  assert.doesNotThrow(() => {
    result = validateModelRegistry(registry, { configuredVendors });
  });

  const ids = result.map((entry) => entry.id);
  // anthropic 的 max-a 被排除……
  assert.equal(ids.includes("max-a"), false);
  // ……其余仍在目录（无孤儿、不整服务拒启）。
  assert.equal(ids.includes("free-a"), true);
  assert.equal(ids.includes("pro-a"), true);
});

// 区分语义守卫：缺凭证条目的 fallbackVendors 不再参与校验（整体不进目录）。
test("(degrade, no throw) excluded model's fallbackVendors are not validated", () => {
  const registry = legalRegistry().map((entry) =>
    entry.id === "max-a"
      ? { ...entry, fallbackVendors: ["some-unconfigured-vendor"] }
      : entry,
  );
  // anthropic（max-a 主 vendor）未配 → max-a 整体不进目录，其备用链不校验 → 不 throw。
  assert.doesNotThrow(() =>
    validateModelRegistry(registry, {
      configuredVendors: new Set(["deepseek", "openai"]),
    }),
  );
});
