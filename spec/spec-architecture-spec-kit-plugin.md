---
title: spec-kit Plugin — Spec-Driven Workflow Orchestration
version: 1.2
date_created: 2026-06-15
last_updated: 2026-06-15
owner: Diego (DieGopherLT)
tags: [architecture, plugin, claude-code, spec-driven, workflow]
---

# Introduction

This specification defines `spec-kit`, a Claude Code plugin that orchestrates a complete spec-driven development cycle over a single source of truth (the spec document): **create → close-design → [human gate] → implement**, with a living-document maintainer (`update-specification`) keeping the spec in sync as work evolves.

The plugin packages four skills and one read-only sub-agent. Its defining contribution over the existing standalone skills is a **design-closure loop**: a read-only auditor (`closed-design-enforcer`) repeatedly hunts for design gaps in a spec until a fresh pass finds nothing net-new, after which a human arbitrates each gap before implementation begins. This guarantees specs are *closed* (no unresolved design ambiguity) and *self-contained* (executable cold by a zero-context agent via the `/goal` command) before a single line of implementation is written.

## 1. Purpose & Scope

**Purpose.** Provide a packaged, repeatable workflow that takes a feature idea from a raw description to a closed, self-contained specification, and then to a verified implementation — all driven by one authoritative spec file.

**Scope.**

- IN SCOPE: the plugin manifest, the four skills (`create-specification`, `update-specification`, `close-design`, `implement-spec`), the `closed-design-enforcer` sub-agent, and the two data contracts that bind them (enforcer return schema; Design Gaps section format).
- OUT OF SCOPE: changes to the `/goal` command itself; the internals of the `task-planning`, `workflow-creator`, `code-review`, `security-review`, or `clean-code` skills (they are consumed, not modified); any specific project the plugin operates on.

**Intended audience.** A cold implementing agent with zero knowledge of the originating conversation, executing this spec via `/goal`.

**Assumptions.**

- The target repository is the plugins mono-repo at `/home/diego/Documents/config/claude` (see root `CLAUDE.md`).
- The `/goal` command exists as a Claude Code autonomous main-loop construct that runs the main agent non-stop until a stated goal criterion is met.
- The Workflow tool and the Agent (sub-agent) tool are available to the main agent at runtime.

## 2. Definitions

- **Spec / specification**: the authoritative Markdown document produced by `create-specification`, following the section template defined in §4.4.
- **Design gap**: a point in a spec where a design or integration decision is missing, ambiguous, or unverifiable — something a cold agent would have to guess. NOT a code bug.
- **Enforcer**: the `closed-design-enforcer` sub-agent. Read-only auditor that detects design gaps and returns them as structured output. Has no authority to close gaps and never writes to disk.
- **close-design loop**: the orchestration performed by the `close-design` skill running under `/goal`; spawns fresh enforcers until convergence.
- **Fresh enforcer**: a newly spawned enforcer sub-agent with no memory of prior rounds (a new Agent-tool invocation). Each round uses a fresh enforcer.
- **Seen-set**: the set of design gaps already logged in the Design Gaps section; passed to each fresh enforcer as "out of scope, already known."
- **Net-new finding**: a returned finding that, after semantic deduplication against the seen-set, is genuinely new.
- **Convergence / "one shot" (un tirón)**: the loop runs autonomously to a fixed point (a round producing zero net-new findings) before any human involvement. The human gate happens exactly once, at the end.
- **Human gate / arbitration**: the single point where Diego, together with the main agent, accepts or dismisses each logged gap.
- **Closes-when**: the enforcer's conceptual hint describing the *type* of decision needed to close a gap — never a concrete solution (to avoid anchoring the arbiter).
- **Design Gaps section**: the special, machine-managed section inside a spec where logged gaps live (contract B, §4.2).
- **Dispatcher**: the role of the rewritten `implement-spec` skill — it selects an execution strategy and routes to it, separating strategy *selection* from *execution*.
- **Context budget**: the token ceiling the main agent's context should stay under after finishing an implementation. Target ≤300k tokens (a prior run reaching ~450k is the pain point this constraint addresses).
- **Decision-closed orchestration**: coordination whose entire control flow can be written before executing anything, because no routing decision depends on an intermediate result. Maps to the `workflow` strategy.
- **Decision-open orchestration**: coordination where deciding the next step requires reading what the previous step produced (a finding reorients the next move, a conflict needs reconciliation). Maps to the `agent-waves` strategy.
- **Orchestration-level mechanicity**: whether the *coordination between work items* is mechanical, independent of how hard each item's work is. A `workflow` pairs intelligent per-item workers with mechanical coordination; it is not "dumb work."

