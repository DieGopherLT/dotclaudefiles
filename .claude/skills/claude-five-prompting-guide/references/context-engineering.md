# Context Engineering for Claude 5 Models

Source: "The new rules of context engineering for Claude 5 generation models" —
Thariq Shihipar, Anthropic, July 24, 2026.
https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models

Context is everything assembled around the prompt: system prompt, Skills, CLAUDE.md
files, memory, tools, references. Unlike a prompt it is reused across many requests,
so it cannot be as specific — it must be built for prompts you have not seen yet.

## The headline result: unhobbling

Anthropic removed over 80% of Claude Code's system prompt for Opus 5 and Fable 5
with **no measurable loss on coding evaluations**. The removed constraints once
prevented worst-case behavior in older models; for Claude 5 models they produced
conflicting messages within single requests (e.g. "leave documentation as
appropriate" from one source colliding with "DO NOT add comments" from another),
forcing the model to burn reasoning on resolving contradictions. The fix: delete the
constraint and let surrounding context plus judgement decide.

## Six shifts (then → now)

### 1. Rules → Judgement

Old guardrail, deleted:

> In code: default to writing no comments. Never write multi-paragraph docstrings or
> multi-line comment blocks — one short line max.

Replacement:

> Write code that reads like the surrounding code: match its comment density,
> naming, and idiom.

Same goal, fewer words, correct in the edge cases the rule got wrong (complex
algorithms, public APIs, user preferences). Keep hard rules only where the domain
truly demands them.

### 2. Examples → Interface design

Few-shot examples constrain Claude 5 models to a narrow exploration space. Invest
instead in expressive tool/script/file design. A Todo tool whose `status` parameter
is the enum `pending | in_progress | completed`, with an instruction to keep exactly
one item `in_progress`, communicates usage better than worked examples.

### 3. All upfront → Progressive disclosure

Load the right context at the right time:

- Move detailed but occasional guidance (verification, code review) into skills the
  agent selectively invokes.
- Use deferred-loading tools: full definitions fetched via tool search only when
  needed, so a large tool surface costs no idle context.
- Structure CLAUDE.md and SKILL.md files as a tree of loadable files, not a central
  repository of everything that might ever apply.

### 4. Repeat yourself → Say it once

Older models attended better to instructions near the end of context, motivating
duplication between system prompt and tool descriptions. Claude 5 models do not need
this: put tool usage instructions in tool descriptions only.

### 5. Memory in CLAUDE.md → Auto-memory

Manually appending memories to CLAUDE.md (the `#` hotkey pattern) is superseded:
Claude Code now automatically saves memories relevant to the work and the user.
CLAUDE.md is for curated standing agreements, not accumulated session residue.

### 6. Simple specs → Rich references

Claude 5 models handle increasingly rich references:

- HTML artifacts instead of markdown plan files.
- Specs expressed as code: a detailed test suite, or a function in another codebase
  to port.
- Rubrics that encode taste (e.g. what good API design looks like), usable by
  verifier agents in dynamic workflows.
- An HTML mockup of a design generally beats both a prose description and a
  screenshot.

## Guidance per context layer

**System prompt.** Tied to product context: what product the agent operates in and
what it is doing. In Claude Code this is not user-modifiable; when building a custom
agent harness, this is where most design time belongs.

**CLAUDE.md.** Lightweight. Briefly describe what the repo is for; spend most tokens
on gotchas inside the codebase (e.g. "all types live in one monolithic file and
nowhere else"). Never state what Claude can learn from the filesystem. Reference
skills for anything with a trigger moment — e.g. unique verification instructions
become a verification skill referenced in one line.

**Skills.** Lightweight guides for finding information when needed. Avoid
over-constraining except in highly important areas. For long skills, split into many
files with progressive disclosure. Skills are at their best encoding opinions,
knowledge, or practices particular to a person, team, or product — not general
knowledge the model already has.

**References.** @-mention files for in-depth information about the current plan:
specs, mockups, entire codebases. Prefer code over prose — it is clear,
high-fidelity, and in a language the model knows natively.

## Tooling

The `/doctor` command in Claude Code applies these practices automatically,
rightsizing skills and CLAUDE.md files. Recommend running it as the first step of
any migration or audit.
