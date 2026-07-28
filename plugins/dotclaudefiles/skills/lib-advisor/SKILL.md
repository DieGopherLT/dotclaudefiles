---
name: lib-advisor
description: >-
  Search, evaluate and select libraries when a problem is "standard" — meaning
  someone has almost certainly solved it already. The strongest trigger is
  mid-planning of a new feature — while drafting or reviewing an implementation
  plan (plan mode, task-planning), run the standard-problem test on each planned
  component before the plan commits to a manual implementation. Also use this
  skill whenever the user is about to implement non-trivial functionality that
  sounds like a solved problem (programmatic SSH, retry/backoff, argument
  parsing, schema validation, date handling, HTTP routing, queues, templating),
  asks "should I implement X myself or use a lib?", "is there a library for X?",
  asks to compare libraries, or starts writing infrastructure-flavored code from
  scratch. Also use it when evaluating whether an existing dependency should be
  replaced, or when designing a public API and the prose-quality taxonomy
  (Facade / Fluent Interface / Internal DSL) applies.
---

# Lib Advisor

Diego's dependency philosophy: pragmatic. Instead of rewriting the wheel, find a
dependency that already solves the problem — especially one that trivializes a
recurring problem or whose API reads like well-written prose, cutting the cognitive
load of the calling code. Small, focused dependencies over frameworks (a framework
only if the project adopts one from the start). Manual implementations only when
full control is a requirement, or the problem is too specific for any dependency.

## During planning (primary trigger)

When drafting an implementation plan for a new feature, run the standard-problem
test over each planned component **before the plan commits to building anything
manually**. For every component that passes the test, resolve the dependency
decision inside the plan itself:

- Run steps 2-3 (candidates and evaluation) as part of plan research — read-only
  work, safe to parallelize with other plan investigation.
- The plan lists each chosen dependency with a one-line justification and the
  mechanism that makes its API read well (Facade / Fluent Interface / Internal
  DSL), alongside the plan's contract previews.
- Components that fail the test are marked manual, with the reason (full control
  required, or too domain-specific).

A plan that reaches the user with "implement an SSH client" as a task, instead of
"use `golang.org/x/crypto/ssh`", missed this skill's job. Deciding dependencies at
planning time costs a search; deciding them after implementation costs a rewrite.

## Step 1 — The standard-problem test

Before implementing, ask: **has someone already solved this?** Signals that the
answer is yes:

- The functionality is infrastructure, not domain logic (SSH clients, retries,
  parsers, validators, schedulers, routers).
- Describing the problem takes one generic sentence with no mention of the
  project's domain.
- A wrong implementation has well-known failure modes (timezones, TLS, escaping,
  concurrency) that specialists have already debugged for years.

If the problem passes the test, proceed. If it is domain-specific or requires full
control, implement manually and say why.

## Step 2 — Find candidates

- Check the language's standard library and official extended packages first — in
  Go especially (`golang.org/x/...` counts as near-stdlib; e.g. `x/crypto/ssh` for
  programmatic SSH).
- Search for 2-4 third-party candidates. Prefer sources close to the ecosystem
  (pkg.go.dev, npm, awesome-lists) over generic blog rankings.

## Step 3 — Evaluate

Score each candidate on four axes, in this order of importance:

1. **Maintenance.** Discard anything unmaintained: no commits or releases in a long
   stretch, unresolved issue pileup, archived repos. This criterion is
   eliminatory.
2. **API prose quality.** Read example call sites and classify the mechanism that
   produces (or fails to produce) prose-like reading:
   - **Facade**: hides a complex subsystem behind two or three orchestrating
     functions (GoF sense). Examples: react-hook-form over form state/validation,
     zustand over global state.
   - **Fluent Interface**: methods return `this` (or an equivalent object),
     enabling chained calls that read as a sentence. Example: chi's routing groups.
   - **Internal DSL**: the API as a whole feels like a mini-language embedded in
     the host language.
   The best libraries combine two or three mechanisms. The reference bar:
   react-hook-form, zustand, samber/lo, chi.
3. **Scope fit.** Small and focused on the problem beats broad and framework-like.
   A dependency that drags a large transitive tree for one function is a bad
   trade.
4. **Fit with the project.** License, language version constraints, and whether it
   plays well with dependencies already present.

## Step 4 — Recommend and confirm

Present the recommendation with a short comparison of the candidates evaluated —
what each does well, why the winner wins, and what the manual-implementation route
would cost instead. **Confirm with the user before installing.**

After confirmation, query the library's docs via the `context7-cli` skill (`ctx7`
is installed; do not use `npx`) before writing integration code, and install with
the project's package manager.

## Anti-patterns

- Recommending by popularity alone — stars measure adoption, not API quality or
  maintenance.
- Wrapping a trivial stdlib call in a dependency (left-pad syndrome).
- Adopting a framework mid-project because one candidate happens to be one.
- Skipping the user confirmation, or installing before checking docs via ctx7.