## 3. Requirements, Constraints & Guidelines

### Plugin structure

- **REQ-001**: The plugin MUST live at `plugins/spec-kit/` and expose a manifest at `plugins/spec-kit/.claude-plugin/plugin.json` matching the schema used by sibling plugins (reference: `plugins/git-toolkit/.claude-plugin/plugin.json`). Required fields: `name`, `version`, `description`, `author` (`{name, url}`), `repository`, `license`, `keywords`.
- **REQ-002**: The plugin MUST contain exactly these components: `agents/closed-design-enforcer.md`, `skills/create-specification/SKILL.md`, `skills/update-specification/SKILL.md`, `skills/close-design/SKILL.md`, `skills/implement-spec/SKILL.md`.
- **REQ-003**: All agent and skill frontmatter MUST follow the repo conventions: skills carry `name` + folded `description`; agents carry `name`, folded `description`, `tools`, `model`, and optional `effort`/`color` (reference: `plugins/git-toolkit/agents/git-history-retriever.md:1`, `plugins/testing/agents/testability-auditor.md:1`).

### closed-design-enforcer agent

- **REQ-004**: The enforcer MUST be read-only. Its `tools` frontmatter MUST be `Read, Grep, Glob` (plus `LSP` if the harness exposes it). It MUST NOT include `Edit`, `Write`, or `Bash`.
- **REQ-005**: The enforcer MUST produce its findings as structured output conforming to contract A (§4.1) and return them as its final message. It MUST NOT attempt to modify the spec or any file.
- **REQ-006**: Each finding's `closes_when` field MUST describe the *type* of decision required to close the gap, never a concrete solution. The agent system prompt MUST state this constraint explicitly.
- **REQ-007**: The enforcer MUST treat any gaps provided to it as the seen-set as out of scope, and return only net-new gaps.

### close-design skill (the loop)

- **REQ-008**: `close-design` MUST be the SOLE writer of the Design Gaps section. The enforcer never writes it; `create-specification` only scaffolds it empty; `update-specification` only removes resolved entries.
- **REQ-009**: `close-design` MUST hold the seen-set across rounds (it is the stateful memory of the loop) and pass it to each fresh enforcer.
- **REQ-010**: Each round MUST spawn a FRESH enforcer (a new Agent-tool invocation), never reuse a prior one.
- **REQ-011**: `close-design` MUST semantically deduplicate each round's returned findings against the seen-set before writing, assign ids, and append only net-new entries.
- **REQ-012**: The loop MUST terminate when a round yields zero net-new findings after deduplication. This is the `/goal` goal criterion.
- **REQ-013**: `close-design` MUST run "one shot": it performs NO human arbitration during the loop. Arbitration happens once, after convergence (see REQ-014..REQ-016).

### Human gate (arbitration)

- **REQ-014**: After convergence, the main agent MUST present the logged gaps and, per gap, either ACCEPT or DISMISS it.
- **REQ-015**: ACCEPT MUST: ask Diego how to address the gap, fold the resulting decision into the spec body (§3 Requirements / Constraints / Guidelines or the relevant section) via `update-specification`, and remove the entry from the Design Gaps section.
- **REQ-016**: DISMISS MUST: record nothing permanent; the entry is removed. Dismissal is justified by context the main agent has that the enforcer lacked ("does not apply").
- **REQ-017**: At the end of arbitration the Design Gaps section MUST be empty (clean document).

### implement-spec dispatcher

