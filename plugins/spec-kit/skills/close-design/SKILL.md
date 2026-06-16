---
name: close-design
description: >
  Harden a spec-driven specification until its design is closed — no missing, ambiguous, or
  unverifiable design decisions remain. Runs an autonomous loop-until-dry under the /goal command:
  each round spawns a FRESH closed-design-enforcer sub-agent that detects net-new design gaps, which
  this skill deduplicates and logs into the spec's managed Design Gaps section, until a round finds
  nothing new. Then it runs a single human arbitration gate. Use this whenever the user wants to
  "close the design", "harden the spec", "find design gaps", "make the spec ready for cold execution",
  or before implementing any spec via implement-spec. Invoke proactively once a spec draft exists and
  before implementation begins.
---

# Close Design

You orchestrate the design-closure loop over a specification. Your job is to drive a spec from "drafted" to "closed" — a state where a zero-context agent could execute it cold via `/goal` without guessing any design or integration decision.

You are the **sole writer** of the spec's `## Design Gaps` section and the **stateful memory** of the loop. The `closed-design-enforcer` sub-agent detects gaps but never writes; you hold the accumulated findings (the seen-set) across rounds and persist them.

The flow has two phases:

- **Phase 1 — Convergence loop** (autonomous, the `/goal` goal): spawn fresh enforcers until a round produces zero net-new gaps.
- **Phase 2 — Arbitration gate** (interactive, after convergence): present every logged gap to the user and resolve each.

## When invoked

You receive a spec file path (e.g. `spec/spec-architecture-foo.md`). If none is given, ask for it.

1. Read the full spec.
2. Locate its `## Design Gaps` section. Every spec created by `spec-kit:create-specification` ends with one, scaffolded empty under a managed comment. If the section is missing, append it:

   ```markdown
   ## Design Gaps
   <!-- managed by spec-kit:close-design — do not edit by hand -->
   ```

3. Enable `LSP` if available — the enforcer navigates code by symbol, and so should you when verifying its findings.

## The goal criterion (for /goal)

When run under `/goal`, the goal of Phase 1 is:

> The spec's Design Gaps section has reached a fixed point — the most recent fresh-enforcer round produced **zero net-new findings after deduplication**.

Phase 1 is what `/goal` drives autonomously. Phase 2 (arbitration) is interactive and happens once, after the goal is met.

## Phase 1 — The convergence loop (loop-until-dry)

Repeat this round until convergence. Each round is independent; the only state carried between rounds is the Design Gaps section itself (the seen-set).

### Per-round procedure

1. **Build the seen-set.** Read the current Design Gaps section. The seen-set is every logged entry — its header line (`id · status · anchor`) plus its `Gap` body. All entries count regardless of status; the enforcer must not re-report any of them.

2. **Spawn a FRESH enforcer.** Invoke `closed-design-enforcer` via the Agent tool — a NEW invocation every round, never a reused one. Freshness is the point: stateless eyes catch what a fatigued agent rationalizes away. Pass it:
   - The full spec content.
   - The seen-set, explicitly marked: *"These gaps are already logged and OUT OF SCOPE. Return only NET-NEW gaps the prior rounds missed. If you find nothing net-new, return `{ "findings": [] }`."*

3. **Receive the findings.** The enforcer returns Contract A — a JSON object `{ "findings": [...] }`. Each finding has `anchor`, `category`, `gap`, `severity`, `closes_when`. No ids (you assign them).

4. **Deduplicate semantically.** For each returned finding, judge whether it is genuinely new against the seen-set — not just a literal string match, but a *semantic* one. A reworded version of an existing gap is a duplicate; drop it. This is your judgment to make because you hold the full context; the stateless enforcer cannot.

5. **Decide convergence.**
   - If zero net-new findings remain after dedup → **converged**. Exit the loop and go to Phase 2.
   - Otherwise, assign ids and append the net-new findings (next step), then start another round.

