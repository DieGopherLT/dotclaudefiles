---
name: claude-five-prompting-guide
description: Guidelines for prompting and building context for Claude 5 generation models (Sonnet 5, Opus 5, Fable 5), based on Anthropic's official guidance from July 2026. Use this skill whenever the user asks how to prompt Claude 5 models, wants to write or review a system prompt, CLAUDE.md, skill, or agent harness targeting these models, mentions "unhobbling", "unknowns", "blind spot pass", "context engineering", or asks why an agentic task came back wrong despite detailed instructions. Also use it when auditing existing prompts or rules for over-constraint, or when migrating prompts written for Claude 4-era models. When invoked with file path arguments, audit those files against the guide (prefer delegating the audit to a read-only sub-agent and returning only findings).
---

# Claude 5 Prompting Guide

Prompting Claude 5 generation models (Sonnet 5, Opus 5, Fable 5) inverts two habits
from earlier generations:

1. **The bottleneck moved.** Work quality is no longer capped by model capability but
   by the user's ability to surface *unknowns* — the gap between the map (prompts,
   skills, context) and the territory (the codebase, the real world). Prompting is now
   an iterative discovery process, not a specification exercise.
2. **Constraints became liabilities.** Anthropic removed over 80% of Claude Code's
   system prompt for these models with no measurable loss on coding evals. Rigid rules
   that once prevented worst cases now create conflicting instructions and crowd out
   the model's judgement.

Everything in this skill derives from two primary sources by Thariq Shihipar
(Anthropic, July 2026). When in doubt, they are authoritative over any paraphrase here:

- Field guide: https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns
- Context engineering: https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models

## Core principles (always apply)

**Prefer judgement over rules.** State the goal and let the model read the room.
Replace "never do X, always do Y" with a principle that generalizes:
`Write code that reads like the surrounding code: match its comment density, naming,
and idiom.` Reserve hard rules for genuinely non-negotiable areas (security,
compliance, destructive operations).

**Design interfaces, not examples.** Few-shot examples constrain the exploration
space of Claude 5 models. Instead, make the interface itself expressive: an enum of
`pending | in_progress | completed` plus "keep exactly one item in_progress" teaches
tool usage better than three worked examples.

**Disclose progressively.** Load the right context at the right time instead of
front-loading everything. Split long guidance into a tree of files; reference them
from a lightweight entry point. A CLAUDE.md should briefly say what the repo is for
and spend its tokens on gotchas — never on things Claude can learn by reading the
filesystem.

**Say it once.** Repetition and end-of-context emphasis were workarounds for older
models. Put tool instructions in tool descriptions, not duplicated in the system
prompt. Every duplicate is a future source of conflicting instructions.

**Prefer rich references over prose specs.** Source code is the highest-fidelity
reference — point Claude at a folder that implements the desired behavior, even in
another language. HTML mockups beat design descriptions and screenshots. Test suites
and rubrics beat requirement lists.

**Balance specificity.** Too specific and Claude follows instructions off a cliff
when a pivot was appropriate; too vague and it fills gaps with industry defaults that
may not fit. The escape hatch from this dilemma is surfacing unknowns early (see
below), plus always giving Claude your starting point: where you are in your
thinking, and your experience with the problem and codebase.

## Workflow selection

Match the situation to the right reference file. Read only what applies:

| Situation | Read |
|---|---|
| Starting substantial work; task in unfamiliar territory; a long-horizon task came back wrong | `references/unknowns-framework.md` |
| Writing or reviewing a system prompt, CLAUDE.md, skill, or rules file | `references/context-engineering.md` |
| Auditing or migrating prompts written for Claude 4-era models | `references/anti-patterns.md` |

For quick questions answerable from the core principles above, answer directly
without loading references.

## Invocation with arguments: audit mode

This skill may be invoked with one or more file paths as arguments (e.g.
`/claude-five-prompting-guide ~/.claude/CLAUDE.md`). An argument switches the skill
into **audit mode**: review the given file(s) against this guide and report
findings. Without arguments, operate in consultative mode as described above.

Audit mode is self-contained — it needs only the target file(s) and this skill's
references, not the session's conversation context. Because of that, prefer
delegating it to a read-only sub-agent so the reference material and the target file
never enter the main context; only the findings report comes back. Run it in the
foreground when the audit result is the immediate next input (the user is waiting to
act on it); use background only if other work continues meanwhile. If no sub-agent
mechanism is available, run the audit inline.

The sub-agent prompt should instruct it to:

1. Read `references/anti-patterns.md` and `references/context-engineering.md` from
   this skill's directory (add `references/unknowns-framework.md` only if the target
   is a prompt/spec for a concrete task rather than standing context).
2. Read the target file(s).
3. Apply the audit procedure at the end of `anti-patterns.md`.
4. Return only a findings report: per finding, the anti-pattern name, the offending
   lines (quoted or line-referenced), the suggested rewrite, and an estimated line
   delta. End with a summary table: findings count per anti-pattern and total
   estimated reduction.

Report the findings to the user verbatim; do not re-read the reference files in the
main context to double-check — trust the delegated audit, and offer to apply the
rewrites as a follow-up.

## The unknowns loop in one paragraph

Classify what you know using the four quadrants (known knowns, known unknowns,
unknown knowns, unknown unknowns). Before implementation: run a blind spot pass for
unknown unknowns, brainstorm and prototype to surface unknown knowns, have Claude
interview you one question at a time prioritizing architecture-changing answers,
provide source-code references, and review an implementation plan that leads with the
decisions most likely to change. During implementation: keep an
`implementation-notes.md` logging deviations — on unexpected edge cases, pick the
conservative option, log it, keep going. After: build a pitch/explainer artifact and
take a quiz on the changes before merging. Full patterns with canonical example
prompts live in `references/unknowns-framework.md`.

## Verification

When producing or reviewing a prompt/CLAUDE.md/skill with this guide, check:

- Could any rule be restated as a principle plus trust in judgement? If a rule fires
  incorrectly in an imaginable common case, it is over-constrained.
- Does any instruction appear in more than one place? Deduplicate to the most
  specific location.
- Is anything stated that the model could infer from the filesystem, the surrounding
  code, or its own knowledge? Delete it.
- Is rarely-needed content behind progressive disclosure (separate file, skill, or
  deferred tool) instead of always-loaded?
- In Claude Code, `/doctor` automates this rightsizing — recommend it to the user.