- **REQ-018**: `implement-spec` MUST act as a pure dispatcher: select a strategy, then route to it. Strategy *selection* MUST be separated from *execution*.
- **REQ-019**: Three strategies MUST be supported: `write-directly`, `agent-waves`, `workflow`.
- **REQ-020**: The dispatcher MUST resolve the `/goal`-vs-Workflow tension by having the goal-driven main agent INVOKE the Workflow tool as a tool (and supervise it), never by attempting to apply `/goal` to a workflow.
- **REQ-021**: The dispatcher MUST preserve the existing quality bar from the current `implement-spec` (reference: `/home/diego/.claude/skills/implement-spec/SKILL.md:21`): run Phase 3 of `task-planning` (`/code-review xhigh --fix`, `clean-code`, `/security-review`, applicable domain auditors) and manual behavior verification before declaring done.
- **REQ-025**: `implement-spec` MUST be structured as a Template Method with a fixed skeleton and exactly one pluggable step: (1) Preconditions → (2) Select → (3) Execute → (4) Quality gate → (5) Verify → (6) Cleanup. Steps 1, 4, 5, 6 are invariant across strategies; only step 3 (Execute) varies (§4.5).
- **REQ-026**: Strategy selection MUST evaluate two orthogonal axes: Axis 1 — Scale (does the work fit the context budget per REQ-027?); Axis 2 — Orchestration closure (is the coordination decision-closed or decision-open?). Mapping: fits budget → `write-directly`; exceeds budget + decision-open → `agent-waves`; exceeds budget + decision-closed → `workflow`.
- **REQ-027**: The dispatcher MUST treat the context budget (target ≤300k tokens) as the Axis-1 scale trigger. Scale MUST be estimated from multiple signals — projected token cost, fraction of repo files touched, and number of task-planning blocks — none used as a sole criterion.
- **REQ-028**: When the selected strategy is `workflow`, the dispatcher MUST build it under the `workflow-creator` framework and MUST bake the quality gate (REQ-021) into the workflow script as terminal phases, because the workflow runs detached in the background. For `write-directly` and `agent-waves`, the quality gate runs as a post-execution step performed by the main agent. The behavior-verification step (step 5) is ALWAYS performed by the main agent upon receiving the result, regardless of strategy.
- **REQ-029**: The dispatcher MAY auto-launch the `workflow` strategy under `/goal` without a separate human authorization (expected Claude Code behavior), provided REQ-028 is satisfied.

### Augmented spec skills

- **REQ-022**: `create-specification` and `update-specification` MUST be derived from the existing skills (sources: `/home/diego/.agents/skills/create-specification/SKILL.md`, `/home/diego/.agents/skills/update-specification/SKILL.md`) and augmented with Diego's closure layer (§4.4).
- **REQ-023**: The augmented `create-specification` MUST scaffold an empty `## Design Gaps` section (contract B header comment present, no entries) in every new spec.
- **REQ-024**: The augmented skills MUST require specs to be self-contained for cold `/goal` execution: every integration *how* explicit, with concrete `file:line` anchors for integration points, non-obvious domain constraints stated, and exact wiring shape described (per the root `CLAUDE.md` "Self-contained" definition).

### Component authoring process

Each plugin component MUST be authored through the prescribed method so the build does not improvise structure:

| Component | Authoring method |
|---|---|
| `agents/closed-design-enforcer.md` | `claude-code-agent-creator` skill — applies least-privilege tools, auditor archetype, model+effort calibration, and the 0-100 confidence scoring for auditor-type agents |
| `skills/close-design/SKILL.md` | `skill-creator` skill — authored from scratch |
| `skills/implement-spec/SKILL.md` | `skill-creator` skill — authored from scratch |
| `skills/create-specification/SKILL.md` | Copy the source SKILL.md (`/home/diego/.agents/skills/create-specification/SKILL.md`) and augment by hand (derived, NOT generated via `skill-creator`) |
| `skills/update-specification/SKILL.md` | Copy the source SKILL.md (`/home/diego/.agents/skills/update-specification/SKILL.md`) and augment by hand (derived, NOT generated via `skill-creator`) |

- **REQ-030**: `closed-design-enforcer.md` MUST be authored via the `claude-code-agent-creator` skill, with the auditor archetype and least-privilege (read-only) tool selection.
- **REQ-031**: `close-design/SKILL.md` and `implement-spec/SKILL.md` MUST be authored from scratch via the `skill-creator` skill.
- **REQ-032**: `create-specification/SKILL.md` and `update-specification/SKILL.md` MUST be produced by copying their source SKILL.md and augmenting by hand — they are derived, not generated.

### Constraints

