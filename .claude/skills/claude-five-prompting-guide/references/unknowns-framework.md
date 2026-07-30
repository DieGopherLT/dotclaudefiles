# The Unknowns Framework

Source: "A field guide to Claude Fable 5: Finding your unknowns" — Thariq Shihipar,
Anthropic, July 6, 2026.
https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns

## Map and territory

The map is everything given to Claude: prompts, skills, CLAUDE.md, context. The
territory is where the work happens: the codebase, the real world, its constraints.
The gap between them is the set of *unknowns*. Every time Claude hits an unknown, it
decides based on its best guess of intent. The more work delegated, the more unknowns
it encounters — so reducing and planning for unknowns is *the* skill of agentic
coding with Claude 5 models.

Planning ahead alone is not enough: unknowns surface deep in implementation, and
sometimes they reveal the problem should be solved differently altogether. The loop
runs before, during, and after implementation.

## The four quadrants

| Quadrant | Definition | Primary countermeasure |
|---|---|---|
| Known knowns | What the prompt already states | Keep stating it clearly |
| Known unknowns | Unresolved questions you are aware of | Interviews, implementation plans |
| Unknown knowns | So obvious you would never write it down, but you would recognize it on sight (taste, house conventions) | Brainstorms and prototypes — react instead of describe |
| Unknown unknowns | What you have not considered at all; not knowing how good something can be | Blind spot pass |

Always give Claude your starting point: where you are in your thought process, and
your experience with the problem and the codebase. This is what lets it collaborate
as a thought partner instead of guessing your level.

## Pre-implementation patterns

### 1. Blind spot pass

For unfamiliar codebases or domains, ask Claude to find your unknown unknowns and
explain them. Use the literal phrases "blind spot pass" and "unknown unknowns", and
include who you are and what you already know.

> "I'm working on adding a new auth provider but I know nothing about the auth
> modules in this codebase. Can you do a blind spot pass to help me figure out my
> relevant unknown unknowns and help me prompt you better."

> "I don't know what color grading is but I need to grade this video. Can you teach
> me to understand my unknown unknowns about color grading, so that I can prompt
> better?"

### 2. Brainstorms and prototypes

For unknown knowns — criteria you only recognize on sight — surface them early via
cheap prototypes, because discovering them mid-implementation is expensive: small
spec changes cause drastically different implementations, and reverting is harder
for the agent. Start almost every session with an exploration or brainstorming phase
to calibrate scope — neither too narrow nor too wide.

> "I want a dashboard for this data but I have no visual taste and don't know what's
> possible. Make me an HTML page with 4 wildly different design directions so I can
> react to them."

> "Before wiring anything up, make a single HTML file mocking the new editor toolbar
> with fake data. I want to react to the layout before you touch the real app."

> "Here's my rough problem: users churn after onboarding. Search the codebase and
> brainstorm 10 places we could intervene, from cheapest to most ambitious. I'll
> tell you which ones resonate."

### 3. Interviews

After brainstorming, convert remaining ambiguity into answered questions. Give
context about the problem to guide the questions.

> "Interview me one question at a time about anything ambiguous, prioritize
> questions where my answer would change the architecture."

### 4. References

When you cannot describe what you want, point at something that already embodies it.
Diagrams, docs and pictures work, but **source code is the best reference** — richer
in markup and structure than any screenshot, even across languages.

> "This Rust crate in vendor/rate-limiter implements the exact backoff behavior I
> want. Read it and reimplement the same semantics in our TypeScript API client."

### 5. Implementation plans

Before implementing, request a plan focused on the parts most likely to change —
data models, type interfaces, UX flows — so reviewable decisions surface first.

> "Write an implementation plan in HTML, but lead with the decisions I'm most likely
> to tweak: data model changes, new type interfaces, and anything user-facing. Bury
> the mechanical refactoring at the bottom, I trust you on that part."

After planning, start a fresh session and pass the artifacts (spec, prototype) into
the prompt: clean context window, full planning information.

## During implementation

### 6. Implementation notes

Unknown unknowns lurk no matter how much planning happened. Keep a running log of
deviations so the next attempt learns from this one.

> "Keep an implementation-notes.md file. If you hit an edge case that forces you to
> deviate from the plan, pick the conservative option, log it under 'Deviations',
> and keep going."

## Post-implementation

### 7. Pitches and explainers

Bundle prototype + spec + implementation notes into a single shareable document.
Reviewers start with the same unknowns the author did; showing that common failure
points were accounted for accelerates understanding and approvals.

> "Package the prototype, the spec, and the implementation notes into a single doc I
> can drop in Slack to get buy-in. Lead with the demo GIF."

### 8. Quizzes

After a long session, diffs alone give only shallow understanding because behavior
depends on existing code paths. Request a contextual report plus a quiz; only merge
after passing it perfectly.

> "I want to make sure I understand everything that's happened in this change. Give
> me a HTML report on the changes for me to read and understand with context,
> intuition, what was done, etc. and a quiz at the bottom on the changes that I must
> pass."

## Diagnostic rule

When a long-horizon task comes back wrong, the default diagnosis is not model
failure — it is an undefined unknown. Do not simply retry: go back and define the
unknown, or restructure the plan so you and Claude can adapt through it. Every
explainer, brainstorm, interview, prototype and reference is a cheap way to find out
what you did not know before it becomes expensive to fix.

For trivial tasks (typo-level fixes), skip the ceremony — the framework applies in
proportion to the unknowns at stake.
