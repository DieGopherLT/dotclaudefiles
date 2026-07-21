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

## task-lifecycle

The lifecycle of a substantial task, split into three skills that chain into each other and each stand alone. The split exists because the three phases have different natures and only the first used to be reachable on its own — in particular, the quality gate is now runnable against any branch without going through planning:

- **Skills**: `task-planning` (git state with the branch trigger keyed to protected branches, worktree decided by countable checks — a bundled `detect-concurrent-claudes.sh` yes/no script, >=3 letter groups, >7 files — letter-group breakdown with group codes as mandatory title tokens, an `A0` task recording the base ref, `TaskCreate` registration; hands off to `task-execution`), `task-execution` (LSP-first navigation, a per-subtask dispatch rubric — the discard test plus the prompt test decide mechanically between main context / full delegation / partial delegation / fan-out `Workflow`, with delegated tasks claimed via `TaskUpdate` `owner` — commits at group boundaries, immediate `TaskUpdate`, countable friction stops — same command failing 3 times or unplanned subtasks outnumbering a group's registered ones ends the turn; hands off to `task-quality-gate`), `task-quality-gate` (generates the patch once via `prepare-patch.sh` — merge-base-resolved so an advanced base cannot pollute it, base ref read from planning's `A0` task with a standalone fallback — derives an effort band from a base-band table plus ±1 modifiers, passes external domain auditors as `extraAuditors` into the review `Workflow`, arbitrates in-scope vs pre-existing findings, reports via `ReportFindings` with a deterministic class/verdict severity order, and dispatches fixes)
- **Agents** (12, all read-only; `sonnet` for the mechanical angles, `opus` for the five `effort: high` roles — removed-behavior-auditor, cross-file-tracer, altitude-auditor, gap-sweeper, finding-verifier): five correctness angles — `diff-line-scanner` (changed lines against a failure catalog), `removed-behavior-auditor` (names the invariant each deletion enforced and proves where it is re-established), `cross-file-tracer` (contract changes traced outward to consumers), `language-pitfall-auditor` and `wrapper-contract-auditor` (deeper bands only); five quality angles — `reuse-auditor`, `simplification-auditor`, `efficiency-auditor`, `altitude-auditor`, `conventions-auditor`; plus `gap-sweeper` (receives the deduplicated set to know what NOT to report) and `finding-verifier` (adversarial refutation, one per candidate)
- **Workflow**: `skills/task-quality-gate/scripts/workflow.js` — a `BANDS` table is the only source of variation between effort levels (which correctness angles run, precision vs recall bias, the confidence cut injected into every agent, whether the sweep runs, the report cap, and the per-call agent-effort override that is the only thing separating `max` from `xhigh`). Angles pipeline straight into verification with no barrier; the one barrier is before the sweep, which genuinely needs the complete deduplicated list. Findings rank correctness-class first at the cap cut, real-but-pre-existing defects return in a separate `preExisting` channel (verdict `PRE_EXISTING`) that feeds the skill's out-of-scope dispatch, and the verifier's reasoning rides on every survivor. The script returns data and writes nothing
- **Why the cut is injected, not fixed**: the agents carry the 0-100 confidence rubric verbatim, but the threshold comes from the band — a recall-biased sweep is only worth running if uncertain findings actually surface, and the adversarial verifier is what protects precision instead

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
/plugin install task-lifecycle@diegopher
```