- **CON-001**: Pure additive change to the mono-repo: only files under `plugins/spec-kit/` and this spec are created/modified. No existing plugin is touched.
- **CON-002**: No emojis in any file, code, or commit message (root user preference).
- **CON-003**: All file content, code, and comments in English; conversation output in Spanish.
- **CON-004**: The Design Gaps section is machine-managed. Only `close-design` (write/append) and `update-specification` (remove on resolution) mutate it. It MUST carry an HTML comment marking it as managed.
- **CON-005**: Cross-run re-litigation of dismissed gaps is ACCEPTED by design — no dismissed-gap ledger is persisted. Accepted gaps live in the spec body and are therefore not re-raised by a fresh enforcer.
- **CON-006**: The standalone `implement-spec` at `/home/diego/.claude/skills/implement-spec/SKILL.md` carries `disable-model-invocation: true`; the plugin's `implement-spec` MUST retain that flag (explicit invocation only, typically under `/goal`).

### Guidelines & Patterns

- **GUD-001**: The operational test for Axis 2 (REQ-026) SHOULD be: *"Can I write the entire orchestration script right now, without executing anything?"* If yes → decision-closed → `workflow`. If deciding the next step would require reading a prior step's output → decision-open → `agent-waves`.
- **GUD-002**: `close-design` MAY raise the convergence criterion to K consecutive zero-net-new rounds if false convergence (a fresh enforcer missing gaps a later one catches) is observed in practice. Default K = 1.
- **GUD-003**: Orchestration-level mechanicity — not unit-level difficulty — drives the `agent-waves` vs `workflow` choice. A `workflow` may run intelligent per-item workers (e.g. typing one file is non-trivial) as long as the *coordination* between them is mechanical. The main agent's degree of control is a consequence of orchestration closure, not an independent criterion.
- **GUD-004**: The task-planning block count (former ">5 blocks") is no longer a selection criterion; it is one Axis-1 scale signal among projected token cost and repo-file fraction (reference seed: `/home/diego/.claude/skills/implement-spec/SKILL.md:17` and `:42-43`).
- **PAT-001**: **loop-until-dry** — the stateful orchestrator (`close-design`) owns the seen-set; stateless fresh workers (enforcers) run each round; terminate on zero net-new after dedup.
- **PAT-002**: **goal-uses-workflow-as-tool** — under `/goal`, the main agent invokes Workflow as a tool and supervises it; `/goal` is never applied to the flow.
- **PAT-003**: **single-writer** — exactly one component (`close-design`) appends to the managed Design Gaps section; one other (`update-specification`) removes from it; everyone else reads.
- **PAT-004**: **template-method + strategy** — `implement-spec` fixes the algorithm skeleton (Template Method) and makes only the Execute step pluggable across three interchangeable strategies (Strategy).

## 4. Interfaces & Data Contracts

### 4.1 Contract A — Enforcer return schema (enforcer → close-design)

Structured output returned by each enforcer round. No ids (the enforcer is stateless and does not know what already exists; `close-design` assigns ids).

```jsonc
{
  "findings": [
    {
      "anchor": "string",       // "file:line" pointing at the spec or code location the gap concerns; "spec" if doc-global
      "category": "string",     // one of: requirement | integration | data-contract | constraint | lifecycle | concurrency | edge-case
      "gap": "string",          // what is missing/ambiguous/unverifiable — one or two sentences, declarative
      "severity": "string",     // one of: blocker | major | minor
      "closes_when": "string"   // CONCEPTUAL: the TYPE of decision needed to close it. NEVER a concrete solution.
    }
  ]
}
```

Field rules:

- `findings` MAY be empty (`[]`) — that signals a candidate convergence round.
- `closes_when` MUST be conceptual. Example (valid): "A policy exists defining ordering between webhook and invoice confirmation — the decision, not the mechanism." Example (INVALID, anchors the arbiter): "Use idempotency keyed by invoice-id with resume."
- `anchor` SHOULD be the most specific `file:line` the gap concerns; use the literal `"spec"` when the gap is document-global.

### 4.2 Contract B — Design Gaps section format (in the spec; written by close-design)

Lives at the end of the spec body. Append-only entries; status mutated in place. Vertically scalable: the header line carries everything the dedup and the human scan need.

```markdown
## Design Gaps
<!-- managed by spec-kit:close-design — do not edit by hand -->

### DG-003 · open · src/payments/checkout.ts:88
**Severity:** major · **Category:** integration
**Gap:** The spec does not define what happens if the webhook arrives before invoice confirmation.
**Closes when:** A policy exists defining ordering between webhook and confirmation — the decision, not the mechanism.
```

Format rules:

