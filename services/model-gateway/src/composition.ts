import type { ModelCatalog, ServiceTier } from "@agent-english/contracts";

import { createModelCatalog } from "./catalog/model-catalog";
import {
  SessionStore,
  type CatalogProvider,
} from "./sessions/session-store";

/**
 * 组装层（composition root，ADR-0006 解耦边界）。
 *
 * 这里、且仅这里，把模型目录构建器（createModelCatalog）与权限模块（SessionStore）接线：
 * - sessions/ 不 import createModelCatalog；目录构建器由本模块注入。
 * - 生产路径的 defaultSessionStore 用 registry 驱动的真实目录投影。
 */
export const defaultCatalogProvider: CatalogProvider = (
  serviceTier: ServiceTier,
): ModelCatalog => createModelCatalog(serviceTier);

export const defaultSessionStore = new SessionStore({
  catalogProvider: defaultCatalogProvider,
});
