---
paths:
  - "**/*.go"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.sh"
  - "**/*.py"
---

# Coding Style

- Legibility over everything else — even at the cost of extra lines or abstraction
  layers. The bar: how fluidly it reads. "The code you write should read like
  well-written prose" (Uncle Bob).
- Facades at flow entry points: the code that consumes a service or kicks off a
  flow (what refactoring.guru diagrams label "client code") hides complexity behind
  a Facade, so reading the main flow carries minimal cognitive load.
- Immutability is the default. The only exceptions come from the language's
  idiomatic style (Go pointer receivers, `append` on slices) — never from
  convenience. It keeps data flow traceable and debuggable.
- Combine OOP and FP pragmatically: OOP holds structure and state — complex domains
  as objects, where design patterns live. FP handles data transformation — when a
  loop is a transformation, express it as map/filter/reduce or a pipeline. Extract
  pure helpers when the logic recurs; one-off transformations stay inline (YAGNI).
- Screaming architecture whenever possible: the directory structure announces the
  domain, easier to fit into the mind of humans and agents.
- File names: kebab-case unless the language convention dictates otherwise (see the
  per-language rules).
- When designing a public API, aim for call sites that read like prose; classify
  the mechanism used — Facade, Fluent Interface, or Internal DSL (the `lib-advisor`
  skill defines the taxonomy).

## Considering libraries

Before implementing non-trivial functionality, ask: is this a standard problem —
has someone already solved it? Programmatic SSH, retry/backoff, argument parsing,
schema validation: almost certainly yes, and a well-chosen dependency beats
rewriting the wheel. When the answer looks like yes, invoke the `lib-advisor` skill
to search, evaluate and select one. Manual implementations are reserved for when
full control is a requirement or the problem is too specific for any dependency to
solve.