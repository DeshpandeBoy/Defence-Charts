# 60 — Commercial model: Free, Pro, Premium, and Enterprise

**Revision:** 2026-08-24
**Status:** research-backed recommendation; pricing, provider, and legal terms are not yet locked.
**Scope:** the reusable chart and resizable dashboard-grid library in this repository. This document
does not authorize a hosted analytics product, data service, telemetry system, or remote rendering
service.

## Executive decision

Build an **open-core library** with a genuinely complete Free tier, a separately distributed Pro
layer, and Premium/Enterprise value delivered primarily through organization controls, support, and
contractual assurances.

| Tier | Recommended boundary | How access is granted | What must remain true |
|---|---|---|---|
| **Free** | Core planning, standard charts, responsive ladder, SVG primitives, themes, accessibility, and the resizable grid | Public npm packages under a permissive open-source licence | No artificial chart, user, runtime, or dashboard-count limits |
| **Pro** | Specialized chart families, export, high-volume rendering, premium themes, and advanced composition helpers | Paid subscription mapped to an organization entitlement; private registry at first, with a public commercial package considered if registry friction is too high | The installed application does not call a licensing server |
| **Premium / Team** | More seats or organization-wide use, private package access, onboarding, priority support, and team controls | Subscription plus account/organization service | End users of a deployed dashboard are not charged per chart or per view |
| **Enterprise** | SSO, audit/compliance evidence, SLA, LTS, security review support, indemnity, custom design system, private/on-prem or air-gapped delivery | Negotiated contract and, where needed, private registry or signed offline licence | Entitlements and payment remain outside the renderer |

The most important product rule is simple:

> **Free must solve the ordinary embedded-dashboard problem. Paid must add breadth, export,
> rendering scale, and operational confidence—not remove the responsive ladder, accessibility, or
> the basic chart/grid foundation.**

The recommended first commercial architecture is:

```text
Hosted checkout
      |
      v
Payment provider subscription
      |
      v  signed, idempotent, retry-safe webhook
Commercial service: account + plan + entitlements + licence grants
      |                              |
      v                              v
Package registry access         Customer portal / invoices / support
      |
      v
Pro package is installed during the customer's build
      |
      v
Deployed chart application: no billing call, no telemetry, no phone-home check
```

This preserves the repository's existing decisions: presentational-only packages, pure plan data,
an RSC-safe render path, and a small client boundary.

## 1. What the repository actually has today

The previous version of this document described the project as A3 with empty React and primitives
packages. That is no longer accurate.

Current evidence:

- The roadmap records B1–B3 as closed for the current line/area planner; C1–C2 cover the dashboard
  grid, D covers chart breadth, and E covers documentation and publication. See
  [`docs/content/docs/roadmap.mdx`](../docs/content/docs/roadmap.mdx).
- `@gx/react` now exports `AutoChart` and `useElementSize`, and has the intended `'use client'`
  boundary. It does not yet expose the tooltip/crosshair/brush/legend interactions claimed by its
  package description. See [`packages/react/src/index.ts`](../packages/react/src/index.ts) and
  [`packages/react/package.json`](../packages/react/package.json).
- `@gx/grid` is still a small boundary stub exporting `GRID_COLUMNS`; the full resizable,
  compaction, containment, persistence, and widget-chrome surface remains ahead. See
  [`packages/grid/src/index.ts`](../packages/grid/src/index.ts).
- `planChart()` currently resolves only `line` and `area`; unsupported core types throw with their
  planned milestone. See [`packages/core/src/plan-chart.ts`](../packages/core/src/plan-chart.ts).
