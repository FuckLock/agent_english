import type { ModelCatalog, ServiceTier } from "@agent-english/contracts";

import { createModelCatalog } from "../catalog/model-catalog";
import type { ServiceEntitlement } from "../entitlements/entitlement-service";

export interface CatalogRouteResponse {
  statusCode: number;
  body: ModelCatalog;
}

export function handleCatalogRoute(
  entitlementOrTier: ServiceEntitlement | ServiceTier = "free",
): CatalogRouteResponse {
  const serviceTier =
    typeof entitlementOrTier === "string"
      ? entitlementOrTier
      : entitlementOrTier.serviceTier;

  return {
    statusCode: 200,
    body: createModelCatalog(serviceTier),
  };
}
