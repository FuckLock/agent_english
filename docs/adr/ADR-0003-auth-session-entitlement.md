# ADR-0003: Auth Session And Entitlement Foundation

## Status

Accepted

## Context

ADR-0002 moved model Provider credentials, model routing, quota and Free / Pro / Max service levels to the backend. That makes a client-only fixed token insufficient for a real product: a public iOS app bundle can be inspected, fixed service tokens can be extracted, and Pro / Max entitlement cannot be trusted when it comes from the client.

Product-Spec v2.2 requires a practical bridge before subscription is designed: users should be able to use Free without login, while development and staging need simple Pro / Max test accounts to validate model choice, locked states, quota and backend routing.

If public iOS builds offer Google Sign-In as a primary account login, the app must also offer an equivalent privacy-focused login option under App Store login service rules. Google Sign-In for iOS backend auth also requires sending verifiable ID tokens to the backend rather than trusting plain client user IDs.

## Decision

Adopt a backend-owned session and entitlement layer:

- The first-run experience creates or restores an anonymous guest session. Guest users receive Free entitlement and can use the app without login.
- iOS stores only backend-issued session tokens in Keychain. It does not store Provider credentials or fixed production service tokens.
- Backend entitlement is the only source of truth for Free / Pro / Max. The backend ignores client-provided `serviceTier` when authorizing model catalog, translate or explain requests.
- Public account login is optional in the first app experience. When enabled on iOS, Sign in with Apple is the primary option; Google Sign-In may be offered as a parallel option, but not as the only social login.
- Dev / staging may enable password-based test accounts for Pro and Max through `ENABLE_DEV_AUTH=true`. Suggested seeded accounts are `test-pro@agentenglish.local` and `test-max@agentenglish.local`, with passwords supplied by environment variables or local seed data. Production must reject these paths.
- Subscription / recharge is not decided in this ADR. Future StoreKit / App Store Server API entitlement sync requires a separate ADR.

## Alternatives Considered

| Alternative | Reason Not Chosen |
|---|---|
| Fixed Free / Pro / Max service tokens in the iOS app | Tokens can be extracted from the app bundle and reused, making quota and paid tiers unenforceable. |
| Force login before using Free | Hurts first-run browsing flow; the product should let users try basic translation immediately. |
| Google-only login | Creates App Store review risk for iOS public builds and excludes the Apple privacy login path users expect. |
| Build subscription and payment now | Recharge / subscription policy is not decided yet; forcing it now would block model-service validation. |
| Full cloud sync of learning data | Larger privacy and data-migration scope; current account layer only needs session, entitlement and future recovery hooks. |

## Consequences

### Positive

- Free can work without login while still allowing backend quota and abuse controls.
- Pro / Max can be tested before payment is designed.
- Settings UI can truthfully show account state and current backend-confirmed service tier.
- Provider credentials and model routing stay backend-only.
- Future Apple / Google login and StoreKit entitlement can attach to the same session model.

### Negative

- The backend is no longer just a provider router; it must manage sessions, optional user identity, entitlement and token security.
- App review compliance becomes part of login design: Google login cannot be the only public iOS social login.
- Dev / staging test accounts must be environment-gated and audited so they do not become production backdoors.

## Constraints

- Production builds must not show dev / staging test login buttons or accept dev password-login endpoints.
- Backend must not trust `serviceTier` from client requests.
- Login identity tokens from Apple / Google must be verified by the backend before creating a session.
- Account deletion must be available in-app once account creation is available.
- Session tokens must be revocable and stored only in Keychain on iOS.
- Learning data remains local-first for the current product; account identity does not imply cloud sync.

## Follow-Up Rules

- `Product-Spec.md` must describe guest Free, optional login, dev/staging test accounts and the production prohibition on fixed tier tokens.
- `ARCHITECTURE.md` and `PROJECT-STRUCTURE.md` must add auth / session / entitlement responsibilities.
- `DEV-PLAN.md` must insert a Phase 6.5 before privacy/history/Phase 7 work.
- Design work must add settings account states and login sheet states before implementation.
- Future subscription / recharge must create a separate ADR before implementation.
