---
title: domain-restructure Plugin — Strategic-DDD Screaming-Architecture Restructurer
version: 1.1
date_created: 2026-06-11
last_updated: 2026-06-11
owner: Diego López Torres (DieGopherLT)
tags: [architecture, plugin, claude-code, ddd, screaming-architecture, workflow, refactor]
---

# Introduction

This specification defines a new Claude Code plugin, **`domain-restructure`**, for the
`DieGopherLT/dotclaudefiles` mono-repo. The plugin performs a **pure structural refactor** of a
codebase: it transforms a **layer-first** organization (top-level `controllers/`, `services/`,
`models/`, `routes/` with files named by entity) into a **feature-first / screaming-architecture**
organization (`modules/<domain>/<layer>` where each domain is a bounded context). It does **not**
change runtime behavior — it only moves files and rewrites import paths.

The plugin ships a thin orchestrator **skill** that enters a dedicated git worktree and launches a
deterministic **6-phase Workflow** (the `ultracode`-style dynamic Workflow-tool script) driving a
roster of specialized sub-agents. It is the architectural sibling of the existing
`typescript-migration` and `testing` plugins and MUST follow their conventions exactly.

## 1. Purpose & Scope

### Purpose

Automate the migration of a project's physical structure so that the file system "screams" the
business domain rather than the technical framework. After a successful run, listing the module
root (`ls src/modules/`) reads like the business (`credits/`, `mining/`, `newsletter/`), not like
an Express scaffold (`controllers/`, `services/`).

### In scope

- **Strategic DDD only**: bounded-context discovery, ubiquitous-language naming, and subdomain
  classification (Core / Supporting / Generic) used to decide **where files go**.
- File relocation via `git mv` (history-preserving) and import-path rewriting.
- A build/typecheck/test gate proving behavior is unchanged.
- Autonomous end-to-end execution inside a dedicated worktree, ending in a single green commit.

### Out of scope (MUST NOT be performed)

- **Tactical DDD**: introducing or rewriting entities, value objects, aggregates, domain events,
  or repositories inside file contents. That is a functional change and belongs to a different
  tool. Any agent that "improves the model" violates the zero-behavior-change guarantee.
- Service/microservice extraction. A bounded context here is a **module boundary inside a
  monolith**, never a deployment unit.
- Renaming symbols, changing function signatures, or altering logic.

### Intended audience

A cold Claude Code agent with zero knowledge of the originating conversation, tasked with building
the plugin from this spec, plus future maintainers.

### Reference projects (the pain and the goal)

- **Pain (layer-first)** — `/home/diego/Documents/taloon/caos/engine`: top-level `controllers/`,
  `services/`, `models/`, `routes/` with files like `controllers/controller.user.ts`,
  `services/service.credits.ts`, `models/model.payment.ts`. Touching one feature spans 5 directories.
- **Goal (feature-first)** — `/home/diego/Documents/taloon/block_lotto/api`: `src/modules/{core,lotto,rabbit}/`
  where each module contains its own `controllers/ services/ models/ routes/ ...`. `core` holds the
  generic/shared subdomain. This is the target shape.

## 2. Definitions

| Term | Definition |
|------|------------|
| **Layer-first** | Top-level directories named by technical role (controllers, services, models, routes); a feature is scattered across them. |
| **Feature-first / Screaming Architecture** | Top-level directories named by domain; each contains its own technical layers. The structure communicates the domain. |
| **Bounded context** | A model/linguistic boundary. Here, realized as one `modules/<domain>/` directory. NOT a microservice. |
| **Ubiquitous language** | Business vocabulary used as the canonical name for each domain. A domain name a domain expert would recognize. |
| **Subdomain classification** | Strategic-DDD distinction: **Core** (the differentiator → its own weighted module), **Supporting** (necessary, not differentiating → its own module), **Generic** (commodity: auth, email, payments, config → goes to `core/` or `shared/`). |
| **Layer taxonomy** | The set of technical roles for the detected stack (e.g. Express: controllers/services/models/routes/middlewares; React: components/hooks/contexts/pages; Go: handlers/repositories/usecases). |
| **Path map** | The authoritative `old_path → new_path` mapping of every relocated file, emitted as structured output. The central artifact passed from movers to the consolidator. |
| **Membership map** | `file → owning_domain` mapping produced by reconciliation; lets a mover know which import edges are "its own". |
| **Import edge** | A directed dependency `A imports B` between two files. |
| **Intra-domain edge** | Both endpoints land in the same `modules/<domain>/`. |
| **Cross-cutting edge** | Endpoints in different domains, or one endpoint in `core/`/`shared/`, or a barrel/config reference. |
| **Single-owner invariant** | Every import edge is fixed by exactly one owner: intra-domain edges by that domain's mover; cross-cutting edges by the consolidator. Guarantees no write races. |
| **Build gate** | The project's real verification command (typecheck/build/test) used to prove the refactor compiles and behaves identically. |
| **Worktree** | A dedicated git worktree under `.claude/worktrees/` (gitignored) where the entire pipeline runs in isolation. |