- **Header line**: `### <id> · <status> · <anchor>`. Scannable at a glance regardless of section length.
  - `<id>`: `DG-NNN`, zero-padded to 3 digits, monotonically increasing within a spec, assigned by `close-design`.
  - `<status>`: `open` during the loop. (Arbitration transitions are terminal removals, not persisted statuses — see CON-005/REQ-017.)
  - `<anchor>`: mirrors contract A's `anchor`.
- **Body**: a `**Severity:** <severity> · **Category:** <category>` line carrying those two contract-A fields verbatim, then `**Gap:**` and `**Closes when:**` lines mapped 1:1 from contract A's `gap` and `closes_when`. Every contract-A field is persisted — none is computed by the enforcer and then discarded. Severity and category exist for Phase-2 human triage, not for dedup.
- **Seen-set derivation**: the set of all header lines (id + anchor) plus their `Gap` bodies. `close-design` builds the fresh enforcer's "out of scope" list from these.
- **Managed marker**: the HTML comment immediately under the heading is REQUIRED (CON-004).
- **Empty state**: a freshly created spec has the heading + comment and no entries (REQ-023).

### 4.3 Orchestration interface — close-design under /goal

- Invocation: the `close-design` skill is invoked (typically under `/goal`) with the spec file path as argument.
- Goal criterion handed to `/goal`: "The Design Gaps section of `<spec>` has reached a fixed point — the most recent fresh-enforcer round produced zero net-new findings after deduplication."
- Per-round procedure (the loop body the skill instructs the main agent to run):
  1. Build the seen-set from the current Design Gaps section (§4.2).
  2. Spawn a FRESH `closed-design-enforcer` (Agent tool), passing: the full spec content, the seen-set marked "already known, out of scope — return only net-new gaps."
  3. Receive contract-A output.
  4. Semantically dedup returned findings against the seen-set; drop duplicates.
  5. If net-new count is 0 → converged, exit loop. Else assign ids, append entries (§4.2), continue.

### 4.4 Spec template & augmentation (create-specification / update-specification)

- Base template: the 11-section AI-ready template from the existing `create-specification` skill (Introduction; 1 Purpose & Scope; 2 Definitions; 3 Requirements, Constraints & Guidelines; 4 Interfaces & Data Contracts; 5 Acceptance Criteria; 6 Test Automation Strategy; 7 Rationale & Context; 8 Dependencies & External Integrations; 9 Examples & Edge Cases; 10 Validation Criteria; 11 Related Specifications).
- Save location & naming: `/spec/spec-[a-z0-9-]+.md`, prefixed by one of `schema|tool|data|infrastructure|process|architecture|design`.
- Augmentation layer adds:
  - A REQUIRED trailing `## Design Gaps` section scaffolded empty (REQ-023, §4.2).
  - A self-containment mandate (REQ-024): explicit integration hows, `file:line` anchors, domain constraints, and wiring shape, so the spec runs cold under `/goal`.

### 4.5 implement-spec dispatcher structure

**Template Method skeleton (fixed order, invariant steps).**

| Step | Name | Role | Varies by strategy? |
|---|---|---|---|
| 1 | Preconditions | Load spec, enable LSP, decompose via `task-planning` into blocks + dependency graph | No |
| 2 | Select | Run the two-axis dispatch (REQ-026) and log the chosen strategy + rationale | No |
| 3 | Execute | Run the chosen strategy (the only pluggable step) | YES (Strategy) |
| 4 | Quality gate | Phase 3 suite (REQ-021) | Location varies (REQ-028) |
| 5 | Verify | Main agent confirms the change actually works | No |
| 6 | Cleanup | Clean working tree; changes left on a dedicated branch | No |

**Strategy contract (common interface for step 3).** Input: the decomposed spec + dependency graph. Output: a verified implementation on a dedicated branch. Concrete strategies:

| Strategy | Selected when | Execution shape | Quality gate location |
|---|---|---|---|
| `write-directly` | Fits context budget (Axis 1) | Main agent writes code directly; minimal delegation | Step 4, post-execution (main agent) |
| `agent-waves` | Exceeds budget + decision-open (Axis 2) | Sub-agents in dependency-ordered waves; main agent retains partial control, reconciles/merges between waves | Step 4, post-execution (main agent) |
| `workflow` | Exceeds budget + decision-closed (Axis 2) | Main agent authors a `workflow-creator`-framed script and delegates fully; supervises the aggregate | Baked into the script as terminal phases (REQ-028) |