6. **Append net-new entries.** Assign each the next `DG-NNN` id (zero-padded, monotonically increasing within the spec) and write it to the Design Gaps section in the Contract B format below. You are the only writer here — never let the enforcer write.

### Convergence depends on the seen-set, not on luck

A fresh enforcer over an unchanged spec would re-find the same gaps forever. The loop converges only because you feed each enforcer the accumulating seen-set as out-of-scope, so it can only return what prior rounds missed. When that well runs dry, you converge. If you ever observe false convergence (a later round catching gaps an earlier one missed), you may require K consecutive zero-net-new rounds before declaring closure; default K = 1.

### Guarding the closes_when contract

The enforcer's `closes_when` MUST describe the *type* of decision needed, never a concrete solution — that is what keeps the arbiter (the user) un-anchored. If a returned finding prescribes a concrete mechanism (e.g. "use idempotency keyed by invoice-id"), rewrite it to its conceptual form before logging (e.g. "a policy exists defining how duplicate invoices are handled — the decision, not the mechanism"). Never persist a concrete solution into the section.

## Contract B — Design Gaps entry format

Append-only entries. The header carries the id, status, and anchor for fast scanning and dedup; the body preserves the rest of the finding so the Phase 2 arbiter can triage by severity and category. Every Contract A field is persisted — none is computed by the enforcer and then discarded.

```markdown
### DG-003 · open · src/payments/checkout.ts:88
**Severity:** major · **Category:** integration
**Gap:** The spec does not define what happens if the webhook arrives before invoice confirmation.
**Closes when:** A policy exists defining ordering between webhook and confirmation — the decision, not the mechanism.
```

- **Header**: `### <id> · <status> · <anchor>`. `<id>` is `DG-NNN`. `<status>` is `open` throughout Phase 1. `<anchor>` mirrors the finding's `anchor`. The header stays compact so a section with many entries remains scannable.
- **Body**: a `**Severity:** <severity> · **Category:** <category>` line carrying those two Contract A fields verbatim, then `**Gap:**` and `**Closes when:**` lines mapped 1:1 from the finding's `gap` and `closes_when`.
- **Seen-set** derives from the header (id + anchor) plus the `Gap` body — severity and category are for human triage, not for dedup.
- Keep the managed comment directly under the `## Design Gaps` heading. Never reorder or hand-edit existing entries.

## Phase 2 — The arbitration gate (interactive, runs once)

After convergence, present the full set of logged gaps to the user and resolve each one. You are NOT the enforcer's peer here — you are the arbiter, with context the external detector lacked. For each gap, decide with the user:

- **ACCEPT** — the gap is real and must be closed. Ask the user how they want to address it (the enforcer deliberately did not propose a solution, so the design decision is theirs). Then fold the agreed decision into the spec body via `spec-kit:update-specification` (into §3 Requirements / Constraints / Guidelines, or the section the gap concerns), and remove the `DG-NNN` entry. The decision now lives in the body; the gap is gone.
- **DISMISS** — the gap does not apply, because you have context the enforcer lacked (e.g. it is already answered elsewhere, or out of scope). Remove the entry; persist no record. Cross-run re-litigation of dismissed gaps is accepted by design — do not keep a ledger.

Do not arbitrate during Phase 1. Batching the gate to the end keeps Phase 1 fully autonomous and lets you weigh the gaps as a set.

## End state

When Phase 2 completes, the Design Gaps section MUST be empty (heading + managed comment, no entries) and every accepted decision lives in the spec body. The spec is now **closed** — ready for `spec-kit:implement-spec`.

## Invariants (do not violate)

- **Single writer.** Only this skill appends to the Design Gaps section; only `update-specification` removes from it on resolution. The enforcer never writes.
- **Fresh enforcer per round.** Every round is a new Agent invocation. Never reuse an enforcer across rounds.
- **One shot.** No human arbitration during Phase 1. The gate runs once, after convergence.
- **You own the dedup.** Semantic deduplication is your judgment, made with full context — never delegate it to the stateless enforcer.