## 3. Requirements, Constraints & Guidelines

### Plugin packaging

- **REQ-001**: Create `plugins/domain-restructure/` following the `typescript-migration` layout:
  `.claude-plugin/plugin.json`, `agents/*.md`, `skills/domain-restructure/SKILL.md`,
  `skills/domain-restructure/workflow.js`.
- **REQ-002**: `plugin.json` MUST mirror the schema at
  `plugins/typescript-migration/.claude-plugin/plugin.json` (name, version `1.0.0`, description,
  author Diego with GitHub URL, repository, license MIT, keywords). Keywords MUST include:
  `architecture`, `ddd`, `screaming-architecture`, `domain`, `refactor`, `restructure`, `worktree`,
  `bounded-context`, `monolith`.
- **REQ-003**: Register the plugin in `.claude-plugin/marketplace.json` with a `name`,
  `description`, and `source: "./plugins/domain-restructure"` entry, per the lifecycle rule in
  `.claude/rules/plugins/version-management.md`.
- **REQ-004**: Update the root `CLAUDE.md`: increment the plugin count from eight to nine, add a
  `### domain-restructure` description section, a `**Use domain-restructure when:**` block, the
  `/plugin install domain-restructure@diegopher` line, and the key-directories list.

### Skill orchestrator

- **REQ-010**: `SKILL.md` frontmatter `name` MUST be `domain-restructure`. The `description` MUST
  be written in English and trigger on phrases such as: "restructure by domain",
  "screaming architecture", "group by feature", "reorganize the architecture",
  "domain-driven structure", "apply DDD to the folders", "move into modules per domain", plus
  `ultracode`. It MUST explicitly say it is a **structural refactor with zero functional change**
  and NOT for tactical-DDD modeling.
- **REQ-011**: The skill MUST enter a dedicated worktree via the `EnterWorktree` tool (never `cd`),
  named `domain-restructure-<project-name>`, under `.claude/worktrees/`. All sub-agents run inside it.
- **REQ-012**: The skill MUST NOT set `isolation: 'worktree'` on the Workflow call (it is already
  inside the worktree).
- **REQ-013**: The skill orchestrator owns scope/validation (Steps 1–4 analog of
  `typescript-migration` SKILL.md:28-55), then launches the Workflow (Step 5), then hands off the
  worktree for the user's merge (Step 6). The merge is the **single human gate**; the pipeline is
  otherwise end-to-end automatic.
- **REQ-014**: The skill accepts an **optional path argument** to scope the restructure to a
  subdirectory; default scope is the detected code root (e.g. `src/`).

### Workflow phases

- **PHASE-0 (Contract)**: One agent. Detects stack/framework, the **layer taxonomy**, the current
  organizational axis, the target convention (`modules/` vs `features/` vs `internal/`), the
  **import strategy** (relative vs path alias such as `@/`), and the **build gate command**.
- **PHASE-1 (Scan)**: One agent. Returns `{ domain, examples[] }[]` where each `domain` is a
  **ubiquitous-language** business term and `examples` are 2–3 representative file paths.
- **PHASE-2 (Group)**: `parallel()` fan-out, one agent per domain. Returns per-domain
  `<layer, files[]>`. The barrier into PHASE-3 is justified: reconcile needs **all** domain
  groupings at once to detect cross-domain claims, orphans, and collisions (the dedup/merge barrier
  criterion).
