# 60 — Commercial model: Pro, Enterprise, and how they would be enforced

**Status: analysis, not a decision.** Nothing here is locked. It exists because one architectural
choice has a deadline at **A4** and would be expensive to reverse afterwards, and because two others
expire on events (first publish, first external contribution) rather than on dates.

Repo state as read on 2026-08-23: milestone **A3**. Six packages, all `private: true`, all version
`0.0.0`, all **MIT**, copyright *Dhanya Rao 2026*. `@gx/primitives` and `@gx/react` are still empty.
**Nothing has been published.** Every decision below is currently free and most stop being free soon.

---

## 1. The direct answer: do not build API-key insertion

The question was whether to prepare for an inserted API key. **No** — and the reasons are specific to
this architecture, not general licensing philosophy.

A runtime key check is one of two things, and both fail here:

**A local string comparison.** Readable in devtools, deletable in one line, `patch-package` away. It
deters nobody who was going to bypass it and annoys everybody who wasn't.

**A network-validated key.** This one is worse, because it collides with nearly every decision the
project has already made:

| It breaks | How |
|---|---|
| Decision 2 — presentational only | *"No fetching, no SQL, no AI, no persistence."* A licence callback is fetching. |
| Decision 7 + 013 — zero-JS RSC render | A validation call needs either a client component or a server round-trip. The 124 B page-JS story dies. |
| Decision 8 — `planChart()` is pure | A plan would depend on network state, import order, and time. |
| Gate G2 | `@gx/core` has `"types": []` and cannot see the DOM at all. The check could not live where the decisions are made. |
| The bare-Node test tier | The most valuable tier is the one with no browser in it. A network dependency puts a mock in front of every ladder test. |
| Determinism preconditions | `TZ=UTC`, faked rAF only, `restoreMocks`. None of it survives an async licence gate. |

**And the key is not a secret.** It ships in the client bundle and is visible to anyone who opens
devtools. It is a marker, never authentication, and must never be reusable as a credential for
anything else.

**The commercial argument is stronger than the technical one.** What gets a library through
enterprise security review in a week rather than a quarter is the sentence *"it makes no network
calls, ever."* Right now that is true of every package here, for reasons that had nothing to do with
sales. Adding a licence callback would trade the single best enterprise-procurement asset the project
has for an enforcement mechanism that a determined user removes in one line.

---

## 2. Where enforcement actually works

Three layers. The pattern is well established in this exact category — component and chart libraries
that monetise.

### Layer 1 — install time, via a private registry (recommended primary)

Paid packages live in a private npm registry. Consuming them requires a token in `.npmrc`.
Enforcement happens in the customer's build pipeline, **not in the shipped artefact**.

- Zero runtime cost, zero bytes, zero network calls in production.
- Nothing to strip, because there is no check to strip — there is simply no package.
- Revocable: a lapsed subscription stops future installs without breaking anything already deployed.
- Composes with everything: purity, RSC, tree-shaking, the test tiers, all untouched.

This is how Tiptap Pro and TanStack Pro distribute paid code.

### Layer 2 — legal, via the licence (the actual backstop)

Free packages stay open source. Paid packages ship under a separate commercial licence. What stops a
company stripping a check is not the check — it is procurement, audit exposure, and a contract.
Highcharts built a substantial business on close to purely legal enforcement, with no runtime key at
all.

### Layer 3 — an offline-verified key, only if it is ever wanted

If a runtime signal is wanted later, the shape that does not violate anything above:

- **Ed25519 signature** over a small payload (`{scope, expiry}`), verified **locally** against a
  public key bundled in the package. **No network, ever.**
- Lives in `@gx/react` or a standalone `@gx/license`. **Never `@gx/core`** — G1, G2, and purity all
  forbid it, and core is where nothing with a side effect belongs.
- **Failure mode: a console warning plus a visible watermark. Never a throw, never a blank chart.**
  Breaking a customer's production dashboard over a licence check is how enterprise accounts are
  lost, not won.
- Server-renderable, so a watermark works in an RSC without a client boundary.

This is roughly AG Grid's model, and it is the only runtime shape compatible with this architecture.

⚠ **The competitor mechanisms in this section are stated from general knowledge and were not
re-verified on 2026-08-23.** Confirm each before relying on it commercially — the corpus already
learned this lesson twice, in decisions 013 and 014.

