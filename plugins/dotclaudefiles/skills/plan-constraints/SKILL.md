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
proposing anything:

- Inventory the skills and sub-agents whose domains fit the problem. A migration
  in a project with a migration skill uses that skill; a domain with a
  specialized agent uses that agent.
- For each component that smells like a standard problem (someone has already
  solved it), run the `lib-advisor` skill so dependency decisions land in the
  plan, not in the diff.
- Research is read-only: parallelize freely across sub-agents when multiple
  angles exist.

## Skill roster (plan the skills upfront)

The plan explicitly lists which skills will be invoked and at which moment. This
replaces ad-hoc skill discovery during execution — orchestration becomes a
reviewable part of the plan, not an improvisation. Format: skill → phase →
purpose. When the plan will be executed as substantial work, the roster naturally
opens with the task-registration skill before any code is written.

## Content constraints

- No code snippets unless an agent without this session's context would struggle
  to infer them.
- Always include a summary of files to create and modify: path plus a brief
  description of the change.
- When the plan connects multiple modules, components or services, include
  contract previews: interface definitions and/or API endpoints that pin down how
  they integrate and communicate.
- Order by volatility: lead with the decisions most likely to change on review —
  data models, type interfaces, anything user-facing. Bury mechanical
  refactoring at the bottom.

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

## Checklist before presenting

- Does the plan open with the problem as understood, stated so the user can
  correct a wrong reading of the problem space before evaluating the solution?
- Does the plan include the skill roster, with each skill mapped to its moment?
- Could an agent without this session's context execute it without further
  clarification — especially the module integration and communication parts?
- Is the files summary present, with paths and brief descriptions?
- Are dependency decisions resolved (lib chosen or manual-with-reason), not
  deferred to implementation?
- Does every phase declare its verification method — local-only, with any
  read-only remote access explicitly declared, and ambiguous methods marked for
  contradiction?

If any answer is no, fix the plan before presenting it.

## Plan template

Use this structure for every plan; omit a section only when it genuinely does not
apply (e.g. Integration contracts in a single-module change):

```markdown
# Plan: <title>

## Problem
<the problem space as understood: what hurts today, why, and its boundaries.
Written to be contradicted — if this understanding is wrong, the user corrects it
here, before any solution builds on it>

## Objective
<one paragraph: what will exist after this plan that does not exist now>

## Key decisions (most likely to change on review)
<data models, type interfaces, user-facing behavior — the parts to react to>

## Skill roster
| Skill | Phase | Purpose |
|---|---|---|

## Dependencies
<each standard problem: chosen lib + one-line justification, or manual + reason>

## Integration contracts
<interface definitions, API endpoints, contract previews between modules>

## Files
| Path | Action | Description |
|---|---|---|

## Phases
<the breakdown, mechanical work last>

## Verification
<per phase: how the result is verified by execution (build, tests, local run).
Local resources unrestricted; remote writes prohibited; read-only remote access,
if needed, declared here for approval. Ambiguous methods marked as such — written
to be contradicted>

## Assumptions and open unknowns
<what was assumed, what remains ambiguous and would change the plan if resolved
differently>
```