- **PHASE-3 (Reconcile)**: One agent. Classifies each domain Core/Supporting/Generic, resolves
  files claimed by multiple domains (→ `core`/`shared`), orphan files (flag/assign), and path
  collisions (rename). Emits the **move plan**, the **path map**, and the **membership map**.
- **PHASE-4 (Move)**: `parallel()` fan-out, one agent per domain. Performs `mkdir` + plain
  filesystem `mv` (NOT `git mv` — see CON-001) on its domain's files, plus fixes **intra-domain**
  import edges, and emits its slice of the path map. MUST NOT touch cross-cutting edges. The barrier
  into PHASE-5 is justified: the consolidator needs the full set of moves and a quiescent
  whole-project tree before the global import fix and build gate.
- **PHASE-5 (Consolidate)**: One agent. Runs a single `git add -A` so git's rename detection records
  every relocation with history preserved (CON-001). Consumes the global path map; fixes all
  cross-cutting import edges, barrel files (`index.ts` re-exports), and non-code path references
  (tsconfig `paths`, test config, bundler config, dynamic imports). Runs the build gate, loops until
  green, then asserts the diff contains **only file relocations and import-path edits**
  (pure-refactor contract).

### Constraints

- **CON-001**: History MUST be preserved, but via git's **rename detection at `git add -A`** in
  PHASE-5, NOT per-mover `git mv`. Rationale: PHASE-4 movers run concurrently in one shared worktree;
  concurrent `git mv` calls contend on `.git/index.lock` and fail intermittently. Plain filesystem
  `mv` has no index lock; a single `git add -A` in PHASE-5 then detects every relocation as a rename
  (a pure move is 100% similar, well above git's 50% threshold) so `git log --follow` still works.
  Edge case: a small file whose intra-domain import edits change >50% of its lines may not be detected
  as a rename — PHASE-4 MUST skip content edits on such files and defer those edges to PHASE-5, or
  `log()` the lost-history file. Never delete+recreate.
- **CON-002**: The project does NOT compile between PHASE-4 start and PHASE-5 success; this is by
  design. The only meaningful gate is the global build gate in PHASE-5.
- **CON-003**: The final result MUST be a **single green commit** (moves + import fixes together).
  Per-domain commits are explicitly rejected (they break intermediate bisectability because the
  project cannot compile mid-move).
- **CON-004**: Zero functional change. PHASE-5 MUST verify the git diff touches only file locations
  and import statements; any other content change is a violation to be reverted or reported.
- **CON-005**: No tactical-DDD edits (entities/VOs/aggregates/events/repositories) anywhere.
- **CON-006**: The single-owner invariant MUST hold — a mover only rewrites edges whose **both**
  endpoints belong to its own domain (per the membership map); all other edges belong to PHASE-5.

### Guidelines

- **GUD-001**: Preserve the layer substructure on move (`controllers/X` → `modules/<d>/controllers/X`)
  so that many intra-domain relative imports survive unchanged.
- **GUD-002**: Treat naming difficulty as a design signal — if PHASE-1/PHASE-3 cannot name a cluster
  with a business term, flag the grouping as suspect rather than inventing a technical name.
- **GUD-003**: Per-role thinking load is **pinned in each bundled sub-agent's frontmatter** and
  referenced from the Workflow via `agentType` (the plugin case — see PAT-004 and the roster in
  Section 4.0). Downshift the fleet (Group, Move), spend on the tail (Reconcile, Consolidate). The
  Workflow MUST NOT set inline `model` on these calls; `agentType` carries both model and effort.
- **GUD-004**: After building every component, run the `plugin-validator` agent
  (`.claude/rules/plugins/use-plugin-dev.md`).

### Patterns

- **PAT-001**: Author the Workflow with `workflow-creator`; author each sub-agent with
  `claude-code-agent-creator`.
- **PAT-002**: Phase shape follows `typescript-migration/workflow.js`: PHASE-0→1 sequential;
  PHASE-2 is a `parallel()` fan-out with a **justified barrier** into the single PHASE-3 reducer
  (needs all groups to dedup/merge); PHASE-3→4 sequential; PHASE-4 is a `parallel()` fan-out with a
  **justified barrier** into the single PHASE-5 reducer (needs the whole quiescent tree). This is NOT
  a `pipeline()` — a domain cannot flow from Group straight to Move because Reconcile reshapes
  domains (merges, reclassifies) at a mandatory barrier. Each fan-out resolves to `null` on a skipped
  or dead agent, so the script MUST `.filter(Boolean)` before consuming results.
- **PAT-003**: Pass data between phases via structured-output `schema` objects (Section 4), never by
  re-deriving from `git diff`. Every processed `agent()` call MUST set `schema`.
- **PAT-004**: Because this is a **plugin**, author each sub-agent with `claude-code-agent-creator`,
  pin its `(model, effort)` in frontmatter, bundle it under `plugins/domain-restructure/agents/`, and
  reference it from the Workflow via `agentType: 'domain-restructure:<name>'`. This is the only way
  to differentiate effort per role (the Workflow `agent()` call has a `model` knob but no `effort`
  knob), and it is safe here because the plugin ships and travels with its own `agents/` registry.
- **PAT-005**: `workflow.js` runtime constraints (enforced by the Workflow tool): `meta` is a **pure
  literal** (no variables, calls, spreads, interpolation); **plain JavaScript only** (no TypeScript
  syntax); `Date.now()`, `Math.random()`, and argless `new Date()` **throw** (pass any timestamp via
  `args`); no filesystem/Node APIs in the script body itself (sub-agents do the file work).

## 4. Interfaces & Data Contracts

The Workflow is a JavaScript script at
`plugins/domain-restructure/skills/domain-restructure/workflow.js`, structurally modeled on
`plugins/typescript-migration/skills/typescript-migration/workflow.js` (meta block at lines 1-11,
schema block 43-116, prompt builders 122-143, phase execution 149-279).

### Workflow inputs (`args`)

```json
{
  "projectRoot": "<absolute path to the project inside the worktree>",
  "scopePath":   "<optional subdirectory to restrict the restructure, or null>"
}
```

### 4.0 Agent roster (bundled, pinned model + effort)

Each phase calls its bundled sub-agent via `agentType`; the `(model, effort)` is pinned in that
agent's frontmatter (PAT-004). Effort rationale per the workflow-creator role table: downshift the
high-volume fleet, spend on the deciding tail (Reconcile holds the global plan; Consolidate is the
synthesizer and must hold the full path map in context — Opus's larger window matters here).

| Phase | `agentType` | Role | Model | Effort | Why |
|-------|-------------|------|-------|--------|-----|
| 0 | `domain-restructure:contract-auditor` | Detect stack, taxonomy, import strategy, build gate | sonnet | high | Bounded detection, but foundational — a wrong taxonomy poisons all downstream phases |
| 1 | `domain-restructure:domain-scanner` | Identify bounded contexts via ubiquitous language | opus | high | Open-ended judgment; naming domains is the crux of the whole refactor |
| 2 | `domain-restructure:domain-grouper` | Bucket a domain's files by layer (fleet, 1/domain) | sonnet | medium | Classification over a known taxonomy; high volume → downshift |
| 3 | `domain-restructure:reconciler` | Subdomain class + resolve shared/orphan/collision; emit maps | opus | high | Central decider over the global grouping set |
| 4 | `domain-restructure:domain-mover` | `mv` + intra-domain import fix (fleet, 1/domain) | sonnet | medium | Mechanical relocation + local edits; high volume → downshift |
| 5 | `domain-restructure:consolidator` | Global import fix, build gate loop, pure-refactor assert | opus | high | Synthesizer tail; must hold the full path map; a miss wastes the whole run |

### 4.1 Workflow control-flow skeleton (normative shape)

```js
// PHASE 0 — Contract (sequential)
const contract = await agent(contractPrompt(), { agentType: 'domain-restructure:contract-auditor', schema: CONTRACT_SCHEMA, label: 'contract', phase: 'Contract' })
if (!contract || contract.currentAxis === 'feature-first') return { ok: false, reason: 'already feature-first or no contract' }

// PHASE 1 — Scan (sequential)
const scan = await agent(scanPrompt(contract), { agentType: 'domain-restructure:domain-scanner', schema: DOMAIN_SCAN_SCHEMA, label: 'scan', phase: 'Scan' })
const domains = (scan?.domains ?? [])
if (domains.length === 0) return { ok: false, reason: 'no domains found' }

// PHASE 2 — Group (parallel fan-out; barrier into Reconcile)
const groups = (await parallel(domains.map(d => () =>
  agent(groupPrompt(d, contract), { agentType: 'domain-restructure:domain-grouper', schema: DOMAIN_GROUP_SCHEMA, label: `group:${d.domain}`, phase: 'Group' })
))).filter(Boolean)

// PHASE 3 — Reconcile (single; needs ALL groups → barrier justified)
const plan = await agent(reconcilePrompt(groups, contract), { agentType: 'domain-restructure:reconciler', schema: RECONCILE_SCHEMA, label: 'reconcile', phase: 'Reconcile' })
if (!plan || !plan.movePlan?.length) return { ok: false, reason: 'reconciliation produced no moves' }

// PHASE 4 — Move (parallel fan-out; plain mv + intra-domain edits; barrier into Consolidate)
const moves = (await parallel(plan.movePlan.map(mp => () =>
  agent(movePrompt(mp, plan.membershipMap, contract), { agentType: 'domain-restructure:domain-mover', schema: MOVE_SCHEMA, label: `move:${mp.domain}`, phase: 'Move' })
))).filter(Boolean)

// PHASE 5 — Consolidate (single; git add -A, global import fix, build gate loop)
const result = await agent(consolidatePrompt(plan.pathMap, moves, contract), { agentType: 'domain-restructure:consolidator', schema: CONSOLIDATE_SCHEMA, label: 'consolidate', phase: 'Consolidate' })
return { ok: true, mergeable: Boolean(result?.buildPasses && result?.diffIsPureRefactor), ...summarize(plan, moves, result) }
```

### CONTRACT_SCHEMA — PHASE-0 output

```json
{
  "type": "object",
  "required": ["stack", "layerTaxonomy", "currentAxis", "targetConvention", "importStrategy", "buildGate", "codeRoot"],
  "properties": {
    "stack": { "type": "string", "description": "e.g. express-node | react-vite | nextjs | go | generic" },
    "layerTaxonomy": { "type": "array", "items": { "type": "string" }, "description": "technical roles for this stack, e.g. [controllers, services, models, routes, middlewares]" },
    "currentAxis": { "type": "string", "description": "layer-first | feature-first | flat | mixed" },
    "targetConvention": { "type": "string", "description": "directory prefix for domains, e.g. src/modules | src/features | internal" },
    "importStrategy": { "type": "string", "description": "relative | alias" },
    "aliasRoot": { "type": "string", "description": "alias prefix if importStrategy=alias, e.g. @/ (else empty)" },
    "buildGate": { "type": "string", "description": "exact shell command to verify build/typecheck/test, e.g. pnpm tsc --noEmit && pnpm test" },
    "codeRoot": { "type": "string", "description": "relative path of the code root to restructure, e.g. src" },
    "nonCodePathRefs": { "type": "array", "items": { "type": "string" }, "description": "config files that reference paths and may need updating (tsconfig.json, vitest.config.ts, etc.)" }
  }
}
```

### DOMAIN_SCAN_SCHEMA — PHASE-1 output

```json
{
  "type": "object",
  "required": ["domains"],
  "properties": {
    "domains": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["domain", "examples"],
        "properties": {
          "domain": { "type": "string", "description": "ubiquitous-language business term, kebab-case" },
          "examples": { "type": "array", "items": { "type": "string" }, "description": "2-3 representative file paths" },
          "namingConfidence": { "type": "number", "description": "0-1; low = cluster hard to name, suspect grouping" }
        }
      }
    }
  }
}
```

### DOMAIN_GROUP_SCHEMA — PHASE-2 output (one per domain)

```json
{
  "type": "object",
  "required": ["domain", "layers"],
  "properties": {
    "domain": { "type": "string" },
    "layers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["layer", "files"],
        "properties": {
          "layer": { "type": "string", "description": "one of the CONTRACT layerTaxonomy values" },
          "files": { "type": "array", "items": { "type": "string", "description": "current file path" } }
        }
      }
    }
  }
}
```

### RECONCILE_SCHEMA — PHASE-3 output (the central planning artifact)

```json
{
  "type": "object",
  "required": ["movePlan", "pathMap", "membershipMap", "subdomainClass"],
  "properties": {
    "subdomainClass": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["domain", "classification", "targetDir"],
        "properties": {
          "domain": { "type": "string" },
          "classification": { "type": "string", "description": "core | supporting | generic" },
          "targetDir": { "type": "string", "description": "destination dir, e.g. src/modules/credits or src/modules/core" }
        }
      }
    },
    "pathMap": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["oldPath", "newPath", "domain"],
        "properties": {
          "oldPath": { "type": "string" },
          "newPath": { "type": "string" },
          "domain": { "type": "string", "description": "owning domain (or 'core'/'shared')" }
        }
      }
    },
    "membershipMap": { "type": "object", "description": "map of file path -> owning domain", "additionalProperties": { "type": "string" } },
    "movePlan": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["domain", "moves"],
        "properties": {
          "domain": { "type": "string" },
          "moves": { "type": "array", "items": { "type": "object", "required": ["oldPath", "newPath"], "properties": { "oldPath": { "type": "string" }, "newPath": { "type": "string" } } } }
        }
      }
    },
    "collisions": { "type": "array", "items": { "type": "string" }, "description": "resolved path collisions (renamed)" },
    "orphans": { "type": "array", "items": { "type": "string" }, "description": "files assigned to no domain; flagged" }
  }
}
```

### MOVE_SCHEMA — PHASE-4 output (one per domain)

```json
{
  "type": "object",
  "required": ["domain", "movedCount", "intraDomainEdgesFixed", "pathMapSlice"],
  "properties": {
    "domain": { "type": "string" },
    "movedCount": { "type": "number", "description": "files git-mv'd for this domain" },
    "intraDomainEdgesFixed": { "type": "number" },
    "pathMapSlice": { "type": "array", "items": { "type": "object", "required": ["oldPath", "newPath"], "properties": { "oldPath": { "type": "string" }, "newPath": { "type": "string" } } } },
    "deferredEdges": { "type": "array", "items": { "type": "string" }, "description": "cross-cutting imports left for the consolidator" }
  }
}
```

### CONSOLIDATE_SCHEMA — PHASE-5 output

```json
{
  "type": "object",
  "required": ["buildPasses", "crossCuttingEdgesFixed", "diffIsPureRefactor"],
  "properties": {
    "buildPasses": { "type": "boolean", "description": "build gate exits zero" },
    "crossCuttingEdgesFixed": { "type": "number" },
    "barrelsUpdated": { "type": "array", "items": { "type": "string" } },
    "configRefsUpdated": { "type": "array", "items": { "type": "string" } },
    "diffIsPureRefactor": { "type": "boolean", "description": "true iff git diff touches only file locations and import statements" },
    "behaviorChangeViolations": { "type": "array", "items": { "type": "string" }, "description": "non-import content changes detected; must be empty for a clean run" },
    "residualErrors": { "type": "array", "items": { "type": "string" } }
  }
}
```

### Workflow return value (to the skill)

```json
{
  "ok": true,
  "mergeable": "boolean — buildPasses && diffIsPureRefactor && no orphans/violations",
  "buildPasses": "boolean",
  "domainsCreated": "number",
  "filesMoved": "number",
  "crossCuttingEdgesFixed": "number",
  "subdomainClass": "array (from PHASE-3)",
  "residualErrors": "array",
  "behaviorChangeViolations": "array"
}
```

## 5. Acceptance Criteria

- **AC-001**: Given a layer-first project, When the pipeline completes successfully, Then the code
  root contains `<targetConvention>/<domain>/<layer>/...` directories and no top-level layer
  directories remain for relocated files.
- **AC-002**: Given any relocated file, When inspecting git history, Then `git log --follow` on the
  new path shows the full prior history (proving `git mv` was used).
- **AC-003**: Given the completed run, When running the `buildGate` command, Then it exits zero.
- **AC-004**: Given the completed run, When diffing against the pre-run state, Then every changed
  line is either a file relocation or an import-path edit; `diffIsPureRefactor` is `true` and
  `behaviorChangeViolations` is empty.
- **AC-005**: Given a file claimed by two domains in PHASE-2, When PHASE-3 reconciles, Then the file
  is assigned to `core`/`shared` (not duplicated) and appears once in the path map.
- **AC-006**: Given an intra-domain import edge, When PHASE-4 runs, Then it is fixed by that
  domain's mover; Given a cross-cutting edge, Then it is left untouched by movers and fixed by
  PHASE-5 (single-owner invariant).
- **AC-007**: Given a domain whose cluster cannot be named with a business term, When PHASE-1 runs,
  Then it is emitted with low `namingConfidence` and surfaced, not silently assigned a technical name.
- **AC-008**: Given the whole pipeline, When it runs, Then it executes inside a dedicated worktree
  and produces exactly one green commit; the merge is left to the user.
- **AC-009**: The system shall NOT introduce, remove, or rewrite any entity, value object,
  aggregate, domain event, or repository (no tactical-DDD edits).
- **AC-010**: Given the plugin is built, When `plugin-validator` runs, Then it reports a valid
  plugin structure; And the marketplace + root CLAUDE.md are updated per REQ-003/REQ-004.

## 6. Test Automation Strategy

- **Test Levels**: (1) Plugin structural validation via `plugin-validator` agent; (2) Skill review
  via `skill-reviewer` agent; (3) End-to-end dry run against a fixture copy of `caos/engine`.
- **Frameworks**: None at the JS level (Workflow is interpreted by the Workflow tool). Validation is
  agent-driven plus manual diff inspection.
- **Test Data Management**: Use a throwaway worktree/branch over a copy of a reference project; never
  mutate the original repos.
- **CI/CD Integration**: Not applicable — manual, worktree-isolated runs.
- **Coverage Requirements**: All six phases must execute and the build gate must pass on at least one
  real reference project before the plugin is considered shippable.
- **Behavior-equivalence check**: The pure-refactor contract (AC-004) is the substitute for runtime
  tests — a passing build gate plus an import-only diff proves behavior is unchanged.

## 7. Rationale & Context

- **Why a directed `layer-first → feature-first` transform, not abstract "grouping"**: the two
  reference projects pin the exact before/after shape, which fixes scope and lets every agent reason
  about a concrete target instead of an open-ended one.
- **Why PHASE-0 (Contract) exists**: what varies between projects is the layer taxonomy, the target
  convention, and — most importantly — the **import strategy**. With path aliases, moving files
  barely breaks imports; with relative imports, every move breaks. This single variable dominates
  PHASE-5's cost and must be captured up front.
- **Why a Reconcile phase between Group and Move**: the real failure mode is misclassification —
  files shared by two domains, orphans, collisions. Resolving them at the planning boundary is cheap;
  resolving them inside parallel movers is a race. This phase also performs strategic-DDD subdomain
  classification, which is precisely what gives the `core`/`shared` bucket its meaning.
- **Why movers are not purely mechanical**: intra-domain edges (both endpoints inside one
  `modules/<domain>/`) are owned entirely by one mover with local knowledge and no race risk; many
  survive unchanged when layer substructure is preserved. Only cross-cutting edges need the global
  view, so the consolidator is reserved for exactly those — the **single-owner invariant**.
- **Why a single green commit**: the project cannot compile between move start and consolidation
  success, so per-domain commits cannot be bisectable. The atomic unit that compiles is "all moves +
  all import fixes".
- **Why strategic DDD only**: tactical DDD rewrites file contents and would break the zero-behavior
  guarantee. The plugin uses DDD's strategic half (bounded contexts, ubiquitous language, subdomain
  distillation) purely as a placement heuristic.
- **Why a worktree**: consistent with `typescript-migration` and `testing` — massive structural
  moves need isolation; the merge diff is the review surface.

## 8. Dependencies & External Integrations

### Technology Platform Dependencies

- **PLT-001**: Claude Code Workflow tool (`ultracode` dynamic orchestration) — runs `workflow.js`.
- **PLT-002**: `EnterWorktree` / `ExitWorktree` tools — worktree lifecycle.
- **PLT-003**: Git ≥ 2.x — `git mv`, `git log --follow`, `git diff`.

### Tooling Dependencies

- **DEP-001**: `plugin-dev` plugin — `plugin-validator`, `skill-reviewer`, and the
  `/plugin-dev:*` authoring skills (mandatory per `.claude/rules/plugins/use-plugin-dev.md`).
- **DEP-002**: `dotclaudefiles` plugin — `workflow-creator` (authors the Workflow) and
  `claude-code-agent-creator` (authors each sub-agent).
- **DEP-003**: The target project's own build/test toolchain, invoked via the `buildGate` command
  detected in PHASE-0 (no fixed version constraint).

### Compliance Dependencies

- **COM-001**: Plugin lifecycle rules — `.claude/rules/plugins/version-management.md` (version bump,
  marketplace registration, CLAUDE.md documentation) MUST be satisfied before committing.

## 9. Examples & Edge Cases

### Target transform (caos/engine → feature-first)

```text
BEFORE (layer-first)                  AFTER (feature-first, screaming)
controllers/controller.user.ts        src/modules/user/controllers/controller.user.ts
services/service.credits.ts           src/modules/credits/services/service.credits.ts
models/model.credit-ledger.ts         src/modules/credits/models/model.credit-ledger.ts
models/model.credit-wallet.ts         src/modules/credits/models/model.credit-wallet.ts
services/service.mining.ts            src/modules/mining/services/service.mining.ts
models/model.pool.request.ts          src/modules/mining/models/model.pool.request.ts
models/model.generalconfig.ts         src/modules/core/models/model.generalconfig.ts   (generic subdomain)
helpers/paymentStrategies.ts          src/modules/core/utils/payment-strategies.ts      (shared)
```

### Edge cases

- **Path-alias project**: `importStrategy = alias`, `aliasRoot = @/`. Moving
  `services/service.credits.ts` to `modules/credits/services/` changes its alias from
  `@/services/service.credits` to `@/modules/credits/services/service.credits`; PHASE-5 rewrites all
  references. Relative sibling imports within the same destination layer are unaffected.
- **Shared file claimed by two domains**: `models/model.payment.ts` referenced by both `credits` and
  `mining` → PHASE-3 assigns it to `core`, both consumers' edges become cross-cutting (owned by PHASE-5).
- **Barrel file**: `models/index.ts` re-exporting moved models → PHASE-5 rewrites or relocates it.
- **Non-code path reference**: `tsconfig.json` `paths` or `vitest.config.ts` alias pointing at an old
  directory → captured in `nonCodePathRefs` (PHASE-0), fixed in PHASE-5.
- **Dynamic import / string require**: build may pass but runtime breaks; PHASE-5 MUST grep for
  string-literal path references, not only static imports.
- **Orphan file**: a utility belonging to no domain → flagged in `orphans`; assigned to `core` by
  default, surfaced in the handoff.
- **Already feature-first project**: PHASE-0 reports `currentAxis = feature-first`; the skill informs
  the user and stops (nothing to restructure), analogous to `typescript-migration` detecting an
  existing `tsconfig.json` (SKILL.md:33-34).

## 10. Validation Criteria

1. `plugin-validator` reports a structurally valid `domain-restructure` plugin.
2. `marketplace.json` and root `CLAUDE.md` include the new plugin (REQ-003/REQ-004).
3. A dry run over a copy of `caos/engine` produces `modules/<domain>/<layer>` directories,
   `buildPasses = true`, `diffIsPureRefactor = true`, empty `behaviorChangeViolations`.
4. `git log --follow` confirms history preservation for relocated files.
5. Exactly one commit results; no automatic merge occurs.
6. No tactical-DDD edits appear in the diff.

## 11. Related Specifications / Further Reading

- `plugins/typescript-migration/skills/typescript-migration/workflow.js` — Workflow structure model.
- `plugins/typescript-migration/skills/typescript-migration/SKILL.md` — worktree orchestration model.
- `plugins/typescript-migration/.claude-plugin/plugin.json` — manifest model.
- `.claude/rules/plugins/version-management.md` — plugin lifecycle rules.
- `.claude/rules/plugins/use-plugin-dev.md` — mandatory plugin-dev usage and post-change validation.
- `code-craftsmanship:domain-driven-design` skill — strategic DDD (bounded contexts, ubiquitous
  language, subdomain distillation) that grounds the placement heuristics.
