---
paths:
  - "plugins/**"
  - ".claude-plugin/**"
---

# Plugin Catalog

What each plugin in this repository actually ships. Read this before adding a capability — the most common mistake is building something a sibling plugin already does.

## dotclaudefiles

Skills plugin for team setup and Claude Code authoring:

- **Skills**: `team-setup`, `claude-code-agent-creator` (scaffolds sub-agent markdown files with least-privilege tools, archetype selection, and model+effort calibration), `workflow-creator` (authors and audits dynamic Workflow-tool scripts with emphasis on per-role thinking load: pipeline vs parallel, schema, quality patterns, budget scaling, plus an audit checklist with severity rubric), `create-report` (produces Markdown for context preservation or interactive HTML for comprehension/sharing; self-contained, navigable, zero external deps)

## dotclaudehooks

Standalone hooks plugin for LSP-first navigation enforcement:

- **Hooks**:
  - `lsp-nudge` (PreToolUse on `Grep|Glob|Bash`) — nudges symbol-shaped searches toward the LSP tool: blocks until it's loaded via `ToolSearch`, warns once when loaded-but-unused, goes silent for the rest of the session after that warning or once used; only fires when a matching LSP plugin is actually enabled (global/project/local `settings.json`) for a language present in the project; every terminal outcome is session-cached so the underlying checks run at most once

## document-api

Skills for documenting API contracts for frontend handoff:

- **Skills**: `document-endpoints` (structured markdown contracts from REST routes), `document-sockets` (socket.io event contracts from handlers)

## react-dev

Helpers for React development:

- **Commands**: `/refactor-conditional-jsx` (clsx + conditional rendering cleanup)
- **Skills**: `split-component` (split large components into manageable pieces)

## claude-management

Skills, hooks, and agents for managing Claude Code memory files — a self-improvement harness where deterministic hooks detect the moment and suggest the right skill, and a quality gate verifies knowledge before it becomes permanent:

- **Skills**: `rulify` (split heavy CLAUDE.md into on-demand `.claude/rules/` files), `claudify` (generate token-efficient module-level CLAUDE.md documentation; runs as a forked background task via the `module-documenter` agent — the main session only receives a one-line summary), `remember` (classify and route a piece of information to the correct memory destination), `end-session` (manual-only session closing: commits + context doc), `stabilize` (mine harvested session transcripts for recurring flows/conventions, verify them, materialize survivors as project skills or rules)
- **Agents**: `transcript-digester` (read-only distiller: one per transcript, reduces a JSONL session to flows + conventions via jq projections), `practice-verifier` (read-only quality gate: verifies transferable practices against official docs/ctx7 and internal conventions against the codebase; confirmed/adjusted/refuted with confidence >= 80 to materialize), `module-documenter` (autonomous documenter running claudify's forked context: explores the module itself, writes only the memory file, returns one line)
- **Hooks** (suggestion-only, never block or commit): `claudemd-size` (PostToolUse: CLAUDE.md over 200 lines → suggest rulify), `failure-scan` (Stop: repeated same-family Bash/MCP failures in the transcript → suggest remember), `contextualizable-dirs` (Stop: substantial work in an undocumented module directory → suggest claudify), `session-harvest` (Stop: queue substantial sessions per repo — gated by deduped assistant output tokens AND tool-use count, not session length alone; at threshold → notify the user via systemMessage that the stabilize queue is ready), `session-marker` (SessionStart: timestamp for session-scoped scans)
- **Config**: optional per-project `.claude/claude-management.local.json` — keys: `claudemd_ceiling`, `failure_min_repeats`, `contextualizable.always_exclude`/`.always_include`/`.min_source_files`/`.min_touched_files`/`.source_extensions`/`.iac_extensions`, `harvest.queue_threshold`/`.min_transcript_bytes`/`.min_output_tokens`/`.min_tool_uses`; harvest queue state in `~/.claude/claude-management/harvest/`

## testing

Retrofit testing pipeline that puts existing code under tests autonomously (NOT test-first TDD):

- **Agents**: `testability-auditor` (testability 1-10 + confidence), `testing-deps-investigator`, `testing-code-adapter` (Feathers seams), `testing-scaffolder` (shared test utilities, DRY cross-file), `test-implementer` (characterization + behavior tests + build gate), `test-input-auditor` (test-quality via mutation-thinking + type-validity), `testing-rules-writer` (document phase: writes a path-scoped `.claude/rules/testing.md` from the actual run data, no placeholders)
- **Skill**: `retrofit-testing` (thin orchestrator: enters a dedicated worktree, runs a deterministic end-to-end Workflow over the 7 agents, hands back for merge)
- **References**: coverage strategies, test anti-patterns, frontend component-testing patterns (React seam model + RTL), project rules template (bundled inside the skill)
- **Frontend mode**: when targets are React components/hooks (`.tsx`/`.jsx`), the agents switch to a frontend seam model (vi.mock/props/providers/MSW) and React Testing Library assertions instead of backend constructor DI

## git-toolkit

Git workflow enforcement for commit standards, branch naming, conflict resolution, and squash planning:

- **Skills**: `commit` (staged deliberately, formatted, message crafted with explicit approval before execution), `branching` (naming convention enforcement before any `git checkout -b`), `conflict-resolver` (resolves rebase and merge conflicts via parallel branch history analysis — agnostic to operation type), `squash-suggester` (analyzes branch commit history and produces a squash plan markdown file — pick/squash/fixup per commit — preserving atomicity and bisectability)
- **Agents**: `git-history-retriever` (read-only historian: analyzes commits for a single branch within a bounded range `merge-base..branch-tip`, infers intent per conflicting file; one instance per branch, all launched in parallel by conflict-resolver), `squash-planner` (read-only analyst: groups commits by semantic intent and assigns squash actions maintaining git bisect safety; invoked by squash-suggester)

## typescript-migration

Autonomous pipeline that migrates an existing JavaScript project to TypeScript. Runs inside a dedicated worktree:

- **Agents**: `migration-auditor` (detects project type, maps dep graph leaf-first, plans chunks, selects fixture), `migration-setup` (installs tooling, applies tsconfig fixture, git mv all JS files, base compile gate), `shared-types-extractor` (extracts cross-chunk interfaces to `src/types/` before parallel typing), `typer` (types a single chunk in isolation, scoped compile gate), `migration-consolidator` (fixes cross-chunk errors, enables strict progressively, final build gate)
- **Skill**: `typescript-migration` (orchestrator: enters a dedicated worktree, runs the 5-phase Workflow, hands back for merge)
- **Fixtures**: tsconfig templates for `react-vite`, `nextjs`, `node`, and `generic` projects — auditor selects the right one automatically

## domain-restructure

Autonomous structural refactor that reshapes a codebase from layer-first (top-level `controllers/`, `services/`, `models/`) into feature-first screaming architecture (`modules/<domain>/<layer>`). Pure relocation — zero functional change. Runs inside a dedicated worktree:

- **Agents**: `contract-auditor` (detects stack, layer taxonomy, current axis, target convention, import strategy, build gate), `domain-scanner` (identifies bounded contexts via ubiquitous language, flags low-confidence names), `domain-grouper` (buckets a domain's files by layer, one per domain), `reconciler` (classifies core/supporting/generic subdomains, resolves shared/orphan/collision, emits the path map + membership map), `domain-mover` (plain `mv` + intra-domain import fixes, one per domain, enforcing the single-owner invariant), `consolidator` (`git add -A` rename detection, fixes cross-cutting imports + barrels + config, build gate loop, asserts a pure-refactor diff)
- **Skill**: `domain-restructure` (orchestrator: enters a dedicated worktree, runs the 6-phase Workflow, hands back for merge in a single green commit)
- **Strategic DDD only**: discovers bounded contexts and classifies subdomains to decide where files belong; never touches tactical constructs (entities, aggregates, events) inside file contents

## spec-kit

Spec-driven workflow toolkit that carries a feature from raw idea to verified implementation over a single source of truth (the spec). Pairs with the `/goal` command:

- **Agent**: `closed-design-enforcer` (read-only design-gap auditor: detects missing/ambiguous/unverifiable design decisions, returns structured findings with a conceptual `closes_when`, never a concrete solution; spawned fresh each round, no closure authority)
- **Skills**: `create-specification` / `update-specification` (augmented copies: closed, self-contained specs ready for cold `/goal` execution, with a managed Design Gaps section), `close-design` (loop-until-dry orchestrator: sole writer of the Design Gaps section and stateful seen-set holder; spawns a fresh enforcer per round until zero net-new gaps, then runs a single human arbitration gate), `implement-spec` (Template Method + Strategy dispatcher: selects write-directly / agent-waves / workflow by two axes — context-budget scale and orchestration closure — then executes, quality-gates, and verifies)
- **Closure philosophy**: the design is closed (no unresolved gaps) before implementation; the dispatcher picks workflow only when coordination is decision-closed, baking the quality gate into the script

## refactoring-guru

Turns passive Clean Code reference into a reactive analysis of real code: given a file, directory, or symbol, it detects concrete smells from the refactoring.guru taxonomy, maps them to named techniques, and applies the chosen transformation step by step. Neither skill dispatches by scale anymore: `smell-scan` always fans out through a `Workflow` regardless of domain count (detection is read-only, so there is no worktree-isolation reason to special-case a single domain); `refactor` always enters a dedicated worktree (unless already inside one) and always runs the full 4-phase Workflow, since worktree isolation is useful independent of scale and the whole-project build gate protects a single-finding change exactly as it protects a multi-domain one:

- **Agents**: `smell-detector` (read-only Auditor, one per category, runs per domain inside the smell-scan Workflow's per-domain pipeline; confidence-scored located findings at >=80 with a `resolution_plan` per finding, never modifies files), `refactoring-applier` (Implementer: applies ONE named technique to ONE location following the playbook mechanics, preserves observable behavior, reports the verification; frozen, never touches git), `refactoring-reconciler` (Bash-capable: owns all git/build mechanics inside the refactor Workflow's Mark and Reconcile phases — ephemeral rollback commit, whole-project build gate, reset on failure — never edits code)
- **Skills**: `smell-scan` (always pipelines every domain — one or many — through a 5-`smell-detector` batch each via a `Workflow`, then assigns globally-unique reference codes B1/OO1/CP1/D1/C1 over the aggregated findings and persists one source-of-truth JSON file per domain under `.claude/refactoring-guru/findings/`), `refactor` (resolves a finding code, explicit technique+location, or a broader multi-domain request; always enters a dedicated worktree — skipped if already inside one — and always runs the full 4-phase Workflow: parallel intra-domain appliers, cross-cutting smells reconciled serially with a build gate, collapsed to one `refactor:` commit)
- **References**: `smell-catalog.md` (26 smells: detection criteria + mapped techniques), `refactoring-techniques.md` (67 techniques: when + mechanics), `technique-playbooks.md` (per-group execution steps), `workflow.md` (safe test → refactor → test → commit cycle)
- **Taxonomy**: 26 smells in 5 categories (Bloaters, OO Abusers, Change Preventers, Dispensables, Couplers); 67 techniques in 6 groups. OOP-specific smells and techniques are kept marked, not suppressed — they apply in C# and TypeScript class code

## task-harness

The harness for a substantial task that does not fit one context window. Execution always lives in the main context — no delegation of business logic to sub-agents — and the work is split into **sessions** separated by `/clear`, with the binnacle as the durable state between them. Code review is not automatic: the run ends `ready-for-review` and the user runs `/code-review` manually in a clean session:

- **Skills**: `task-planning` (receives an approved plan; always creates a dedicated worktree via the `branching` skill — if there is a binnacle there is a worktree, so the branch-vs-worktree decision is gone; decomposes into letter-group blocks grouped into sessions sized by a friction-point rubric (capped per session) — new file = zero friction, exported-signature change = friction proportional to call sites, nested dependencies = high friction, Session 1 sized smaller because it shares the window with planning; opens the binnacle with `plan_path` pointing at the approved plan; registers with `TaskCreate` only the current session's tasks, block code as first title token, final task always `invoke log-binnacle`; no `A0` task — the frozen `base_sha` lives in the binnacle frontmatter), `binnacle` (the durable layer: `.claude/binnacle.md` per worktree from a bundled template, ignored via `.git/info/exclude` — never the tracked `.gitignore`; an **immutable reverse-chronological changelog** — entries are never edited, deprecated, or summarized — with English frontmatter keys over Spanish body, a `read_until_line` cursor so a cold session restores state + session plan + latest entry with a single bounded `Read`, and `plan_path` so future sessions re-read the original plan instead of reconstructing it; execution conventions travel in the file itself: commit per block via the `commit` skill, immediate `TaskUpdate`, `log-binnacle` as every session's last task), `log-binnacle` (single operation, deterministically triggered by the explicit closing task: inserts the session entry directly under the `## Entradas` marker — expensive-to-reconstruct content first: closing state, decisions with full reasoning, deviations; cheap pointers last — advances checkbox/`current_session`/`status`/`last_updated`, and recalculates `read_until_line` as the line before the second entry header, or EOF when only one entry exists; sets `ready-for-review` when the last working session closes), `resume-from-binnacle` (`disable-model-invocation`: the user's manual shortcut for cold sessions — locates the worktree's binnacle, delegates to the `binnacle` skill's resume procedure without reimplementing it, and launches read-only Explore agents only when the latest entry points at code it does not explain — zero explorers by default)
- **Session plan invariant**: the plan always ends with `Sesión R — code review`, executed by the user, manually, in a clean session — never by the run

## Installing

Each plugin installs independently:

```bash
# Add marketplace (once)
/plugin marketplace add https://github.com/DieGopherLT/dotclaudefiles diegopher

# Install individual plugins
/plugin install dotclaudefiles@diegopher
/plugin install dotclaudehooks@diegopher
/plugin install claude-management@diegopher
/plugin install document-api@diegopher
/plugin install react-dev@diegopher
/plugin install testing@diegopher
/plugin install typescript-migration@diegopher
/plugin install git-toolkit@diegopher
/plugin install domain-restructure@diegopher
/plugin install spec-kit@diegopher
/plugin install refactoring-guru@diegopher
/plugin install task-harness@diegopher
```
