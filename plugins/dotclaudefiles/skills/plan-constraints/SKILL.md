---
name: plan-constraints
description: >-
  Constraints, structure and template for implementation plans. Invoke
  immediately upon entering plan mode, before drafting any plan — and also when
  reviewing an existing plan, re-planning mid-task after a scope change, or when
  the user asks for an implementation plan, spec, or breakdown in any form. The
  plan is not ready to present until it satisfies this skill's checklist.
---

# Plan Constraints

A plan is a handoff artifact: it must be executable by an agent without this
session's context. Every constraint below serves that bar.

## Research phase (before drafting)

Use all agentic resources available to diminish uncertainty and ambiguity before
proposing anything. Research is read-only, and every angle below is dispatched to
a sub-agent, in parallel within each step. The two agents are molds: the angle
goes in the brief, and their model and effort come from their definitions.

1. **Explore.** Launch `dotclaudefiles:plan-explorer`, one per aspect: `reuse`,
   `architecture`, `gotchas`, `verification`. Drop an aspect only when it cannot
   apply, and say so in the plan. Each explorer returns the key files for its
   aspect; read them yourself before moving on.
2. **Clarify.** Collect the ambiguities only the user can settle (the explorers'
   open questions plus yours) and ask them with `AskUserQuestion` before
   designing. Skip this step when there are none.
3. **Design.** Launch `dotclaudefiles:plan-architect`, one per lens: `minimal`,
   `balanced`, `ideal`, passing the objective and the explorers' findings. A
   change small enough that the three lenses would converge may skip this step;
   say so in the plan.
4. **Choose.** Compare the designs, form a recommendation with its reasoning, and
   let the user pick the approach. The chosen design drives the plan; the others
   are recorded in Alternatives considered.

Besides those two:

- Inventory the skills and sub-agents whose domains fit the problem. A migration
  in a project with a migration skill uses that skill; a domain with a
  specialized agent uses that agent.
- For each component that smells like a standard problem (someone has already
  solved it), run the `lib-advisor` skill so dependency decisions land in the
  plan, not in the diff.
- Write every brief with the `subagent-dispatch` skill when it is available, but
  skip its report-template step: these two agents define their own output format.
  A sub-agent executes or explores; it never decides. The decisions stay with you.

## Skill roster (plan the skills upfront)

The plan explicitly lists which skills will be invoked and at which moment. This
replaces ad-hoc skill discovery during execution — orchestration becomes a
reviewable part of the plan, not an improvisation. Format: skill → phase →
purpose. When the plan will be executed as substantial work, the roster naturally
opens with the `task-planning` skill before any code is written.

## Language guide

The reader must understand the plan fully on a first read, so write it at the
level of the Problem and Objective sections, not at the level of the diff.

- **Business first.** State each decision as the rule the business or the user
  gets, then the mechanism. Name things with the domain's words ("a customer
  cannot be charged twice") before the code's ("idempotency key on
  `invoice_id`"). Technical terms stay when they are the precise ones; they
  follow the rule, they do not replace it.
- **Propositional sentences.** Phrase decisions and rules so each one translates
  to a condition in code: "if X is Y, then Z", "if and only if", "unless",
  "for every", "never when". One condition per sentence, with an explicit
  outcome for the negative branch.
- **The user's language.** Write the whole plan, headings included, in the
  language the user speaks to you, not the one the codebase or this skill uses.
  Code identifiers, paths and commands stay verbatim.
- **Universal vocabulary only.** Use terms that appear in textbooks, standards
  or formal documentation (idempotency, invariant, race condition, design
  pattern names, backward compatibility). Replace Silicon Valley and forum
  slang ("footgun", "yak shaving", "bikeshedding", "load-bearing", "sad path")
  with its literal meaning. Define a coined term once where it first appears.

Example, same decision written both ways:

- Too technical: "Debounce the sync on `onChange` and no-op on stale revs."
- Target: "If the user edits a note, the sync starts 500 ms after the last
  keystroke. If the server holds a newer revision than the one being sent, the
  sync is discarded and the note is reloaded."

## Content constraints

- No code snippets unless an agent without this session's context would struggle
  to infer them. Integration contracts are the exception (next point).
- Always include a summary of files to create and modify: path plus a brief
  description of the change.