---

## 3. The crux: there is no extension point yet, and A4 is the deadline

This is the finding that actually matters, and it is visible in the code rather than inferred.

`packages/core/src/plan.ts:65` declares `ChartType` as a **closed union of ten string literals**.
`packages/core/src/plan-chart.ts` dispatches through a hardcoded `LINE_TYPES` set and **throws** for
everything else, naming the milestone that will add it.

That throw is *correct* and should stay — the file's own comment gets it exactly right: a silent
fallback plan would be the same failure species as happy-dom's `0`. The problem is different:

> **A paid package cannot add a chart type without editing `@gx/core`.** There is no seam. Today that
> costs a two-line change; after B2 fills in the other eight types and after first publish makes
> `ChartType` a G6-guarded public surface, it costs a breaking change.

### The obvious fix is the wrong one

A mutable registry — `registerRungSet('sankey', SANKEY_RUNGS)` — is what most codebases would reach
for, and it is disqualified here on four counts: it is a side effect (decision 8), it makes plans
depend on import order (determinism), it defeats tree-shaking (G5), and it lets server and client
disagree about what is registered (decision 7). Do not build it.

### The right fix already exists — it is `ChartPlan` itself

Plan-as-data **already is** the plugin architecture. A paid chart type does not need to enter
`planChart()`; it needs to produce a `ChartPlan`:

```ts
// @gx-pro/sankey — no core change, no registration, no mutation
export const planSankey = (ctx, shape, policy?, overrides?): ChartPlan => { … }
```

```tsx
<Chart plan={planSankey(ctx, shape)} />   // works, because <Chart> consumes a plan, not a type
```

Three things must be true for that to hold, and **all three are free right now**:

1. **`ChartPlan['type']` must admit a type outside the union.** Today `plan.ts:436` types it as
   `ChartType`, so a third-party plan cannot say `type: 'sankey'`. Widen **this field only**.
   `planChart()`'s own `type` parameter stays the closed `ChartType` — the free library's exhaustive,
   honest list, still throwing for what it has not built. *Two types, two jobs:* `planChart` accepts
   what it can resolve; `ChartPlan` carries what anyone can produce.
2. **`<Chart>` must dispatch on `plan.marks`, never on `plan.type`.** `@gx/primitives` is empty. This
   is decidable at A4 for zero cost and is a retrofit afterwards.
3. **The planner toolkit must be exported** — `resolvePolicy`, `applyOverrides`, `measureText`, the
   size classifier, `CHROME_METRICS`. Core already exports most of it; the rest is a barrel edit.

**Cost today: roughly two lines and one A4 decision. Cost after B2 and first publish: a major
version.** This is worth doing even if no paid tier is ever built — it is also what lets a *consumer*
write a bespoke chart type without forking, which is a strictly better library either way.

---

## 4. Enterprise is a contract, not a code path

The most common mistake in this category is building "enterprise features." What enterprise buyers
actually purchase is mostly not code:

support SLA · indemnification · LTS branch · security-review artefacts (SBOM, provenance) ·
licence clarity for legal · priority triage · a named contact

**Three of those are already satisfied by decisions made for other reasons:**

- **npm OIDC provenance** is already in the build plan — a real supply-chain attestation, free.
- **MIT** is about as procurement-friendly as a licence gets; it clears legal review without
  discussion.
- **Zero network calls and no DOM dependency in `@gx/core`** is the strongest security-review posture
  a chart library can have. It exists because of jsdom and purity, not sales, and it is worth more
  commercially than any feature on a pricing page.

The remaining gaps are process, not engineering: an LTS policy, a `SECURITY.md`, an SBOM in CI, and
someone to answer the phone.

---

## 5. What could be tiered — provisional, and not the point

**The ladder stays free. This is not negotiable and it is not generosity.** It is the differentiator
(`UX.md`: *the ladder is the headline*), the only claim with no credible prior art, and the entire
adoption engine. Open core works when the free tier is genuinely complete for its audience and paid
adds **breadth or operational scale**, never the core idea. Gating the ladder would kill the project
and leave nothing worth paying for.

