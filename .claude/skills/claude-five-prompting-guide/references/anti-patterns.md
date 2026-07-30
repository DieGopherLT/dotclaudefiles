# Anti-Pattern Catalog: Auditing Claude 4-era Prompts

Use this when reviewing or migrating an existing system prompt, CLAUDE.md, rules
file, or skill written for earlier model generations. Each anti-pattern includes the
detection signal and the rewrite move. The overall migration story is less "port
your rules" and more "delete most of them" — but verify against your own evals, not
just Anthropic's coding evals, especially in domains that genuinely need hard rules
(finance, medicine, regulated deployments, destructive operations).

## 1. Categorical prohibitions doing judgement's job

**Signal:** NEVER / ALWAYS / DO NOT applied to matters of degree (comments,
documentation, file creation, verbosity, formatting).
**Why it fails now:** the rule fires in cases where the prohibited thing is exactly
right, and collides with user requests or other context sources, producing
conflicting instructions the model must spend reasoning to resolve.
**Rewrite:** state the underlying goal as a principle referencing surrounding
context ("match the codebase's comment density") and delete the prohibition.
**Keep as a hard rule only if:** an incorrect firing is catastrophic rather than
suboptimal.

## 2. Few-shot examples for capable behavior

**Signal:** Input/Output example blocks teaching things the model does correctly
without them; multiple worked examples per tool.
**Why it fails now:** examples anchor exploration to the demonstrated pattern,
narrowing the solution space.
**Rewrite:** delete the examples; encode the intent in the interface — parameter
names, enums, constraints, schema descriptions. Keep an example only when it encodes
a genuinely non-obvious house convention that no interface can express.

## 3. The central repository CLAUDE.md

**Signal:** one file accumulating every practice that might ever apply; hundreds of
lines; sections that only matter for specific file types or rare workflows.
**Why it fails now:** always-loaded content competes for attention with the rules
that matter for the current task; irrelevant instructions dilute relevant ones.
**Rewrite:** keep repo purpose + codebase gotchas in CLAUDE.md; move
trigger-scoped content into skills (invoked at the trigger moment) or path-scoped
rules (loaded when matching files are touched); reference them in one line each.

## 4. Duplicated instructions

**Signal:** the same convention stated in system prompt and tool description, or in
CLAUDE.md and a skill body, or in two rules files.
**Why it fails now:** duplication no longer improves adherence; it creates two
places to edit, which eventually disagree — manufacturing the conflicting-message
problem.
**Rewrite:** single source of truth at the most specific applicable location; tool
usage lives in the tool description.

## 5. Stating the obvious

**Signal:** instructions the model would follow anyway ("think step by step", "act
as a senior engineer"), descriptions of standard language idioms, or facts
recoverable by reading the filesystem.
**Why it fails now:** consumes instruction budget without changing behavior.
**Rewrite:** delete. The content of context files should be things the model cannot
infer: personal taste, anti-convention choices, environment gotchas, quantified
thresholds.

## 6. Prose specs where references exist

**Signal:** long natural-language descriptions of desired behavior, design, or
architecture when a test suite, existing implementation, or HTML mockup could serve
instead.
**Why it fails now:** prose is low-fidelity; Claude 5 models extract more signal
from code and structured artifacts.
**Rewrite:** point at the reference ("reimplement the semantics of
vendor/rate-limiter"), attach the mockup, or express the spec as tests/rubrics.

## 7. Manual memory accumulation

**Signal:** CLAUDE.md sections that are session residue — decisions, notes, and
reminders appended over time rather than curated standing agreements.
**Why it fails now:** auto-memory handles session-relevant persistence; residue in
CLAUDE.md is unscoped, unexpiring, always-loaded context.
**Rewrite:** let auto-memory hold transient knowledge; keep CLAUDE.md curated. If a
memory-like fact is evergreen and always relevant, promote it deliberately.

## Audit procedure

1. In Claude Code, run `/doctor` first — it automates most of this catalog.
2. For each remaining instruction ask, in order:
   - Would removing this cause a concrete mistake? If no → delete (anti-pattern 5).
   - Does it fire wrongly in an imaginable common case? If yes → rewrite as
     principle (anti-pattern 1) or keep-with-reason if compliance requires it.
   - Does it appear elsewhere? If yes → deduplicate (anti-pattern 4).
   - Does it have a trigger moment or path scope? If yes → move behind progressive
     disclosure (anti-pattern 3).
3. Re-run the user's own evals after the cut; "no measurable loss" must be verified
   per product, not assumed.