- When the plan connects multiple modules, components or services, include
  contract previews: the new abstractions (interfaces, types, endpoints) and
  also a connection preview, in pseudo-code if needed, showing how the existing
  code calls or implements them: who calls what, with which arguments, in what
  order, and what is done with the result and the errors. The bar: the
  executing agent never designs the wiring on the fly.
- Order by volatility: lead with the decisions most likely to change on review —
  data models, type interfaces, anything user-facing. Bury mechanical
  refactoring at the bottom.
- Include a Guards and gotchas section (see the template): everything the
  executor must watch for that the happy path hides.
- Each phase declares what it depends on, the files it touches and, when it is
  sequential, the reason. Two phases may run in parallel if and only if neither
  consumes the other's output and their file sets are disjoint; any phase that
  consumes another's output, or shares a file with it, runs after it. The plan
  gives the dispatch criteria; who executes each phase is decided later by the
  `task-planning` skill, never in the plan.
- Include a Branching section before the phases: branch name, worktree
  location, base ref and merge conditions. The merge conditions are the
  Verification results that must hold, referenced rather than restated.

## Verification

Every phase of the plan declares how its result will be verified. Full computer
use over the project and local resources is granted and encouraged: run the
build, execute tests, spin up local containers, exercise the code — verification
by execution beats verification by reading.

Resource policy for this phase:

- **Local resources**: unrestricted.
- **Infrastructure solutions** (Ansible, VPS provisioning, server configuration):
  verify against disposable local VMs. Diego's cloud-init setup for Ubuntu qcow2
  VMs lives in `~/vms` — spin one up, run the solution against it for real, tear
  it down. This is the middle ground between dry-runs (`--check`) and touching
  real hosts, and it counts as a local resource: unrestricted.
- **Remote resources**: write operations are prohibited, no exceptions. Read-only
  remote access may be justified case by case — if a verification needs it,
  declare it explicitly in the plan so the user approves it.
- If the right verification method is ambiguous in the current context, do not
  pick silently: state the candidate method and mark it as ambiguous — written to
  be contradicted, same as the Problem section.

## Advisor review

Before presenting the plan, if the `advisor` tool is available, call it once
with the draft plan in context and ask it to hunt for gaps you would only
discover mid-execution: missing edge cases, unstated assumptions, phases that
silently depend on an unverified decision, integration points glossed over.
The goal is to shrink gaps found during execution by finding them now, while
the plan is still cheap to change. Fold any gap the advisor surfaces into the
relevant section (Key decisions, Integration contracts, Guards and gotchas,
Assumptions and open unknowns) before moving to the checklist below. If `advisor`
is unavailable, skip this step — do not block the plan on it.

## Checklist before presenting

- Does the plan open with the problem as understood, stated so the user can
  correct a wrong reading of the problem space before evaluating the solution?
- Did the research dispatch the explorers and the architects (or state why a
  step was skipped), and does Alternatives considered record each design and the
  user's choice?
- Does the plan include the skill roster, with each skill mapped to its moment?
- Could an agent without this session's context execute it without further
  clarification — especially the module integration and communication parts?
- Do the integration contracts include a connection preview (caller, arguments,
  order, handling of result and errors), not only the new abstractions?
- Does a Guards and gotchas section list invalid states, undefined behavior and
  data formats, each with its expected handling?
- Are decisions written in business language, as propositional sentences that
  map to conditions in code, in the user's language?
- Does the Branching section give branch name, worktree location, base ref and
  merge conditions tied to the Verification section?
- Does every phase declare its dependencies, its files and, if sequential, why,
  so the `task-planning` skill can decide the dispatch without re-deriving it?
- Is the files summary present, with paths and brief descriptions?
- Are dependency decisions resolved (lib chosen or manual-with-reason), not
  deferred to implementation?
- Does every phase declare its verification method — local-only, with any
  read-only remote access explicitly declared, and ambiguous methods marked for
  contradiction?
- If `advisor` was available, was it consulted for gaps and were its findings
  folded into the plan?

If any answer is no, fix the plan before presenting it.

## Plan template

Read `references/plan-template.md` before drafting: it holds the structure every
plan follows and an example for the sections whose format must stay consistent.