**Dispatch decision procedure (Chain-of-Responsibility order):**

```text
1. Does the work fit the context budget (~300k target)?           → write-directly
2. Else: is the orchestration decision-closed?
     (operational test, GUD-001: can I write the whole script now?)
     - yes  → workflow      (full delegation; gate baked in)
     - no   → agent-waves    (partial control; gate post-execution)
```

## 5. Acceptance Criteria

- **AC-001**: Given the mono-repo, When the spec is implemented, Then `plugins/spec-kit/` contains the manifest, one agent, and four skills exactly as listed in REQ-002, and `plugin.json` validates against the sibling-plugin schema.
- **AC-002**: Given a spec with N open design gaps and a stable design, When `close-design` runs under `/goal`, Then it spawns a fresh enforcer per round, appends only net-new gaps, and terminates on the first round with zero net-new findings.
- **AC-003**: Given an enforcer round, When it returns findings, Then every `closes_when` describes a type of decision and none prescribes a concrete solution.
- **AC-004**: Given the enforcer agent definition, When its frontmatter is inspected, Then `tools` contains no write-capable tool (`Edit`/`Write`/`Bash` absent).
- **AC-005**: Given a converged spec at the human gate, When Diego accepts a gap, Then the decision is folded into the spec body via `update-specification` and the corresponding `DG-NNN` entry is removed.
- **AC-006**: Given the human gate completes, When the spec is inspected, Then the Design Gaps section contains zero entries (clean document).
- **AC-007**: Given a spec to implement, When `implement-spec` runs, Then it selects exactly one of `write-directly`/`agent-waves`/`workflow` and, if `workflow`, invokes the Workflow tool as a tool under the goal-driven agent rather than nesting `/goal`.
- **AC-008**: Given any implementation strategy completes, When `implement-spec` declares done, Then the Phase 3 quality suite (REQ-021) has run and manual behavior verification has been performed.
- **AC-009**: Given a newly created spec, When inspected, Then it contains an empty managed `## Design Gaps` section and satisfies the self-containment mandate (REQ-024).
- **AC-010**: The system shall mutate the Design Gaps section only through `close-design` (append) and `update-specification` (remove); no other component writes it.
- **AC-011**: Given a spec whose implementation fits the context budget, When `implement-spec` selects a strategy, Then it picks `write-directly`.
- **AC-012**: Given an implementation that exceeds the context budget with decision-open coordination, When `implement-spec` selects a strategy, Then it picks `agent-waves`; given decision-closed coordination, Then it picks `workflow`.
- **AC-013**: Given the `workflow` strategy is selected, When the workflow is built, Then it is authored under the `workflow-creator` framework and the Phase 3 quality gate is present as terminal phases of the script.
- **AC-014**: Given any strategy completes, When the result returns to the main agent, Then the main agent performs behavior verification (step 5) regardless of strategy.
- **AC-015**: Given the plugin components are built, When their authoring is inspected, Then `closed-design-enforcer.md` was produced via `claude-code-agent-creator`, `close-design`/`implement-spec` via `skill-creator`, and `create-specification`/`update-specification` by copy-and-augment.
- **AC-016**: Given `implement-spec` runs, When its steps are observed, Then steps 1/2/4/5/6 execute identically across strategies and only step 3 (Execute) differs.

## 6. Test Automation Strategy

This is a Claude Code plugin authored in Markdown (skills/agents) and JSON (manifest); there is no executable test runner. Validation is structural and behavioral:

- **Test Levels**: structural validation (frontmatter, manifest schema, file presence) and behavioral dry-runs (invoke `close-design` and `implement-spec` against a throwaway sample spec).
- **Frameworks**: none required; use `plugin-dev:plugin-validator` for structure and manual dry-runs for behavior.
- **Test Data Management**: a disposable sample spec under `/spec/` (e.g. a trivial feature) used to exercise the loop and the dispatcher; delete after.
- **CI/CD Integration**: none in this repo for plugins; the `format-dispatcher` hook (markdownlint) runs on edits.
- **Coverage Requirements**: every REQ in §3 maps to at least one AC in §5.
- **Performance Testing**: not applicable.

## 7. Rationale & Context