| Tier | Contents |
|---|---|
| **Free (MIT)** | The ladder. All ten `ChartType`s. Both themes. The grid. The plan inspector. Accessibility. Everything currently planned through milestone D. |
| **Pro** | Chart types *beyond* the ten — sankey, map, box plot, candlestick, gantt. Export (PNG / PDF / CSV). A theme builder. Premium theme packs. |
| **Enterprise** | Support SLA, LTS branch, indemnification, SBOM + attestation, private registry access, priority triage, design-system onboarding. |

Note the coherence: **Pro is exactly "additive planners,"** which is precisely what §3's extension
point enables. The commercial model and the architecture want the same thing.

---

## 6. Decide now, or defer

### Now — these stop being free on an event, not a date

| # | Decision | Expires at | Cost if missed |
|---|---|---|---|
| 1 | **Widen `ChartPlan['type']`; make `<Chart>` dispatch on marks.** | **A4** — primitives are empty today | A major version, after B2 and publish |
| 2 | **Adopt a DCO or CLA before the first external contribution.** | First outside PR | Sole copyright is what preserves the right to license future code commercially. One merged external PR under MIT with no CLA ends that permanently, and it cannot be undone without tracking down every contributor. **Nothing currently flags this.** |
| 3 | **Choose the name and scope with trademark in mind.** | First publish | `PRODUCT.md` lists the name as a publishing blocker. If a commercial tier is possible, the name is also the enforceable asset — MIT reserves no trademark, and a hostile fork's only real barrier is the mark. |
| 4 | **Promote "no network calls" from convention to a gate** (§7). | Before publish | It is now a commercial asset; unguarded, a well-meaning PR can end it |

⚠ **On the licence itself.** MIT is already committed and is a defensible choice. **Apache-2.0** would
add an explicit patent grant (which enterprise procurement notices) and §6 trademark reservation, and
it is still reversible — sole copyright holder, nothing published. This is a genuine open question and
a *lower*-stakes one than #2; MIT plus separately-licensed paid packages is a perfectly standard
open-core shape. Flagging it so it is chosen rather than inherited.

### Defer — cheap to decide later, and premature now

Pricing. Tier contents. The key format. Billing. The private registry itself. Which chart types are
Pro. **There are no users yet.** Deciding what people will pay for before anyone has used the free
thing is how open-core projects gate the wrong feature and never recover.

---

## 7. Proposed gate G18 — no network APIs in any published package

Same selection criterion as the rest of the register: a decision that would otherwise be
unfalsifiable.

| | |
|---|---|
| **Gate** | Lint ban on `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `node:http`/`node:https`, in every package under `packages/` |
| **Lands** | Before first publish |
| **Protects** | Decision 2, decision 7, the enterprise security-review posture, §1's rejection of licence callbacks |
| **Fails when** | Anyone adds telemetry, a licence callback, a font fetch, or an update check |

It is the exact analogue of G2. G2 bans DOM measurement because a fake browser returns `0` and the
bug ships silently; G18 bans network calls because *"this library never phones home"* is a claim that
degrades quietly the moment one call is added, and nobody notices until a security questionnaire.

**Explicitly including telemetry.** No usage analytics, in any tier, ever. In an open-source chart
library it is a reputational risk with a poor return, and the download counts plus the paid channel
already tell you what you need.

---

## 8. What would overturn this

- **If a paid tier is definitively ruled out**, §3's extension point is still worth building — it
  serves consumers writing bespoke chart types — but its deadline relaxes.
- **If a hosted product is ever considered** (a rendering service, an embed host), this whole analysis
  changes: server-side means real authentication, real API keys, and a different architecture.
  Decision 2 currently forbids it.
- **If the competitor mechanisms in §2 turn out to be misremembered**, the layering may shift. They
  are unverified as of 2026-08-23 and marked as such.
- **If an external contributor lands before a CLA/DCO exists**, decision #2 above is closed by
  default, and the commercial options narrow to support and services only.

---

## Related

[`../UX.md`](../UX.md) · [`00-decisions.md`](00-decisions.md) (2, 7, 8) ·
[`20-architecture.md`](20-architecture.md) §5 · [`30-implementation-plan.md`](30-implementation-plan.md) ·
[`40-chart-plan.md`](40-chart-plan.md) §3 · [`maps/04-ci-gate-map.md`](maps/04-ci-gate-map.md) ·
[`decisions/013-zero-js-claim-narrowed.md`](decisions/013-zero-js-claim-narrowed.md)