- `ChartPlan.type` is already intentionally wider than the closed `ChartType` union. It is a label
  and extension seam, not a renderer registry. See
  [`packages/core/src/plan.ts`](../packages/core/src/plan.ts#L450-L475).
- `MarkSpec` remains a closed union and the current primitive renderer throws for unsupported mark
  kinds. This means the commercial extension seam is started but not finished. See
  [`packages/core/src/plan.ts`](../packages/core/src/plan.ts#L178-L185) and
  [`packages/primitives/src/Chart.tsx`](../packages/primitives/src/Chart.tsx#L251-L262).
- All six packages are still `private: true`, version `0.0.0`, and declare MIT in their package
  metadata. Their `exports` currently point at `src`, not a publication-ready `dist` contract. No
  package has been published.
- Root decisions already commit to public scoped npm packages, presentational-only boundaries, CSS
  tokens, raw d3 SVG, a 12-column grid, an RSC-safe `<Chart>`, an adaptive `<AutoChart>`, pure
  serializable plans, and ESM output. See [`research/00-decisions.md`](00-decisions.md).

### What that means commercially

The project is early enough to make the commercial boundary cleanly, but not so early that payment
should drive core architecture. The next commercial work is not a checkout page. It is:

1. decide which code is permanently open;
2. keep billing out of the render graph;
3. finish the public package and extension contracts;
4. publish a useful Free version;
5. validate what teams will actually pay for;
6. add Pro packages only after the free contracts are stable.

## 2. Recommended package and licence topology

### Free packages

Keep these public and unlimited:

| Package | Free responsibility | Current maturity |
|---|---|---|
| `@gx/core` | Data shape, size context, pure planner, policy, overrides, scales, layout math, serializable `ChartPlan` | The strongest current foundation |
| `@gx/tokens` | CSS custom properties and typed token surface | Implemented for the current theme tree |
| `@gx/primitives` | Hook-free SVG marks, axes, legends/chrome primitives, and the static `<Chart plan={...}>` path | Line/horizon/none are implemented; broader mark coverage remains |
| `@gx/react` | `'use client'` adaptive boundary, `AutoChart`, size observation, later interaction controllers | Size boundary exists; interaction surface is not complete |
| `@gx/grid` | 12-column resizable dashboard shell, collision/compaction wrapper, widget-size reporting, containment | Boundary stub; C1–C2 remain |
| `@gx/testing` | Plan snapshots, resize drivers, accessibility matchers, deterministic test helpers | Dev-facing package; publish decision can follow the first public release |

The Free tier should include the standard catalogue once it is implemented: line, area, bar,
timebar, donut, scatter, funnel, KPI, heatmap, and progress. That is an **intended Free baseline**,
not a claim that all ten resolve today. At this revision, only line and area resolve through
`planChart()` and the current primitive renderer does not yet draw all corresponding mark kinds.

Do not artificially cap:

- number of charts in an application;
- number of dashboard end users;
- number of grid widgets;
- number of rows in the grid;
- runtime renders or browser sessions;
- data points, except where a documented renderer-performance boundary is genuinely required;
- access to the responsive ladder, basic tooltip/legend foundations, keyboard support, or basic
  light/dark theming.

### Pro packages

Keep paid implementation code additive and separately identifiable:

| Package | Candidate contents | Why it is paid |
|---|---|---|
| `@gx/pro-charts` | Sankey, map, Gantt, candlestick, box plot, advanced flow/network charts, and specialized planners | Breadth and domain-specific engineering effort beyond the standard catalogue |
| `@gx/pro-export` | PNG/PDF/print, batch export, deterministic export themes, server-side export helpers | Export has browser, font, pagination, and operational complexity that ordinary SVG rendering does not need |
| `@gx/pro-renderer` | Optional Canvas/WebGL/high-volume renderer, virtualization, large-series interaction strategies | Performance infrastructure should be paid only after benchmarks show a real need |
| `@gx/pro-themes` | Premium theme packs, dashboard templates, typography presets, and design-system adapters | Design assets and maintained presets create direct product value without weakening the base system |
| `@gx/pro-composition` | Advanced linked views, annotations, synchronized crosshairs, dashboard-level composition helpers | Cross-widget interaction is a higher-order capability and should not leak into the pure core |

Do not create a paid fork of `@gx/core`. Pro should depend on stable Free contracts. If a Pro feature
needs a new public contract, first design that contract as a general extension rather than smuggling
commercial behavior into the core package.

### Premium / Team and Enterprise

Treat these as an organization product, not a larger bundle of chart types:

- organization-wide licence or named developer seats;
- private package registry access and controlled update channels;
- SSO/SAML/OIDC, domain claims, audit history, and organization administration;
- security questionnaire support, SBOM, provenance, vulnerability response, and release notes;
- priority support, response-time commitments, LTS branch, and upgrade assistance;
- design-system onboarding, custom token mapping, white-label/theme work, and migration services;
- indemnity/warranty language and negotiated procurement terms;
- private, on-premises, or air-gapped distribution with signed offline licence files;
- optional hosted dashboard capabilities only in a separately governed cloud product.

Hosted features such as saved dashboards, sharing, collaboration, permissions, persistence, embeds,
and billing administration belong in a separate service and, if needed, a separate
`@gx/cloud-client` package. They must not become a runtime dependency of the presentational chart
renderer.

## 3. Licensing recommendation

### Recommended default: permissive open core plus a proprietary additive Pro layer

The Free packages should remain MIT **or** move to Apache-2.0 before first publication after legal
review. Pro packages should use a commercial licence. Enterprise terms should be contract-specific.

The repository currently declares MIT in the root and package metadata, but it has not published the
packages. That gives the project a decision point before the first external release. It does not
mean that MIT code can later be retroactively converted into a paywall.

The Open Source Definition requires that an open-source licence not discriminate against fields of
endeavour, including commercial use. The MIT licence explicitly permits use, modification,
distribution, sublicensing, and selling copies. Therefore:

- existing Free code should not gain a runtime “upgrade” gate;
- a company may use the Free library commercially without paying;
- payment buys separately licensed Pro code, support, updates, services, and operational guarantees;
- a legal licence, procurement audit, and package access are the enforcement layers—not a secret in
  the browser bundle.

Apache-2.0 is worth evaluating before publication because its explicit patent grant can be useful
in enterprise procurement. It is not a substitute for a product strategy, and it does not provide a
commercial-use restriction. Choose MIT versus Apache-2.0 with counsel, then record the decision in
`research/00-decisions.md` before the first public package.

### Contribution and ownership gates

Before accepting an external contribution, choose one of:

- a Developer Certificate of Origin (DCO), or
- a Contributor Licence Agreement (CLA) that is compatible with the chosen open-source and
  commercial licensing strategy.

Also resolve:

- copyright ownership for employee, contractor, and commissioned code;
- third-party source and asset notices;
- fonts, icons, map data, and any BaseDash-inspired visual references;
- trademark ownership for the final product name and npm scope;
- warranty, indemnity, refund, jurisdiction, and governing law language;
- whether a customer can continue using the last Pro version after cancellation;
- whether enterprise customers receive source escrow or only private binaries/packages.

These are legal/product decisions, not things to hide inside TypeScript.

## 4. How Free, Pro, and Enterprise access should be enforced

### Rule 1: do not put a billing check in the renderer

The browser bundle is inspectable. A client-side API key, licence token, or boolean feature flag is
not a secret and is not a durable enforcement mechanism. A runtime check also conflicts with the
repository's strongest commercial promise: pure, deterministic, server-renderable charting with no
network dependency.

Do not add `fetch`, WebSocket, telemetry, remote licence validation, update checks, or billing calls
to `@gx/core`, `@gx/primitives`, `@gx/react`, or `@gx/grid`. Preserve this with a publication gate
that scans published packages and source dependencies.

### Rule 2: separate four concerns

1. **Payment** — a provider collects money and manages invoices/subscriptions.
2. **Entitlement** — the product backend determines which stable feature keys an organization owns.
3. **Distribution** — a registry or download service decides which package version can be installed.
4. **Runtime** — the installed package renders locally and does not contact the commercial service.

Payment-provider product names must not be used directly in application code. Map them to stable
internal identifiers such as `pro.export`, `pro.sankey`, and `enterprise.sso`.

### Rule 3: package access is not the same thing as entitlement

A private npm token controls registry access. It does not prove that the payer currently has the
right plan unless the commercial service provisions and revokes that token or organization access.
Conversely, a Stripe/Paddle/Lemon Squeezy entitlement does not automatically grant access to an npm
organization.

The commercial service must own the mapping:

```text
provider customer/subscription
        -> account / organization
        -> plan
        -> feature keys + limits
        -> licence grant
        -> registry team/token or signed offline file
```

## 5. Payment-provider evaluation

The research used official documentation only for the provider behavior summarized here. Fees,
eligibility, country availability, tax treatment, and contractual terms must be checked again before
implementation.

| Provider | Best fit | Strengths relevant here | Tradeoffs / open questions |
|---|---|---|---|
| **Stripe** | A product that expects custom B2B billing, organizations, seats, usage, and an internal entitlement service | Hosted Checkout, recurring subscriptions, signed webhooks, Customer Portal, Product/Price modelling, and Entitlements | Stripe Tax does not remove the business's registration/accounting obligations; the team owns more of tax and merchant operations |
| **Paddle** | A global digital-software business that wants a merchant-of-record path | Merchant-of-record model, hosted billing, subscription lifecycle webhooks, portal, and support for good/better/best, per-seat, and usage-based plans | Confirm India/global onboarding, contract terms, payout/tax implications, package-access automation, and whether its entitlement model is sufficient for enterprise controls |
| **Lemon Squeezy** | A lean self-serve software launch that wants hosted checkout, merchant-of-record support, and license-key primitives | Merchant-of-record documentation, hosted customer portal, subscription-linked licence keys, activation/validation/deactivation APIs, and webhooks | Confirm current availability, product fit, API limits, global tax/payout treatment, and how license keys would be issued for package installation rather than browser runtime |

### Recommendation

Use this decision rule rather than hard-coding a provider now:

- Choose **Stripe** if custom organization entitlements, B2B invoicing, seats, and future enterprise
  billing are the primary requirements.
- Choose **Paddle or Lemon Squeezy** if reducing merchant-of-record and indirect-tax operations is
  the primary requirement for the first self-serve launch.
- In either case, keep an internal entitlement model so changing providers does not change package
  code, licence keys, plan names, or customer application behavior.

The current recommendation for an engineering-first pilot is **Stripe plus a small entitlement
service**, provided legal/accounting review confirms the tax and merchant obligations. If the team
does not want to operate those obligations, use a merchant-of-record provider and retain the same
internal model behind it.

## 6. Entitlement service design

The first version can be small, but it must be explicit and auditable.

### Minimum entities

```text
Account
  id, billingEmail, providerCustomerId, createdAt

Organization
  id, name, billingAccountId, slug, status

Membership
  organizationId, userId, role, seatStatus, createdAt, revokedAt

Plan
  id, displayName, edition, billingInterval, version, active

Feature
  key, description, kind, version

Subscription
  organizationId, provider, providerSubscriptionId, planId,
  status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd

Entitlement
  organizationId, featureKey, value, sourceSubscriptionId,
  effectiveAt, expiresAt, updatedAt

LicenceGrant
  organizationId, grantId, packageScope, allowedVersions,
  issuedAt, expiresAt, revokedAt, deliveryMethod

ArtifactAccess
  organizationId, registry, packageScope, tokenOrTeamReference,
  issuedAt, expiresAt, revokedAt

AuditEvent
  id, organizationId, eventType, providerEventId,
  idempotencyKey, payloadHash, processedAt, actor
```

The actual database can be simpler at first. The important properties are stable internal feature
keys, provider event IDs, idempotent processing, auditability, and a distinction between current
entitlement and package-delivery access.

### Example stable feature keys

```text
core.standard-charts
core.responsive-ladder
core.grid
core.accessibility
pro.sankey
pro.map
pro.export.png
pro.export.pdf
pro.renderer.high-volume
pro.themes.premium
enterprise.sso
enterprise.audit
enterprise.airgapped
enterprise.sla
```

Never encode limits as hidden booleans inside a chart component. Store them as explicit entitlement
values when a service genuinely needs them:

```text
pro.export.monthlyJobs = 500
enterprise.namedDeveloperSeats = 25
enterprise.privateRegistry = true
```

For local chart rendering, there should normally be no quota to check. Metered limits make sense for
a hosted export service, hosted data retention, or an API—not for an already-installed SVG chart.

## 7. Checkout-to-package lifecycle

### Purchase

1. The pricing page sends an internal `planId` to a server endpoint; the browser cannot choose an
   arbitrary provider price ID.
2. The server resolves the approved provider price, organization, currency, tax behavior, and
   return URLs.
3. The provider-hosted Checkout collects payment and billing details.
4. The provider emits signed webhook events.
5. The webhook handler verifies the signature against the raw request body, stores the provider event
   ID, deduplicates it, and returns quickly.
6. A worker or transaction updates the subscription, entitlements, package access, and audit event.
7. The customer is directed to a hosted portal for invoices, payment method, upgrade, downgrade,
   cancellation, and renewal management.

### Webhook correctness requirements

Provider events may be retried, delivered more than once, or arrive out of order. The handler must:

- verify signatures;
- persist provider event IDs and idempotency keys;
- make processing safe to repeat;
- re-fetch current provider state when an event is stale or incomplete;
- handle `active`, `trialing`, `past_due`, `unpaid`, `paused`, and `canceled` states explicitly;
- separate “subscription ended” from “package access revoked” so grace and release rights are clear;
- never grant access from a client redirect alone.

### Installation

For the initial Pro distribution, provision access to a private package registry organization or
scoped package. A customer receives an install token through an authenticated account portal and
stores it in their CI secret manager. Their build installs the Pro package and their deployed app
contains only the package code.

Before first publication, fix the package publication contract:

- point `exports` at built `dist` files, not `src`;
- add package-level `LICENSE` or an explicit package licence strategy;
- include `NOTICE` and third-party attribution where required;
- choose the final npm scope and repository metadata;
- use Changesets or an equivalent versioning/release process;
- use npm trusted publishing/OIDC and provenance for public releases;
- test `npm pack --dry-run` for every public and private package;
- verify that private Pro artifacts cannot be downloaded anonymously.

Private npm access is appropriate for controlled B2B delivery, but it creates setup friction. Measure
that friction in the pilot. If self-serve customers cannot reliably configure CI credentials, consider
a public Pro package under a commercial licence with a signed build-time licence artifact. Do not
move the enforcement into the browser.

## 8. Subscription, cancellation, and failure policy

These rules should be written into customer terms and implemented in the entitlement service.

| Event | Existing deployed application | New installs and updates | Account state |
|---|---|---|---|
| Trial | Works for the trial entitlement | Allowed for the trial period | `trialing` with an explicit end date |
| Paid and current | Continues normally | Allowed | `active` |
| Payment failure | Continues normally during a documented grace period | Usually allowed during grace; then blocked | `past_due` or provider equivalent |
| Cancellation at period end | Continues normally through the paid period and, by policy, keeps the last entitled version usable | Updates stop after entitlement/grace ends | `cancel_at_period_end`, then `canceled` |
| Immediate cancellation/refund | Do not remotely blank a deployed dashboard; preserve a clear legal policy for continued version use | New access can be revoked immediately if terms require it | `canceled` or `refunded` |
| Chargeback/fraud | Do not create a production outage by default; investigate and revoke future access when confirmed | New downloads may be frozen immediately | `disputed` / `revoked` |
| Enterprise offline | Runs without network | New signed licence or update package follows contract | Contract-specific |

### Recommended commercial posture

- Free access is never revoked.
- A deployed Pro application should not phone home and should not stop rendering because a renewal
  webhook was late.
- During a short, configurable grace period, keep package updates available while the billing issue
  is resolved.
- After grace, block new downloads and updates; do not remotely break the last installed build.
- The default product term should be “updates and support while active; continued use of a released
  version after cancellation,” subject to legal review. If the business needs a different rule, it
  must be explicit before selling.
- Offline signed licences are an Enterprise option, not a requirement for Free or ordinary Pro.

If an offline licence is added later, verify a signed payload locally with a public key. Expiry should
produce a build-time warning or account-admin warning, not a blank chart, thrown render, or silent
data loss.

## 9. Seat and usage model

The library is embedded into a customer's application. Charging each dashboard end user or each chart
render would be hostile to adoption and technically incompatible with a local, offline-capable
renderer.

Recommended model:

- **Free:** unlimited developers, projects, deployed end users, and local chart renders.
- **Pro:** one organization licence, with a clear number of developer/CI seats only if private
  package access makes seat counting necessary. Deployed end users do not count.
- **Premium / Team:** organization-wide or named-seat licence, private package access, priority
  support, and advanced features.
- **Enterprise:** negotiated organization/site licence, SSO, audit, SLA, LTS, custom terms, and
  offline/private deployment.

If seat enforcement is introduced, count package-install or account-admin seats—not people viewing a
dashboard. Define CI service accounts, contractors, subsidiaries, and production deployment targets
in the terms.

## 10. Pricing hypothesis and validation plan

No exact price should be treated as research data yet. There are no public customers in this
repository, and competitor pricing is not a reliable proxy for the value of this specific responsive
ladder and grid architecture.

Use this packaging hypothesis for discovery:

| Offer | Price posture to test | Included value |
|---|---|---|
| Free | `$0` | Complete standard library and public docs/community support |
| Pro | Monthly convenience option plus discounted annual organization licence | Pro packages, export, premium themes, updates, and standard support |
| Premium / Team | Higher annual organization or named-developer tier | Private registry, team controls, priority support, onboarding, and more seats |
| Enterprise | Custom annual contract | SSO, SLA/LTS, security/procurement artefacts, indemnity, private/offline delivery, custom work |

Validate the packaging before publishing prices:

1. Interview 5–10 design partners who build embedded dashboards or internal analytics products.
2. Ask which problems are worth paying for: specialized charts, export, high-volume rendering,
   theme delivery, support, security review, or private distribution.
3. Test organization pricing versus named-developer pricing; do not assume one.
4. Test annual-first versus monthly-first purchasing and whether customers need a procurement invoice.
5. Measure private-registry setup failure, not just checkout conversion.
6. Publish only after the Free package has a stable install path and at least one real dashboard
   integration.

Pricing may change without changing package architecture. Feature keys and licence semantics should
   be versioned independently from price IDs.

## 11. The Pro extension seam in the current architecture

The code is close to the right shape but needs one explicit decision before Pro chart families land.

### What already works in our favor

- `ChartPlan` is serializable plan data and its `type` field is wider than `ChartType`.
- `planChart()` can remain a closed resolver for chart types owned by Free.
- `<Chart>` should dispatch from marks/data supplied by a plan, not from a global type registry.
- Pro planners can be pure functions with no network, browser, or payment dependency.

### What is still closed

- `MarkSpec` is a closed union.
- The current primitive renderer supports only the implemented mark kinds and throws for others.
- The current `planChart()` dispatch has only line/area rung sets.
- `@gx/grid` is not yet a complete public resizable-grid package.

### Recommendation

For the first Pro release:

1. Keep `planChart()` closed for Free-owned chart types.
2. Do not create `registerChartType()` or any mutable global registry.
3. Expose a documented public plan/data/frame contract.
4. Let `@gx/pro-charts` own specialized planners and renderers behind explicit components such as
   `SankeyChart` or `ProChart`.
5. If Pro must render through the same `<Chart>` component, design a typed, immutable mark-extension
   payload first; do not widen `MarkSpec` to `any`.
6. Keep Pro packages tree-shakeable and independently versioned.

This gives the Free package a deterministic render contract while allowing Pro to grow without
forcing every Free consumer to download specialized chart code.

## 12. What should be done now, later, and never

### Do now, before first public package

- Confirm MIT versus Apache-2.0 with legal review.
- Confirm copyright ownership and add a DCO or CLA before outside contributions.
- Choose the final product name, npm scope, and trademark strategy.
- Decide the Free catalogue and document “intended” versus “implemented” chart support.
- Finish the public package publication contract: `dist` exports, package licences, notices,
  provenance, Changesets, and `npm pack --dry-run` checks.
- Add a no-network publication gate covering source and built packages.
- Define stable internal feature keys and an entitlement schema, even before connecting a provider.
- Define cancellation, grace, refund, chargeback, and continued-use policy in writing.
- Design the Pro extension contract without adding a mutable registry.
- Keep all payment code outside `packages/` unless it is a separate commercial-service repository.

### Do after the Free library is usable

- Run design-partner interviews and test Pro feature demand.
- Implement the complete resizable grid and test widget containment/compaction/persistence.
- Finish standard chart breadth and interaction foundations.
- Choose Stripe versus a merchant-of-record provider based on actual tax/ops requirements.
- Build hosted checkout, webhook processing, entitlement storage, customer portal, and registry
  provisioning.
- Add `@gx/pro-charts`, then export and high-volume rendering only when benchmarked.
- Add Premium/Enterprise support artefacts and contract workflows.

### Do not do

- Do not add an API key to the chart bundle.
- Do not make the Free ladder, accessibility, basic grid, or core SVG renderer Pro-only.
- Do not count dashboard viewers or local renders as billable usage.
- Do not let a provider webhook directly mutate package code or client runtime behavior.
- Do not make package names, price IDs, or provider statuses the internal entitlement API.
- Do not make cancellation remotely blank an already-deployed dashboard.
- Do not sell Pro before package access, versioning, licence terms, and support expectations are
  testable end to end.

## 13. Implementation sequence and rough effort

These are planning estimates, not commitments. They assume one engineer familiar with the repository
and exclude legal review and provider account approval.

| Phase | Scope | Estimate |
|---|---|---:|
| Commercial boundary | Licence decision, contribution policy, package matrix, feature keys, lifecycle rules | 2–4 days |
| Publication hardening | `dist` exports, licences/notices, scope metadata, Changesets, trusted publishing, package smoke tests | 3–6 days |
| Free release baseline | Complete standard chart/grid contracts, docs, examples, browser and RSC verification | 2–5 weeks; depends on remaining C/D work |
| Billing foundation | Hosted checkout, customer/account model, webhook verification, idempotency, portal, tax configuration | 1–2 weeks for a narrow provider integration |
| Entitlement + registry provisioning | Internal feature mapping, private package access, CI install docs, revoke/grace tests | 1–2 weeks |
| First Pro package | One specialized chart family or export feature, commercial package, support docs, release pipeline | 2–4 weeks after the public contract is stable |
| Enterprise readiness | SSO, audit, offline licence, SBOM/security docs, SLA/LTS and procurement workflow | 4–8+ weeks, driven by buyer requirements |

The commercial service can be built in parallel with Free chart work, but it must not be imported into
the chart packages. The highest-risk dependency is not payment code; it is publishing a stable public
contract before Pro depends on it.

## 14. Risks and unresolved decisions

| Risk / question | Why it matters | Owner / next evidence |
|---|---|---|
| Final licence | MIT and Apache-2.0 support different procurement conversations; neither paywalls commercial use | Legal review before publish |
| Copyright and contributions | Commercial relicensing and proprietary Pro work need clean ownership | Confirm entity/contractor rights; add DCO/CLA |
| Provider choice | Tax, payouts, refunds, chargebacks, portal, and global availability differ | Accounting/legal review plus a provider proof of concept |
| Private registry friction | Strong access control can make CI setup difficult for self-serve users | Pilot install from a clean CI environment |
| Public commercial Pro package | Easier installation, weaker technical access control | Legal/licence and signing design if private registry fails usability test |
| Pro extension API | Current plan label is open, but marks/renderers are not | Decide `ProChart` versus immutable mark-extension contract before first Pro chart |
| Continued use after cancellation | Affects licence wording, token revocation, and support expectations | Legal/product decision before sales |
| Seats | Library buyers and dashboard viewers are different populations | Test organization licence and named-developer options |
| Export | Browser export, server export, font licensing, and PDF pagination have different costs | Benchmark and package separately |
| Maps and data | Map tiles, geodata, icons, and fonts may have third-party restrictions | Audit assets before promising map charts |
| Security claims | “No network calls” is valuable only if enforced | Add source/build publication gate and document scope |
| Premium typography | Typography is a differentiator but fonts can carry distribution restrictions | Acquire or create redistributable font strategy |

## 15. Evidence ledger

The following table keeps the commercial recommendations tied to primary documentation. The links are
intended for re-checking immediately before implementation because provider and registry behavior can
change.

| Claim used in this document | Primary source |
|---|---|
| Open-source licences cannot discriminate against commercial fields of endeavour | [Open Source Definition](https://opensource.org/osd) and [OSI FAQ](https://opensource.org/faq) |
| MIT permits commercial use, modification, distribution, sublicensing, and selling copies | [MIT License](https://opensource.org/license/mit) |
| Apache-2.0 includes a patent grant and trademark limitations | [Apache License 2.0](https://opensource.org/license/apache-2-0) |
| Checkout should be created server-side and the server should control the selected price | [Stripe Checkout overview](https://docs.stripe.com/payments/checkout/how-checkout-works) |
| Fulfilment should be driven by webhooks, with duplicate/concurrent delivery handled safely | [Stripe Checkout fulfilment](https://docs.stripe.com/checkout/fulfillment) |
| Webhooks are signed and need verification, deduplication, and retry-safe handling | [Stripe webhooks](https://docs.stripe.com/webhooks) |
| Subscription lifecycle includes states such as trialing, active, past_due, unpaid, paused, and canceled | [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/overview) |
| Stripe Entitlements maps product features to active grants and emits entitlement updates | [Stripe Entitlements](https://docs.stripe.com/billing/entitlements?dashboard-or-api=api) |
| Stripe Customer Portal handles subscription and billing-management flows | [Stripe Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal) |
| Stripe Tax requires business registration/accounting obligations to be handled by the business | [How Stripe Tax works](https://docs.stripe.com/tax/how-tax-works) |
| Paddle documents merchant-of-record software billing and subscription provisioning through webhooks | [How Paddle works](https://developer.paddle.com/get-started/how-paddle-works/) and [Provision access with webhooks](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/) |
| Paddle webhooks are signed, retried, and can arrive out of order | [Respond to Paddle webhooks](https://developer.paddle.com/webhooks/about/respond-to-webhooks/) |
| Lemon Squeezy documents merchant-of-record tax handling, hosted portal, and subscription-linked licence keys | [Sales tax and VAT](https://docs.lemonsqueezy.com/help/payments/sales-tax-vat), [Licence keys](https://docs.lemonsqueezy.com/help/licensing/generating-license-keys), and [Customer portal](https://docs.lemonsqueezy.com/help/online-store/customer-portal) |
| Public npm packages are downloadable by users; private package access is a separate organization/package permission | [npm downloading packages](https://docs.npmjs.com/downloading-and-installing-packages-locally/), [npm package visibility](https://docs.npmjs.com/package-scope-access-level-and-visibility/), and [npm private packages](https://docs.npmjs.com/about-private-packages/) |
| npm granular access tokens have scopes, expiration, read-only options, and related controls | [npm access tokens](https://docs.npmjs.com/about-access-tokens/) |
| npm trusted publishing improves release authentication/provenance; it is not customer entitlement enforcement | [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/) |
| npm package metadata controls files and exports and should be checked before publication | [npm package.json reference](https://docs.npmjs.com/cli/v11/configuring-npm/package-json) |
| Client-side code and sensitive client-side values can be inspected or modified | [OWASP Client-Side Security Risks](https://owasp.org/www-project-top-10-client-side-security-risks/) |

### Evidence gaps

This document does **not** claim:

- a final price;
- a final provider or provider fee;
- country-specific tax treatment;
- current availability or contractual eligibility of Paddle or Lemon Squeezy for this business;
- competitor-specific licensing or enforcement behavior;
- a guaranteed performance limit for a chart family that has not been benchmarked;
- that all ten standard chart types are already implemented.

Those require a legal/accounting review, provider onboarding checks, customer interviews, or code and
performance evidence respectively.

## Related repository research

- [`80-shadcn-basedash-library-strategy.md`](80-shadcn-basedash-library-strategy.md) — architecture,
  chart/grid and BaseDash/shadcn comparison.
- [`81-deep-evidence-audit.md`](81-deep-evidence-audit.md) — broader evidence audit and blind spots.
- [`82-package-ecosystem-benchmark.md`](82-package-ecosystem-benchmark.md) — primary-source comparison
  of comparable package/licensing models and the current package-by-package audit.
- [`00-decisions.md`](00-decisions.md) — locked architectural decisions.
- [`20-architecture.md`](20-architecture.md) — package graph and extension implications.
- [`30-implementation-plan.md`](30-implementation-plan.md) — milestone and verification plan.
- [`docs/content/docs/roadmap.mdx`](../docs/content/docs/roadmap.mdx) — current roadmap status.