- **Why a read-only enforcer with no closure authority.** Separating detection from arbitration removes the worst failure mode of self-auditing loops: a detector that declares victory to end its own loop. The enforcer can only report; closing is a human+main-agent decision.
- **Why conceptual `closes_when` instead of concrete proposals.** A concrete proposal anchors the arbiter's judgment toward the enforcer's solution (possibly a local optimum), pollutes the dedup signal (a proposal can be mistaken for a settled decision by the next fresh enforcer), and inflates tokens on suggestions that may be dismissed. Restricting the field to the *type* of decision keeps the enforcer in its lane (detect, not design) and leaves design to those with full context.
- **Why fresh enforcers each round.** Fresh, stateless eyes avoid both context contamination and the fatigue/bias of a single agent rationalizing prior misses. The stateful memory lives where it belongs — in the orchestrator — yielding a clean loop-until-dry (PAT-001).
- **Why close-design is the single writer.** Diego chose report-then-orchestrator-writes over enforcer-writes-directly because the orchestrator holds the close-design context and applies the redaction pattern consistently. This also localizes the seen-set/dedup in one place (PAT-003) and lets the enforcer stay fully read-only.
- **Why "one shot" (un tirón).** Once dedup no longer needs human input per round, intercalating human gates would only break `/goal` autonomy without benefit. Running the loop to a fixed point and gating once is both simpler and cheaper.
- **Why terminate on zero net-new *after dedup* rather than zero returned.** A fresh enforcer may reword an existing gap; counting raw returns would make "absolute zero" fragile. Deduping first makes convergence robust. GUD-002 leaves room to require K consecutive empty rounds if needed.
- **Why accept cross-run re-litigation of dismissed gaps (CON-005).** Accepted gaps fold into the spec body, so a fresh enforcer sees them answered and will not re-raise them. Only dismissed gaps could resurface — and a fresh auditor re-questioning an evolved spec is arguably correct; re-dismissal costs seconds. A persisted ledger would dirty the clean-document invariant for little gain.
- **Why goal-uses-workflow-as-tool (PAT-002).** `/goal` is a main-loop construct; the Workflow tool runs its own background orchestration. They cannot nest. The resolution is inversion: the goal-driven agent treats Workflow as one execution strategy it invokes and supervises. This is what unlocked the third dispatcher strategy.
- **Why augmented copies rather than symlinks.** The existing skills are symlinked from `~/.agents/skills`; the plugin needs them to carry Diego's closure layer (self-containment mandate + Design Gaps scaffolding), so they become a deliberate fork. Maintenance trade-off acknowledged: the fork can drift from upstream; re-basing against upstream is a manual, occasional task.
- **Why Template Method + Strategy for the dispatcher.** The current `implement-spec` mixes the invariant skeleton with the variable execution, duplicating the quality gate and verification across strategies. Fixing the skeleton (Template Method) and isolating the single pluggable Execute step (Strategy) removes that duplication and makes adding/altering a strategy a local change.
- **Why two orthogonal axes instead of a block count.** Scale and orchestration closure are independent questions. Block count conflates them: 40 uniform items and 6 tangled interdependent blocks both "exceed 5" but call for opposite strategies. Axis 1 (scale, gated by the context budget) decides *whether to delegate at all*; Axis 2 (closure) decides *how*. The real driver behind Axis 1 is a concrete pain point: a prior `implement-spec` run reached ~450k tokens; the target is ≤300k.
- **Why orchestration-level mechanicity, not unit difficulty.** The `agent-waves` vs `workflow` choice hinges on whether coordination decisions can be closed up front, not on how hard each item is. A workflow pairs intelligent workers with mechanical coordination (e.g. `typescript-migration`'s per-chunk typers). The main agent's degree of control is the consequence: decision-closed coordination means nothing to judge mid-flight, so full delegation is safe. This mirrors the plugin's own closure philosophy — close the orchestration before scripting it, just as the spec closes its design before implementing it.
- **Why the workflow strategy bakes the gate into the script.** A workflow runs detached in the background; the main agent cannot run a coherent post-hoc gate over work it did not directly supervise. Encoding the Phase 3 gate as terminal phases keeps the guarantee intact while honoring the `workflow-creator` framing. Behavior verification stays with the main agent because it requires running the real system, which is outside the workflow's scope.
- **Why auto-launching a workflow under `/goal` is acceptable.** Delegating to a workflow when the work is decision-closed and over budget is expected Claude Code behavior; requiring a separate authorization would break `/goal` autonomy for no safety gain, since the baked-in gate (REQ-028) preserves quality.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: Claude Code harness — provides the `/goal` command, the Agent (sub-agent) tool, and the Workflow tool consumed by `close-design` and `implement-spec`.

### Third-Party Services

- **SVC-001**: None.

### Infrastructure Dependencies

- **INF-001**: The plugins mono-repo at `/home/diego/Documents/config/claude`, following the established `plugins/<name>/.claude-plugin/plugin.json` + `skills/` + `agents/` layout.

### Data Dependencies

- **DAT-001**: Existing skill sources to copy and augment — `/home/diego/.agents/skills/create-specification/SKILL.md` and `/home/diego/.agents/skills/update-specification/SKILL.md`.
- **DAT-002**: Existing implement-spec to rewrite — `/home/diego/.claude/skills/implement-spec/SKILL.md`.

### Technology Platform Dependencies

- **PLT-001**: Claude Code plugin runtime; skills as `SKILL.md` with `name`+`description` frontmatter; agents as Markdown with `name`/`description`/`tools`/`model` frontmatter.

### Compliance Dependencies

- **COM-001**: Root `CLAUDE.md` authoring rules (no emojis, English content/Spanish conversation, self-contained specs).

## 9. Examples & Edge Cases

Enforcer return for a candidate convergence round (empty findings):

```json
{ "findings": [] }
```

Design Gaps section mid-loop (two logged gaps, vertically scalable):

```markdown
## Design Gaps
<!-- managed by spec-kit:close-design — do not edit by hand -->

### DG-001 · open · spec
**Gap:** The spec does not state where new domain modules are registered with the router.
**Closes when:** The exact registration site (file:line) and call shape are specified.

### DG-002 · open · src/payments/checkout.ts:88
**Gap:** Ordering between webhook arrival and invoice confirmation is undefined.
**Closes when:** A policy exists defining that ordering — the decision, not the mechanism.
```

Edge cases:

- **Enforcer returns a reworded duplicate**: `close-design` dedups it against the seen-set; it does NOT count as net-new (prevents false non-convergence).
- **Enforcer returns a concrete solution in `closes_when`**: treated as a contract-A violation; `close-design` SHOULD rewrite it to the conceptual form or re-request, never persist the concrete solution.
- **First round returns zero findings**: the spec is already closed; the loop exits immediately and the human gate finds an empty section (no-op).
- **Diego dismisses every gap**: spec body unchanged; Design Gaps section ends empty; spec proceeds to `implement-spec`.
- **A single dismissed gap reappears in a later `close-design` run on an evolved spec**: accepted by design (CON-005); re-dismiss.

## 10. Validation Criteria

- Every REQ-### in §3 maps to at least one AC-### in §5.
- `plugin-dev:plugin-validator` reports a valid plugin structure for `plugins/spec-kit/`.
- The enforcer frontmatter contains only read-capable tools.
- A dry-run of `close-design` against a deliberately under-specified sample spec logs at least one gap, then converges, with all entries removed after arbitration.
- A dry-run of `implement-spec` selects a single strategy and, for the `workflow` path, invokes the Workflow tool without nesting `/goal`.
- The created spec files pass markdownlint (via the repo's `format-dispatcher` hook).

## 11. Related Specifications / Further Reading

- Root `CLAUDE.md` (plugins mono-repo overview, planning & authoring rules): `/home/diego/Documents/config/claude/CLAUDE.md`
- Existing create-specification skill (augmentation source): `/home/diego/.agents/skills/create-specification/SKILL.md`
- Existing update-specification skill (augmentation source): `/home/diego/.agents/skills/update-specification/SKILL.md`
- Existing implement-spec skill (rewrite source): `/home/diego/.claude/skills/implement-spec/SKILL.md`
- Plugin manifest convention: `/home/diego/Documents/config/claude/plugins/git-toolkit/.claude-plugin/plugin.json`
- Agent frontmatter convention: `/home/diego/Documents/config/claude/plugins/git-toolkit/agents/git-history-retriever.md`
- Sibling reference spec (style/structure): `/home/diego/Documents/config/claude/spec/spec-architecture-domain-restructure.md`

## Design Gaps
<!-- managed by spec-kit:close-design — do not edit by hand -->
