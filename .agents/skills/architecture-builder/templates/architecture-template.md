# Architecture

## Purpose

[Explain the architecture decision in one concrete paragraph.]

## Input Sources And Assumptions

| Type | Source | How It Was Used |
|---|---|---|
| Requirements | [source-or-summary] | [usage] |
| Design | [source-or-none] | [usage-or-assumption] |
| Existing code | [source-or-none] | [usage-or-assumption] |
| Constraints | [source-or-none] | [usage-or-assumption] |

## Architecture Assumptions

- [Assumption or inference made from missing / partial input.]
- [Assumption or inference made from missing / partial input.]

## Product And Scope

| Scope | Decision |
|---|---|
| Current scope | [current-scope] |
| Future scope | [future-scope] |
| Current delivery target | [current-delivery-target] |
| Explicit non-goals | [non-goals] |

## Platform And Runtime Matrix

| Target | Status | Runtime / Shell | Reuse Strategy |
|---|---|---|---|
| [target-name] | current | [runtime-or-shell] | [what-is-reused] |
| [target-name] | future | [runtime-or-shell] | [what-is-reused-or-rewritten] |
| [target-name] | non-goal | [runtime-or-shell] | [why-not-in-scope] |

## Ecosystem Convention

| Concern | Decision |
|---|---|
| Language / framework convention | [convention] |
| Package / module convention | [convention] |
| Build / run convention | [convention] |
| Documentation convention | [convention] |

## Architecture Principle

[One sentence that defines the main architecture boundary.]

## Layer Boundaries

| Layer | Owns | Does Not Own |
|---|---|---|
| Entry layer / runtime container | [entry-layer-owns] | [entry-layer-does-not-own] |
| Core modules | [core-modules-owns] | [core-modules-does-not-own] |
| Shared contracts | [shared-contracts-owns] | [shared-contracts-does-not-own] |
| Local data layer | [local-data-owns] | [local-data-does-not-own] |
| External service adapters | [external-service-adapters-owns] | [external-service-adapters-does-not-own] |

## Runtime And Integration Boundary

| Concern | Boundary |
|---|---|
| Runtime container | [runtime-container] |
| Input boundary | [input-boundary] |
| Output boundary | [output-boundary] |
| Interaction / integration bridge | [interaction-or-integration-bridge] |
| Error fallback | [error-fallback] |

## Shared Contracts

| Contract | Purpose |
|---|---|
| [ContractName] | [contract-purpose] |
| [ContractName] | [contract-purpose] |
| [ContractName] | [contract-purpose] |
| [ContractName] | [contract-purpose] |
| [ContractName] | [contract-purpose] |

## Data And Privacy

| Data | Storage | Privacy Rule |
|---|---|---|
| [DataName] | [storage] | [privacy-rule] |
| [DataName] | [storage] | [privacy-rule] |
| [DataName] | [storage] | [privacy-rule] |
| [DataName] | [storage] | [privacy-rule] |

## Risk Register

| Risk | Impact | Constraint |
|---|---|---|
| Runtime compatibility | [impact] | [constraint] |
| Third-party dependency changes | [impact] | [constraint] |
| Publish / review constraints | [impact] | [constraint] |
| Future environment differences | [impact] | [constraint] |

## Development Planning Input

- [Constraint or directory rule that development planning must respect.]
- [Constraint or directory rule that development planning must respect.]
